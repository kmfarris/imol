import { checkModule, diagnosticsToJson } from "@kmfarris/imol-check";
import { loadCodebook } from "../codebook/load.js";
import { callChatModel } from "../llm/call-model.js";
import { loadRouterWeights } from "../router/weights.js";
import { routeSkills } from "../router/route.js";
import { parse } from "@kmfarris/imol-syntax";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
    AGENT_SPEC_VERSION,
    agentCheck,
    agentPatch,
    agentSanitize,
    agentWorkshopPlan,
    type LoadModuleFn,
} from "./agent.js";

export type AgentLoopInput = {
    task: string;
    file: string;
    max_iter?: number;
    patch_path?: string;
    dry_llm?: boolean;
};

function stripLlmFences(text: string): string {
    return text.replace(/^```imol?\n?/i, "").replace(/\n?```\s*$/, "").trim();
}

function checkSource(source: string): { ok: boolean; diagnostics: ReturnType<typeof diagnosticsToJson> } {
    try {
        const mod = parse(source);
        const result = checkModule(mod);
        return { ok: result.ok, diagnostics: diagnosticsToJson(result.diagnostics) };
    } catch (e) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "E_SYNTAX",
                    message: e instanceof Error ? e.message : String(e),
                    span: { line: 1, col: 1, start: 0, end: 0 },
                },
            ],
        };
    }
}

export async function agentLoop(loadMod: LoadModuleFn, input: AgentLoopInput): Promise<object> {
    const maxIter = input.max_iter ?? 3;
    const abs = resolve(input.file);
    const baseline = await readFile(abs, "utf8");
    const codebook = await loadCodebook();
    const weights = await loadRouterWeights();
    const route = routeSkills(
        codebook,
        { task: input.task, file_snippet: baseline.slice(0, 4000), k: 5 },
        weights,
    );
    const packet = route.packet;
    const tool_policy = route.tool_policy;

    const iterations: object[] = [];
    const ran = { prepare: true, sanitize: false, check: false, patch: false, llm: false, workshop_plan: false };
    let finalCheck: object | undefined;
    let ok = false;
    let workshopPlan: object | undefined;

    for (let i = 0; i < maxIter; i++) {
        const steps: string[] = ["prepare"];
        let source = baseline;

        if (input.patch_path && i === 0) {
            const patched = await agentPatch(abs, resolve(input.patch_path));
            source = (patched as { output: string }).output;
            steps.push("patch");
            ran.patch = true;
            finalCheck = (patched as { check: object }).check;
            ok = (patched as { check: { ok: boolean } }).check.ok;
            iterations.push({ iter: i + 1, steps, patch: patched });
            if (ok) break;
            continue;
        }

        if (input.dry_llm) {
            steps.push("dry_llm");
            finalCheck = await agentCheck(loadMod, abs, false);
            steps.push("check");
            ran.check = true;
            ok = (finalCheck as { ok: boolean }).ok;
            iterations.push({ iter: i + 1, steps, check: finalCheck });
            break;
        }

        steps.push("llm");
        ran.llm = true;
        try {
            const system = `You are an IMOL author. Output only valid IMOL source.\n\n${packet}`;
            const raw = await callChatModel(
                system,
                `${input.task}\n\nCurrent file:\n\`\`\`\n${baseline}\n\`\`\``,
            );
            source = stripLlmFences(raw);
        } catch (e) {
            iterations.push({
                iter: i + 1,
                steps,
                llm_error: e instanceof Error ? e.message : String(e),
            });
            continue;
        }

        const sanitized = (await agentSanitize(source)) as {
            ok: boolean;
            output: string;
            steps: string[];
            check?: { ok: boolean; diagnostics: unknown[] };
        };
        steps.push("sanitize");
        ran.sanitize = true;
        const check = sanitized.ok && sanitized.check ? sanitized.check : checkSource(sanitized.output);
        steps.push("check");
        ran.check = true;
        finalCheck = { ...check, sanitized_steps: (sanitized as { steps: string[] }).steps };
        ok = (check as { ok: boolean }).ok;
        iterations.push({ iter: i + 1, steps, sanitize: sanitized, check: finalCheck });
        if (ok) break;
    }

    if (ok) {
        workshopPlan = await agentWorkshopPlan(loadMod, abs);
        ran.workshop_plan = true;
    }

    const loop_compliance = tool_policy.map((rule) => ({
        rule,
        satisfied: rule.includes("check")
            ? ran.check
            : rule.includes("patch")
              ? ran.patch || !input.patch_path
              : rule.includes("workshop")
                ? ran.workshop_plan || !ok
                : rule.includes("sanitize")
                  ? ran.sanitize || input.dry_llm
                  : true,
    }));

    return {
        ok,
        spec_version: AGENT_SPEC_VERSION,
        entry: abs,
        token_budget: route.token_estimate,
        prepare: {
            codewords: route.codewords,
            tool_policy,
            token_estimate: route.token_estimate,
        },
        iterations,
        final_check: finalCheck,
        ...(workshopPlan ? { workshop_plan: workshopPlan } : {}),
        loop_compliance,
    };
}
