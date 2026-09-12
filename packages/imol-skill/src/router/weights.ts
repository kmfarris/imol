import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type RouterWeights = {
    spec_version: string;
    embedding_dim: number;
    /** codeword_id -> weight vector same dim as embedding (logistic multi-label) */
    codeword_weights: Record<string, number[]>;
    bias: Record<string, number>;
};

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function weightsPath(): string {
    return join(pkgRoot, "codebook", "router-weights.json");
}

export async function loadRouterWeights(): Promise<RouterWeights | undefined> {
    try {
        const raw = await readFile(weightsPath(), "utf8");
        return JSON.parse(raw) as RouterWeights;
    } catch {
        return undefined;
    }
}

export async function saveRouterWeights(w: RouterWeights): Promise<void> {
    await writeFile(weightsPath(), `${JSON.stringify(w, null, 2)}\n`, "utf8");
}
