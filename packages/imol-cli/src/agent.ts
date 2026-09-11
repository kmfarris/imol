import { checkModule, diagnosticsToJson } from "@imol/check";
import { applyPatches, parsePatchFile } from "@imol/patch";
import { formatModule } from "@imol/fmt";
import { parse } from "@imol/syntax";
import { WorkshopSession } from "@imol/workshop";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const AGENT_SPEC_VERSION = "0.3";

export type AgentError = { ok: false; error: string; spec_version: string };

function agentFail(message: string): AgentError {
    return { ok: false, error: message, spec_version: AGENT_SPEC_VERSION };
}

export async function agentCheck(
    loadMod: (path: string) => Promise<import("@imol/syntax").ModuleDecl>,
    entry: string,
    allowHoles: boolean,
): Promise<object> {
    const abs = resolve(entry);
    const mod = await loadMod(abs);
    const result = checkModule(mod, { allowHoles });
    return {
        ok: result.ok,
        has_holes: result.hasHoles,
        diagnostics: diagnosticsToJson(result.diagnostics),
        entry: abs,
        spec_version: AGENT_SPEC_VERSION,
    };
}

export async function agentFmtCheck(sourcePath: string): Promise<object> {
    const abs = resolve(sourcePath);
    const source = await readFile(abs, "utf8");
    const mod = parse(source);
    const formatted = formatModule(mod);
    const changed = formatted !== source;
    const out: {
        ok: boolean;
        changed: boolean;
        diff_hint?: string;
        spec_version: string;
    } = {
        ok: !changed,
        changed,
        spec_version: AGENT_SPEC_VERSION,
    };
    if (changed) {
        out.diff_hint = "Run imol fmt --write to canonicalize.";
    }
    return out;
}

export async function agentPatch(
    imolPath: string,
    patchPath: string,
): Promise<object> {
    const absImol = resolve(imolPath);
    const source = await readFile(absImol, "utf8");
    const patchJson = await readFile(resolve(patchPath), "utf8");
    const output = applyPatches(source, parsePatchFile(patchJson));
    const mod = parse(output);
    const check = checkModule(mod);
    return {
        ok: true,
        output,
        check: {
            ok: check.ok,
            diagnostics: diagnosticsToJson(check.diagnostics),
        },
        spec_version: AGENT_SPEC_VERSION,
    };
}

export async function agentWorkshopPlan(
    loadMod: (path: string) => Promise<import("@imol/syntax").ModuleDecl>,
    entry: string,
): Promise<object> {
    const abs = resolve(entry);
    const mod = await loadMod(abs);
    const session = new WorkshopSession(mod, { dryRun: true, approve: false, planApproved: false });
    await session.run();
    return {
        ok: true,
        trace: session.trace,
        state: session.state,
        trace_path: session.getTracePath(),
        spec_version: AGENT_SPEC_VERSION,
    };
}

export function printAgentJson(value: object): void {
    console.log(JSON.stringify(value));
}

export function printAgentError(message: string): void {
    console.log(JSON.stringify(agentFail(message)));
}
