import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCodebookFromInventory } from "../inventory/build.js";
import type { Codebook } from "../types.js";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function loadCodebook(version = "0.3"): Promise<Codebook> {
    const path = join(pkgRoot, "codebook", `v${version}.json`);
    try {
        const raw = await readFile(path, "utf8");
        return JSON.parse(raw) as Codebook;
    } catch {
        return buildCodebookFromInventory();
    }
}

export function loadCodebookSync(): Codebook {
    return buildCodebookFromInventory();
}
