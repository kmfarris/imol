/** Deterministic sparse embedder (no external API). Same dim for all codebook entries. */
export const EMBEDDING_DIM = 256;

function hashToken(token: string): number {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
        h ^= token.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9_@./+-]+/g, " ")
        .split(/\s+/)
        .filter(Boolean);
}

export function embedText(text: string, dim = EMBEDDING_DIM): Float32Array {
    const vec = new Float32Array(dim);
    for (const tok of tokenize(text)) {
        const h = hashToken(tok);
        const idx = h % dim;
        const sign = h & 1 ? 1 : -1;
        vec[idx]! += sign * (1 + (h % 7) / 7);
    }
    let norm = 0;
    for (let i = 0; i < dim; i++) {
        norm += vec[i]! * vec[i]!;
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) {
        vec[i]! /= norm;
    }
    return vec;
}

export function cosine(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        dot += a[i]! * b[i]!;
    }
    return dot;
}

export function toArray(v: Float32Array): number[] {
    return [...v];
}
