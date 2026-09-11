#!/usr/bin/env node
import { checkModule } from "@imol/check";
import { formatModule } from "@imol/fmt";
import { createDefaultExterns, runModule } from "@imol/run";
import { parse } from "@imol/syntax";
import { WorkshopSession } from "@imol/workshop";
import { readFile, writeFile } from "node:fs/promises";
async function readSource(path) {
    return readFile(path, "utf8");
}
function printDiagnostics(diags) {
    for (const d of diags) {
        console.error(`${d.code}: ${d.message}${d.hint ? ` (${d.hint})` : ""}`);
    }
}
async function cmdCheck(path, allowHoles) {
    const source = await readSource(path);
    const mod = parse(source);
    const result = checkModule(mod, { allowHoles });
    if (result.diagnostics.length) {
        printDiagnostics(result.diagnostics);
    }
    if (result.ok) {
        console.log("ok");
        return 0;
    }
    return 1;
}
async function cmdFmt(path, write) {
    const source = await readSource(path);
    const mod = parse(source);
    const out = formatModule(mod);
    if (write) {
        await writeFile(path, out, "utf8");
    }
    else {
        process.stdout.write(out);
    }
    return 0;
}
async function cmdRun(path) {
    const source = await readSource(path);
    const mod = parse(source);
    const check = checkModule(mod);
    if (!check.ok) {
        printDiagnostics(check.diagnostics);
        return 1;
    }
    await runModule(mod, createDefaultExterns(), {});
    return 0;
}
async function cmdWorkshop(path, dryRun) {
    const source = await readSource(path);
    const mod = parse(source);
    const session = new WorkshopSession(mod, { dryRun });
    await session.run();
    console.log(`trace: ${session.getTracePath()}`);
    for (const t of session.trace) {
        console.log(JSON.stringify(t));
    }
    return 0;
}
async function main() {
    const argv = process.argv.slice(2);
    if (argv.length < 2) {
        console.error("Usage: imol <check|fmt|run|workshop> <file.imol> [--write] [--dry-run] [--allow-holes]");
        return 2;
    }
    const cmd = argv[0];
    const path = argv[1];
    const flags = new Set(argv.slice(2));
    try {
        switch (cmd) {
            case "check":
                return cmdCheck(path, flags.has("--allow-holes"));
            case "fmt":
                return cmdFmt(path, flags.has("--write"));
            case "run":
                return cmdRun(path);
            case "workshop":
                return cmdWorkshop(path, flags.has("--dry-run"));
            default:
                console.error(`Unknown command ${cmd}`);
                return 2;
        }
    }
    catch (e) {
        console.error(e instanceof Error ? e.message : String(e));
        return 2;
    }
}
main().then((code) => process.exit(code));
//# sourceMappingURL=cli.js.map