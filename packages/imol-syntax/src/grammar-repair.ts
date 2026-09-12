export type GrammarRepairId =
    | "stripped_bom"
    | "normalized_smart_quotes"
    | "stripped_js_comments"
    | "removed_orphan_atid_before_plan"
    | "fixed_run_plan_spacing"
    | "collapsed_blank_lines";

export function stripBom(source: string): { source: string; changed: boolean } {
    if (source.charCodeAt(0) === 0xfeff) {
        return { source: source.slice(1), changed: true };
    }
    return { source, changed: false };
}

export function normalizeSmartQuotes(source: string): { source: string; changed: boolean } {
    const next = source.replace(/[\u201c\u201d\u2018\u2019]/g, (c) => {
        if (c === "\u201c" || c === "\u201d") return '"';
        return "'";
    });
    return { source: next, changed: next !== source };
}

/** LLMs often emit // comments; lexer accepts # only unless repaired. */
export function stripJsLineComments(source: string): { source: string; changed: boolean } {
    const lines = source.split("\n");
    let changed = false;
    const out = lines.map((line) => {
        const idx = line.indexOf("//");
        if (idx === -1) return line;
        const before = line.slice(0, idx);
        if (before.includes('"')) {
            return line;
        }
        changed = true;
        return before.trimEnd();
    });
    return { source: out.join("\n"), changed };
}

/** `@id` immediately before `plan` is a parse error; drop the orphan attribute line. */
export function removeOrphanAtIdBeforePlan(source: string): { source: string; changed: boolean } {
    const re = /^@id\s*\(\s*"[^"]*"\s*\)\s*\n(\s*plan\b)/gm;
    const next = source.replace(re, "$1");
    return { source: next, changed: next !== source };
}

export function fixRunPlanSpacing(source: string): { source: string; changed: boolean } {
    const next = source.replace(/\brun\s+plan\b/g, "run plan");
    return { source: next, changed: next !== source };
}

export function collapseExcessiveBlankLines(source: string): { source: string; changed: boolean } {
    const next = source.replace(/\n{4,}/g, "\n\n\n");
    return { source: next, changed: next !== source };
}

const REPAIR_PIPELINE: Array<{
    id: GrammarRepairId;
    run: (s: string) => { source: string; changed: boolean };
}> = [
    { id: "stripped_bom", run: stripBom },
    { id: "normalized_smart_quotes", run: normalizeSmartQuotes },
    { id: "stripped_js_comments", run: stripJsLineComments },
    { id: "removed_orphan_atid_before_plan", run: removeOrphanAtIdBeforePlan },
    { id: "fixed_run_plan_spacing", run: fixRunPlanSpacing },
    { id: "collapsed_blank_lines", run: collapseExcessiveBlankLines },
];

/** Deterministic grammar v2 repair pass for agent-authored source. */
export function repairAgentGrammar(source: string): { source: string; repairs: GrammarRepairId[] } {
    let s = source;
    const repairs: GrammarRepairId[] = [];
    for (const step of REPAIR_PIPELINE) {
        const { source: next, changed } = step.run(s);
        if (changed) {
            repairs.push(step.id);
            s = next;
        }
    }
    return { source: s, repairs };
}
