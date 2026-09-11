import type { Span } from "./ast.js";
export declare class ImolSyntaxError extends Error {
    readonly span: Span;
    readonly code = "E_SYNTAX";
    constructor(message: string, span: Span);
}
export declare function spanAt(source: string, index: number): Span;
//# sourceMappingURL=errors.d.ts.map