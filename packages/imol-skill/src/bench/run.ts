#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCodebook } from "../codebook/load.js";
import { estimateTokens } from "../compiler/packet.js";
import { loadRouterWeights } from "../router/weights.js";
import { routeSkills } from "../router/route.js";
import { runLlmBench } from "./llm-runner.js";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = join(pkgRoot, "../..");

type Scenario = {
    id: string;
    task: string;
    expected_codewords: string[];
};

async function main(): Promise<void> {
    const scenariosPath = join(pkgRoot, "bench/scenarios.json");
    const raw = JSON.parse(await readFile(scenariosPath, "utf8")) as {
        scenarios: Scenario[];
        baselines: Record<string, { file?: string; k?: number }>;
    };

    const codebook = await loadCodebook();
    const weights = await loadRouterWeights();

    let recallHits = 0;
    let recallTotal = 0;
    const scenarioResults: unknown[] = [];

    for (const sc of raw.scenarios) {
        const route = routeSkills(codebook, { task: sc.task, k: 5 }, weights);
        const got = new Set(route.codewords.map((c) => c.id));
        let hit = 0;
        for (const exp of sc.expected_codewords) {
            recallTotal++;
            if (got.has(exp)) {
                hit++;
                recallHits++;
            }
        }
        scenarioResults.push({
            id: sc.id,
            recall: hit / sc.expected_codewords.length,
            token_estimate: route.token_estimate,
            codewords: route.codewords.map((c) => c.id),
        });
    }

    const cheatPath = join(pkgRoot, "bench/cheat-sheet.md");
    const specPath = join(repoRoot, "packages/imol-spec/SPEC.md");
    const cheat = await readFile(cheatPath, "utf8");
    const spec = await readFile(specPath, "utf8");
    const sampleRoute = routeSkills(codebook, { task: raw.scenarios[0]!.task, k: 5 }, weights);

    const llm = await runLlmBench(3);

    const report = {
        spec_version: "0.4",
        codeword_recall_at_5: recallTotal ? recallHits / recallTotal : 0,
        scenarios: scenarioResults,
        baselines: {
            A_none: { token_estimate: 0 },
            B_cheat_sheet: { token_estimate: estimateTokens(cheat) },
            C_full_spec: { token_estimate: estimateTokens(spec) },
            D_csd_k5: { token_estimate: sampleRoute.token_estimate },
        },
        llm_eval: llm,
        metrics_doc: {
            check_pass_at_1: llm.skipped ? "Set IMOL_AGENTBENCH_API_KEY to measure" : "From llm_eval",
            check_pass_at_3: llm.skipped ? "Set IMOL_AGENTBENCH_API_KEY to measure" : "From llm_eval",
            patch_valid_at_1: "Future: patch JSON tasks in llm-scenarios.json",
            loop_compliance: "Enforced via tool_policy in packet",
        },
    };

    console.log(JSON.stringify(report, null, 2));
    if (recallTotal && recallHits / recallTotal < 0.35) {
        process.exit(1);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
