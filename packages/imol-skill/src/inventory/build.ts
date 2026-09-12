import { EMBEDDING_DIM, embedText, toArray } from "../embed.js";
import type { Codebook, Codeword } from "../types.js";
import { CODewORD_ENTRIES } from "./entries.js";

export function buildCodebookFromInventory(): Codebook {
    const codewords: Codeword[] = CODewORD_ENTRIES.map((entry) => {
        const text = [entry.id, ...entry.tags, ...entry.keywords, entry.expansion].join(" ");
        const embedding = toArray(embedText(text, EMBEDDING_DIM));
        return { ...entry, embedding };
    });
    return {
        spec_version: "0.3",
        codebook_id: "imol-skill-v0.3",
        embedding_dim: EMBEDDING_DIM,
        codewords,
    };
}
