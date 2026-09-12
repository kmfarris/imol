import { checkModule, diagnosticsToJson } from "@imol/check";
import { formatModule, sanitizeAndFormat } from "@imol/fmt";
import { loadModuleFromFile } from "@imol/load";
import { applyPatches, parsePatchFile } from "@imol/patch";
import { parse, type ModuleDecl } from "@imol/syntax";
import { WorkshopSession } from "@imol/workshop";
import { dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export const AGENT_SPEC_VERSION = "0.4";

export type AgentError = { ok: false; error: string; spec_version: string };

export function agentFail(message: string): AgentError {
    return { ok: false, error: message, spec_version: AGENT_SPEC_VERSION };
}

export type LoadModuleFn = (path: string) => Promise<ModuleDecl>;

export async function defaultLoadModule(filePath: string): Promise<ModuleDecl> {
    const abs = resolve(filePath);
    return loadModuleFromFile(abs, { projectRoot: dirname(abs) });
}

export async function agentCheck(
    loadMod: LoadModuleFn,
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

export async function agentSanitize(source: string): Promise<object> {
    const sanitized = sanitizeAndFormat(source);
    if (!sanitized.ok) {
        return {
            ok: false,
            output: sanitized.output,
            steps: sanitized.steps,
            grammar_repairs: sanitized.grammar_repairs,
            parse_error: sanitized.parse_error,
            spec_version: AGENT_SPEC_VERSION,
        };
    }
    const mod = parse(sanitized.output);
    const check = checkModule(mod);
    return {
        ok: check.ok,
        output: sanitized.output,
        steps: sanitized.steps,
        grammar_repairs: sanitized.grammar_repairs,
        check: {
            ok: check.ok,
            diagnostics: diagnosticsToJson(check.diagnostics),
        },
        spec_version: AGENT_SPEC_VERSION,
    };
}

export async function agentSanitizeFile(
    sourcePath: string,
    write: boolean,
): Promise<object> {
    const abs = resolve(sourcePath);
    const source = await readFile(abs, "utf8");
    const body = await agentSanitize(source);
    const out = (body as { output?: string }).output;
    if (write && out !== undefined && out !== source) {
        await writeFile(abs, out, "utf8");
        return { ...body, wrote: true };
    }
    return body;
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

export async function agentPatch(imolPath: string, patchPath: string): Promise<object> {
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

export { agentLoop, type AgentLoopInput } from "./agent-loop.js";

export async function agentWorkshopPlan(loadMod: LoadModuleFn, entry: string): Promise<object> {
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
