import { buildDeclIndex, findDeclIdForSpan, type ModuleDecl } from "@kmfarris/imol-syntax";
import type { Diagnostic } from "./diagnostic.js";

export type DiagnosticJson = {
    code: string;
    message: string;
    hint?: string;
    span: { line: number; col: number; start: number; end: number };
    decl_id?: string;
};

export function diagnosticsToJson(diags: Diagnostic[]): DiagnosticJson[] {
    return diags.map((d) => ({
        code: d.code,
        message: d.message,
        ...(d.hint ? { hint: d.hint } : {}),
        span: {
            line: d.span.line,
            col: d.span.col,
            start: d.span.start,
            end: d.span.end,
        },
        ...(d.decl_id ? { decl_id: d.decl_id } : {}),
    }));
}

export function attachDeclIds(mod: ModuleDecl, diags: Diagnostic[]): Diagnostic[] {
    const index = buildDeclIndex(mod);
    return diags.map((d) => {
        const decl_id = findDeclIdForSpan(index, d.span);
        return decl_id ? { ...d, decl_id } : d;
    });
}
