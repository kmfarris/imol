import { cosine, embedText, tokenize } from "../embed.js";
import { compilePacket, estimateTokens } from "../compiler/packet.js";
import type { Codebook, RouteInput, RouteResult } from "../types.js";
import type { RouterWeights } from "./weights.js";

function keywordScore(queryTokens: Set<string>, codeword: { keywords: string[]; tags: string[]; id: string }): number {
    let score = 0;
    const keys = [...codeword.keywords, ...codeword.tags, ...codeword.id.split(/[._]/g)];
    for (const k of keys) {
        const t = k.toLowerCase();
        if (queryTokens.has(t)) {
            score += 2;
        }
        for (const q of queryTokens) {
            if (q.includes(t) || t.includes(q)) {
                score += 0.5;
            }
        }
    }
    return score;
}

function scoreWithWeights(
    vec: Float32Array,
    codewordId: string,
    embedding: number[] | undefined,
    weights: RouterWeights | undefined,
): number {
    if (!embedding?.length) {
        return 0;
    }
    const emb = new Float32Array(embedding);
    let s = cosine(vec, emb);
    if (weights?.codeword_weights[codewordId]) {
        const w = weights.codeword_weights[codewordId]!;
        let dot = weights.bias[codewordId] ?? 0;
        for (let i = 0; i < Math.min(vec.length, w.length); i++) {
            dot += vec[i]! * w[i]!;
        }
        s += dot;
    }
    return s;
}

export function routeSkills(
    codebook: Codebook,
    input: RouteInput,
    weights?: RouterWeights,
): RouteResult {
    const k = input.k ?? 5;
    const queryText = [input.task, input.file_snippet ?? "", input.last_oracle_json ?? ""].join("\n");
    const vec = embedText(queryText, codebook.embedding_dim);
    const queryTokens = new Set(tokenize(queryText));

    const scored = codebook.codewords.map((cw) => {
        const kw = keywordScore(queryTokens, cw);
        const emb = scoreWithWeights(vec, cw.id, cw.embedding, weights);
        return { cw, score: kw + emb * 3 };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, k).filter((x) => x.score > 0);
    const selected =
        top.length > 0 ? top : scored.slice(0, Math.min(k, scored.length));

    const codewords = selected.map((s) => ({ id: s.cw.id, score: s.score }));
    const { packet, tool_policy } = compilePacket(
        selected.map((s) => s.cw),
        {
            ...(input.task ? { task: input.task } : {}),
            ...(input.file_snippet ? { file_snippet: input.file_snippet } : {}),
            ...(input.last_oracle_json ? { last_oracle_json: input.last_oracle_json } : {}),
        },
    );

    return {
        spec_version: codebook.spec_version,
        codewords,
        packet,
        token_estimate: estimateTokens(packet),
        tool_policy,
    };
}

/** Map diagnostic codes to codeword ids for training labels */
export function codewordsForDiagnostics(codes: string[]): string[] {
    const map: Record<string, string> = {
        E_EXTERN: "extern.catalog",
        E_IMPORT_COLLISION: "import.collision",
        E_TYPE: "check.type_match",
    };
    const out = new Set<string>();
    for (const c of codes) {
        const id = map[c];
        if (id) {
            out.add(id);
        }
    }
    return [...out];
}
