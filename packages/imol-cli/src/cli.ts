#!/usr/bin/env node
import { checkModule, diagnosticsToJson } from "@imol/check";
import { loadManifest, loadModuleFromFile } from "@imol/load";
import { applyPatches, parsePatchFile } from "@imol/patch";
import { formatModule } from "@imol/fmt";
import { capabilitiesFromWorkshop, createExternRegistry, runModule } from "@imol/run";
import { ImolSyntaxError, parse } from "@imol/syntax";
import { compareTraces, WorkshopSession } from "@imol/workshop";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    agentCheck,
    agentFmtCheck,
    agentPatch,
    agentWorkshopPlan,
    printAgentError,
    printAgentJson,
} from "./agent.js";
import { CMD_HELP, TOP_HELP } from "./help.js";
import { cmdSkillRoute } from "@imol/skill";
import { mcpToImolTools, parseMcpExport } from "./mcp-import.js";

async function readSource(path: string): Promise<string> {
    return readFile(path, "utf8");
}

function printDiagnostics(diags: { message: string; code: string; hint?: string }[]): void {
    for (const d of diags) {
        console.error(`${d.code}: ${d.message}${d.hint ? ` (${d.hint})` : ""}`);
    }
}

async function resolveEntryPath(argPath: string | undefined): Promise<string> {
    if (argPath) {
        return resolve(argPath);
    }
    const cwd = process.cwd();
    const manifest = await loadManifest(cwd);
    if (!manifest?.entry) {
        throw new Error("No file path and no imol.json/imol.toml entry in cwd");
    }
    return resolve(cwd, manifest.entry);
}

async function loadMod(path: string) {
    const root = dirname(path);
    return loadModuleFromFile(path, { projectRoot: root });
}

async function cmdCheck(path: string | undefined, allowHoles: boolean, json: boolean): Promise<number> {
    const entry = await resolveEntryPath(path);
    const mod = await loadMod(entry);
    const result = checkModule(mod, { allowHoles });
    if (json) {
        console.log(
            JSON.stringify({
                ok: result.ok,
                has_holes: result.hasHoles,
                diagnostics: diagnosticsToJson(result.diagnostics),
            }),
        );
        return result.ok ? 0 : 1;
    }
    if (result.diagnostics.length) {
        printDiagnostics(result.diagnostics);
    }
    console.log(result.ok ? "ok" : "check failed");
    return result.ok ? 0 : 1;
}

async function cmdFmt(path: string, write: boolean): Promise<number> {
    const source = await readSource(path);
    const mod = parse(source);
    const out = formatModule(mod);
    if (write) {
        await writeFile(path, out, "utf8");
    } else {
        process.stdout.write(out);
    }
    return 0;
}

async function cmdRun(path: string | undefined, approve: boolean): Promise<number> {
    const entry = await resolveEntryPath(path);
    const mod = await loadMod(entry);
    const check = checkModule(mod);
    if (!check.ok) {
        printDiagnostics(check.diagnostics);
        return 1;
    }
    const caps = capabilitiesFromWorkshop(mod.workshop);
    const externs = createExternRegistry(caps, mod.workshop?.binds ?? []);
    await runModule(mod, externs, {
        capabilities: caps,
        planApproved: approve,
    });
    return 0;
}

async function cmdPatch(imolPath: string, patchPath: string, write: boolean): Promise<number> {
    const source = await readSource(imolPath);
    const patchJson = await readSource(patchPath);
    const out = applyPatches(source, parsePatchFile(patchJson));
    if (write) {
        await writeFile(imolPath, out, "utf8");
    } else {
        process.stdout.write(out);
    }
    return 0;
}

async function cmdToolsImport(mcpPath: string, outPath: string | undefined): Promise<number> {
    const raw = await readSource(mcpPath);
    const imol = mcpToImolTools(parseMcpExport(raw));
    if (outPath) {
        await writeFile(outPath, imol, "utf8");
    } else {
        process.stdout.write(imol);
    }
    return 0;
}

async function cmdWorkshop(
    path: string | undefined,
    dryRun: boolean,
    approve: boolean,
    sub: string | undefined,
    tracePath: string | undefined,
    replayExecuted?: string,
): Promise<number> {
    if (sub === "replay") {
        if (!tracePath || !replayExecuted) {
            console.error("Usage: imol workshop replay <planned.jsonl> <executed.jsonl>");
            return 2;
        }
        const planned = await WorkshopSession.readTraceFile(tracePath);
        const executed = await WorkshopSession.readTraceFile(replayExecuted);
        console.log(JSON.stringify({ mismatches: compareTraces(planned, executed) }, null, 2));
        return 0;
    }
    if (sub === "trace") {
        let file = tracePath;
        if (!file) {
            try {
                const last = JSON.parse(
                    await readFile(join(".imol-trace", "last-trace.json"), "utf8"),
                ) as { path: string };
                file = last.path;
            } catch {
                console.error(
                    "Usage: imol workshop trace <file.jsonl> (or run workshop first to set last-trace.json)",
                );
                return 2;
            }
        }
        const entries = await WorkshopSession.readTraceFile(file);
        console.log(JSON.stringify(entries, null, 2));
        return 0;
    }
    const entry = await resolveEntryPath(path);
    const mod = await loadMod(entry);
    const session = new WorkshopSession(mod, { dryRun, approve, planApproved: approve });
    await session.run();
    console.log(`trace: ${session.getTracePath()}`);
    console.log(`state: ${session.state}`);
    for (const t of session.trace) {
        console.log(JSON.stringify(t));
    }
    return 0;
}

async function cmdAgent(sub: string | undefined, pos: string[], flags: Set<string>): Promise<number> {
    try {
        switch (sub) {
            case "check": {
                const entry = await resolveEntryPath(pos[0]);
                const body = await agentCheck(loadMod, entry, flags.has("--allow-holes"));
                printAgentJson(body);
                return (body as { ok: boolean }).ok ? 0 : 1;
            }
            case "fmt-check": {
                if (!pos[0]) {
                    printAgentError("Usage: imol agent fmt-check <file.imol>");
                    return 2;
                }
                const body = await agentFmtCheck(pos[0]);
                printAgentJson(body);
                return (body as { ok: boolean }).ok ? 0 : 1;
            }
            case "patch": {
                if (!pos[0] || !pos[1]) {
                    printAgentError("Usage: imol agent patch <file.imol> <patches.json>");
                    return 2;
                }
                const body = await agentPatch(pos[0], pos[1]);
                printAgentJson(body);
                const checkOk = (body as { check: { ok: boolean } }).check.ok;
                return checkOk ? 0 : 1;
            }
            case "workshop-plan": {
                const entry = await resolveEntryPath(pos[0]);
                const body = await agentWorkshopPlan(loadMod, entry);
                printAgentJson(body);
                return 0;
            }
            default:
                printAgentError(
                    sub
                        ? `Unknown agent subcommand '${sub}'`
                        : "Usage: imol agent check|fmt-check|patch|workshop-plan ...",
                );
                return 2;
        }
    } catch (e) {
        printAgentError(e instanceof Error ? e.message : String(e));
        return 1;
    }
}

async function main(): Promise<number> {
    const argv = process.argv.slice(2);
    if (argv.length < 1 || argv[0] === "--help" || argv[0] === "-h") {
        console.error(TOP_HELP);
        return argv.length < 1 ? 2 : 0;
    }
    const cmd = argv[0] ?? "";
    const flags = new Set(argv.filter((a) => a.startsWith("--")));
    const args = argv.filter((a) => !a.startsWith("--"));
    if (flags.has("--help") || flags.has("-h")) {
        const help = CMD_HELP[cmd];
        console.error(help ?? `No help for ${cmd}`);
        return help ? 0 : 2;
    }
    try {
        if (cmd === "agent") {
            return cmdAgent(args[1], args.slice(2), flags);
        }
        if (cmd === "skill") {
            const sub = args[1];
            if (sub === "route") {
                let task = "";
                let file: string | undefined;
                let k = 5;
                let oracle: string | undefined;
                const pos = args.slice(2);
                for (let i = 0; i < pos.length; i++) {
                    const a = pos[i];
                    if (a === "--file" && pos[i + 1]) {
                        file = pos[++i];
                    } else if (a === "--k" && pos[i + 1]) {
                        k = Number(pos[++i]) || 5;
                    } else if (a === "--oracle" && pos[i + 1]) {
                        oracle = pos[++i];
                    } else if (a && !a.startsWith("--")) {
                        task = task ? `${task} ${a}` : a;
                    }
                }
                if (!task) {
                    console.error('Usage: imol skill route "<task>" [--file path.imol] [--k 5]');
                    return 2;
                }
                return cmdSkillRoute(task, file, k, oracle);
            }
            if (sub === "mcp") {
                const serverPath = fileURLToPath(import.meta.resolve("@imol/skill/mcp"));
                const code = await new Promise<number>((res) => {
                    const child = spawn(process.execPath, [serverPath], { stdio: "inherit" });
                    child.on("exit", (c) => res(c ?? 1));
                    child.on("error", () => res(1));
                });
                return code;
            }
            console.error("Usage: imol skill route|mcp ...");
            return 2;
        }
        switch (cmd) {
            case "check":
                return cmdCheck(args[1], flags.has("--allow-holes"), flags.has("--json"));
            case "fmt":
                if (!args[1]) return 2;
                return cmdFmt(args[1], flags.has("--write"));
            case "run":
                return cmdRun(args[1], flags.has("--approve"));
            case "patch":
                if (!args[1] || !args[2]) return 2;
                return cmdPatch(args[1], args[2], flags.has("--write"));
            case "tools":
                if (args[1] === "import" && args[2]) {
                    return cmdToolsImport(args[2], args[3]);
                }
                console.error("Usage: imol tools import mcp.json [out.imol]");
                return 2;
            case "workshop":
                if (args[1] === "trace") {
                    return cmdWorkshop(undefined, false, false, "trace", args[2], undefined);
                }
                if (args[1] === "replay") {
                    return cmdWorkshop(undefined, false, false, "replay", args[2], args[3]);
                }
                return cmdWorkshop(
                    args[1],
                    flags.has("--dry-run"),
                    flags.has("--approve"),
                    undefined,
                    undefined,
                    undefined,
                );
            default:
                console.error(`Unknown command ${cmd}`);
                return 2;
        }
    } catch (e) {
        if (e instanceof ImolSyntaxError) {
            console.error(JSON.stringify({ code: e.code, message: e.message, span: e.span }));
            return 1;
        }
        console.error(e instanceof Error ? e.message : String(e));
        return 2;
    }
}

main().then((code) => process.exit(code));
