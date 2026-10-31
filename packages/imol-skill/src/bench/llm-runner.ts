import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkModule } from "@kmfarris/imol-check";
import { loadModuleFromFile } from "@kmfarris/imol-load";
import { loadCodebook } from "../codebook/load.js";
import { callChatModel } from "../llm/call-model.js";
import { loadRouterWeights } from "../router/weights.js";
import { routeSkills } from "../router/route.js";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = join(pkgRoot, "../..");

type LlmTask = {
    id: string;
    file: string;
    prompt: string;
};

type LlmScenarioFile = {
    tasks: LlmTask[];
};

export type LlmBenchResult = {
    skipped: boolean;
    reason?: string;
    check_pass_at_1: number | null;
    check_pass_at_3: number | null;
    patch_valid_at_1: number | null;
    tasks: Array<{
        id: string;
        attempts: number;
        passed: boolean;
        token_budget: number;
    }>;
};

async function checkFileRel(relPath: string, source?: string): Promise<boolean> {
    const abs = join(repoRoot, relPath);
    if (source !== undefined) {
        const { parse } = await import("@kmfarris/imol-syntax");
        const mod = parse(source);
        return checkModule(mod).ok;
    }
    const mod = await loadModuleFromFile(abs, { projectRoot: dirname(abs) });
    return checkModule(mod).ok;
}

export async function runLlmBench(k = 3): Promise<LlmBenchResult> {
    const scenariosPath = join(pkgRoot, "bench/llm-scenarios.json");
    const raw = JSON.parse(await readFile(scenariosPath, "utf8")) as LlmScenarioFile;
    const codebook = await loadCodebook();
    const weights = await loadRouterWeights();

    if (!(process.env.IMOL_AGENTBENCH_API_KEY ?? process.env.OPENAI_API_KEY)) {
        return {
            skipped: true,
            reason: "Set IMOL_AGENTBENCH_API_KEY or OPENAI_API_KEY to run LLM eval",
            check_pass_at_1: null,
            check_pass_at_3: null,
            patch_valid_at_1: null,
            tasks: [],
        };
    }

    const taskRows: LlmBenchResult["tasks"] = [];
    let passAt1 = 0;
    let passAtK = 0;

    for (const task of raw.tasks) {
        const abs = join(repoRoot, task.file);
        const baseline = await readFile(abs, "utf8");
        const route = routeSkills(
            codebook,
            { task: task.prompt, file_snippet: baseline.slice(0, 2000), k: 5 },
            weights,
        );
        const system = `You are an IMOL author. Output only valid IMOL source.\n\n${route.packet}`;

        let passed = false;
        let attempts = 0;
        for (let i = 0; i < k; i++) {
            attempts++;
            const out = await callChatModel(
                system,
                `${task.prompt}\n\nCurrent file:\n\`\`\`\n${baseline}\n\`\`\``,
            );
            const source = out.replace(/^```imol?\n?/i, "").replace(/\n?```\s*$/, "");
            try {
                if (await checkFileRel(task.file, source)) {
                    passed = true;
                    break;
                }
            } catch {
                /* invalid syntax */
            }
        }
        if (passed && attempts === 1) passAt1++;
        if (passed) passAtK++;
        taskRows.push({
            id: task.id,
            attempts,
            passed,
            token_budget: route.token_estimate,
        });
    }

    const n = raw.tasks.length || 1;
    return {
        skipped: false,
        check_pass_at_1: passAt1 / n,
        check_pass_at_3: passAtK / n,
        patch_valid_at_1: null,
        tasks: taskRows,
    };
}
