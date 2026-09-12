#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EMBEDDING_DIM, embedText } from "../embed.js";
import { loadCodebook } from "../codebook/load.js";
import { saveRouterWeights, type RouterWeights } from "./weights.js";
import type { TrajectoryStep } from "../types.js";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

async function main(): Promise<void> {
    const dataPath = join(pkgRoot, "data", "oracle-trajectories.jsonl");
    let raw: string;
    try {
        raw = await readFile(dataPath, "utf8");
    } catch {
        console.error(`Missing ${dataPath}; run dataset:synth first`);
        process.exit(1);
    }
    const steps: TrajectoryStep[] = raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as TrajectoryStep);

    const codebook = await loadCodebook();
    const ids = codebook.codewords.map((c) => c.id);
    const dim = codebook.embedding_dim || EMBEDDING_DIM;
    const lr = 0.05;
    const epochs = 30;

    const codeword_weights: Record<string, number[]> = {};
    const bias: Record<string, number> = {};
    for (const id of ids) {
        codeword_weights[id] = new Array(dim).fill(0);
        bias[id] = 0;
    }

    for (let epoch = 0; epoch < epochs; epoch++) {
        for (const step of steps) {
            const vec = embedText(step.query, dim);
            const labelSet = new Set(step.codeword_ids);
            for (const id of ids) {
                const y = labelSet.has(id) ? 1 : 0;
                let logit = bias[id]!;
                const w = codeword_weights[id]!;
                for (let i = 0; i < dim; i++) {
                    logit += w[i]! * vec[i]!;
                }
                const pred = 1 / (1 + Math.exp(-logit));
                const err = pred - y;
                bias[id] = bias[id]! - lr * err;
                for (let i = 0; i < dim; i++) {
                    w[i] = w[i]! - lr * err * vec[i]!;
                }
            }
        }
    }

    const weights: RouterWeights = {
        spec_version: "0.3",
        embedding_dim: dim,
        codeword_weights,
        bias,
    };
    await saveRouterWeights(weights);
    console.log(`router: trained on ${steps.length} steps, saved router-weights.json`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
