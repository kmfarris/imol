import { ImolSyntaxError, parse } from "@imol/syntax";
import { formatModule } from "./format.js";

export type SanitizeStep =
    | "normalized_crlf"
    | "stripped_fences"
    | "trimmed"
    | "formatted";

export function stripMarkdownFences(source: string): string {
    let s = source.trim();
    if (/^```(?:imol)?\s*\n/i.test(s)) {
        s = s.replace(/^```(?:imol)?\s*\n/i, "").replace(/\n?```\s*$/, "");
    }
    return s;
}

/** Grammar v2 (thin): post-filter common LLM output before parse/fmt. */
export function sanitizeAgentSource(source: string): { source: string; steps: SanitizeStep[] } {
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
    if (s.length && !s.endsWith("\n")) {
        s = `${s}\n`;
    }
    return { source: s, steps };
}

export function sanitizeAndFormat(source: string): {
    ok: boolean;
    output: string;
    steps: SanitizeStep[];
    parse_error?: string;
} {
    const { source: clean, steps } = sanitizeAgentSource(source);
    try {
        const mod = parse(clean);
        const formatted = formatModule(mod);
        if (formatted !== clean) {
            steps.push("formatted");
        }
        return { ok: true, output: formatted, steps };
    } catch (e) {
        const msg =
            e instanceof ImolSyntaxError
                ? `${e.code}: ${e.message}`
                : e instanceof Error
                  ? e.message
                  : String(e);
        return { ok: false, output: clean, steps, parse_error: msg };
    }
}
