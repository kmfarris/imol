import type { TraceEntry } from "@kmfarris/imol-run";

export type TraceMismatch = {
    index: number;
    tool?: string;
    effect?: string;
    mismatch: string;
};

function entryKey(e: TraceEntry): string {
    return JSON.stringify({
        kind: e.kind,
        tool: e.tool ?? e.name,
        extern: e.extern,
        args_digest: e.args_digest,
        effect: e.effect,
    });
}

export function compareTraces(planned: TraceEntry[], executed: TraceEntry[]): TraceMismatch[] {
    const out: TraceMismatch[] = [];
    const max = Math.max(planned.length, executed.length);
    for (let i = 0; i < max; i++) {
        const p = planned[i];
        const x = executed[i];
        if (!p) {
            out.push({ index: i, mismatch: "extra executed entry" });
            continue;
        }
        if (!x) {
            const miss: TraceMismatch = { index: i, mismatch: "missing executed entry" };
            if (p.tool) miss.tool = p.tool;
            if (p.effect) miss.effect = p.effect;
            out.push(miss);
            continue;
        }
        if (entryKey(p) !== entryKey(x)) {
            const diff: TraceMismatch = {
                index: i,
                mismatch: "kind/tool/extern/args_digest/effect differ",
            };
            const toolName = p.tool ?? p.name;
            if (toolName) diff.tool = toolName;
            if (p.effect) diff.effect = p.effect;
            out.push(diff);
        }
    }
    return out;
}
