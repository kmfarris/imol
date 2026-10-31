import { ImolSyntaxError, parseWithRepair, repairAgentGrammar } from "@kmfarris/imol-syntax";
import { formatModule } from "./format.js";

export type SanitizeStep =
    | "normalized_crlf"
    | "stripped_fences"
    | "trimmed"
    | "grammar_repair"
    | "formatted";

export function stripMarkdownFences(source: string): string {
    let s = source.trim();
    if (/^```(?:imol)?\s*\n/i.test(s)) {
        s = s.replace(/^```(?:imol)?\s*\n/i, "").replace(/\n?```\s*$/, "");
    }
    return s;
}

/** Pre-parse hygiene + grammar v2 repair pipeline. */
export function sanitizeAgentSource(source: string): {
    source: string;
    steps: SanitizeStep[];
    grammar_repairs: string[];
} {
    const steps: SanitizeStep[] = [];
    let s = source;
    if (s.includes("\r\n")) {
        s = s.replace(/\r\n/g, "\n");
        steps.push("normalized_crlf");
    }
    const unfenced = stripMarkdownFences(s);
    if (unfenced !== s.trim()) {
        s = unfenced;
        steps.push("stripped_fences");
    }
    const trimmed = s.trim();
    if (trimmed !== s) {
        s = trimmed;
        steps.push("trimmed");
    }
    const { source: repaired, repairs } = repairAgentGrammar(s);
    if (repairs.length > 0) {
        s = repaired;
        steps.push("grammar_repair");
    }
    if (s.length && !s.endsWith("\n")) {
        s = `${s}\n`;
    }
    return { source: s, steps, grammar_repairs: repairs };
}

export function sanitizeAndFormat(source: string): {
    ok: boolean;
    output: string;
    steps: SanitizeStep[];
    grammar_repairs: string[];
    parse_error?: string;
} {
    const { source: clean, steps, grammar_repairs } = sanitizeAgentSource(source);
    try {
        const { module: mod, repairs: parseRepairs } = parseWithRepair(clean);
        const allGrammar = [...grammar_repairs, ...parseRepairs];
        const formatted = formatModule(mod);
        if (formatted !== clean) {
            steps.push("formatted");
        }
        return {
            ok: true,
            output: formatted,
            steps,
            grammar_repairs: [...new Set(allGrammar)],
        };
    } catch (e) {
        const msg =
            e instanceof ImolSyntaxError
                ? `${e.code}: ${e.message}`
                : e instanceof Error
                  ? e.message
                  : String(e);
        return {
            ok: false,
            output: clean,
            steps,
            grammar_repairs,
            parse_error: msg,
        };
    }
}
