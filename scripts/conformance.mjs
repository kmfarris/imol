import { checkModule, diagnosticsToJson } from "../packages/imol-check/dist/index.js";
import { formatModule } from "../packages/imol-fmt/dist/index.js";
import { loadModuleFromFile } from "../packages/imol-load/dist/index.js";
import { parse, ImolSyntaxError } from "../packages/imol-syntax/dist/index.js";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

async function readImol(path) {
    return readFile(path, "utf8");
}

let failed = 0;

for (const name of await readdir(join(root, "examples/golden")).catch(() => [])) {
    if (!name.endsWith(".imol")) continue;
    const src = await readImol(join(root, "examples/golden", name));
    const mod = parse(src);
    const again = parse(formatModule(mod));
    if (again.name !== mod.name) {
        console.error(`golden round-trip failed: ${name}`);
        failed++;
    }
    const check = checkModule(mod);
    if (!check.ok) {
        console.error(`golden check failed: ${name}`, diagnosticsToJson(check.diagnostics));
        failed++;
    }
}

for (const name of await readdir(join(root, "examples"))) {
    if (!name.endsWith(".imol")) continue;
    const path = join(root, "examples", name);
    const src = await readImol(path);
    const mod = src.includes("import ")
        ? await loadModuleFromFile(path, { projectRoot: join(root, "examples") })
        : parse(src);
    const check = checkModule(mod);
    if (!check.ok) {
        console.error(`example check failed: ${name}`, diagnosticsToJson(check.diagnostics));
        failed++;
    }
    try {
        const once = formatModule(parse(src));
        if (formatModule(parse(once)) !== once) {
            console.error(`example fmt not idempotent: ${name}`);
            failed++;
        }
    } catch (e) {
        console.error(`example fmt output does not parse: ${name}`, e instanceof Error ? e.message : e);
        failed++;
    }
}

const patchGreet = join(root, "examples/agent/patch-greet.json");
const greetPath = join(root, "examples/greet.imol");
try {
    const { applyPatches, parsePatchFile } = await import("../packages/imol-patch/dist/index.js");
    const src = await readImol(greetPath);
    const out = applyPatches(src, parsePatchFile(await readImol(patchGreet)));
    if (!out.includes("agent-patched")) {
        console.error("agent patch-greet.json did not apply");
        failed++;
    }
} catch (e) {
    console.error("agent patch conformance failed", e);
    failed++;
}

const mcpSample = join(root, "examples/agent/sample-mcp.json");
try {
    const { mcpToImolTools, parseMcpExport } = await import("../packages/imol-cli/dist/mcp-import.js");
    const imol = mcpToImolTools(parseMcpExport(await readImol(mcpSample)));
    parse(imol);
} catch (e) {
    console.error("sample-mcp conformance failed", e);
    failed++;
}

for (const name of await readdir(join(root, "examples/bad"))) {
    if (!name.endsWith(".imol")) continue;
    const path = join(root, "examples/bad", name);
    const src = await readImol(path);
    try {
        const mod = parse(src);
        const check = checkModule(mod);
        if (check.ok) {
            console.error(`bad example should fail check: ${name}`);
            failed++;
        }
    } catch (e) {
        if (!(e instanceof ImolSyntaxError)) {
            console.error(`bad example threw unexpectedly: ${name}`, e);
            failed++;
        }
    }
}

if (failed > 0) {
    console.error(`conformance: ${failed} failures`);
    process.exit(1);
}
console.log("conformance: ok");
