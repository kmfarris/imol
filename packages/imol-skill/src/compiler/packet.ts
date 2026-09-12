import type { Codeword } from "../types.js";

export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export function compilePacket(
    codewords: Codeword[],
    opts: { task?: string; file_snippet?: string; last_oracle_json?: string } = {},
): { packet: string; tool_policy: string[] } {
    const sections: string[] = [
        "# IMOL skill packet (Compiled Skill Dictionary)",
        "spec_version: 0.3",
        "",
    ];
    if (opts.task) {
        sections.push("## Task", opts.task, "");
    }
    if (opts.last_oracle_json) {
        sections.push("## Last oracle", "```json", opts.last_oracle_json.slice(0, 2000), "```", "");
    }
    if (opts.file_snippet) {
        sections.push("## File context", "```imol", opts.file_snippet.slice(0, 4000), "```", "");
    }
    sections.push("## Active skills");
    const policy = new Set<string>();
    for (const cw of codewords) {
        sections.push(`### ${cw.id}`, cw.expansion, "");
        for (const p of cw.tool_policy) {
            policy.add(p);
        }
    }
    if (policy.size) {
        sections.push("## Tool policy (mandatory)");
        for (const p of policy) {
            sections.push(`- ${p}`);
        }
        sections.push("");
    }
    return { packet: sections.join("\n").trimEnd(), tool_policy: [...policy] };
}
