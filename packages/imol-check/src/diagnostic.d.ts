import type { Span } from "@imol/syntax";
export type Diagnostic = {
    code: string;
    message: string;
    span: Span;
    hint?: string;
};
export declare class CheckResult {
    readonly ok: boolean;
    readonly diagnostics: Diagnostic[];
    readonly hasHoles: boolean;
    constructor(ok: boolean, diagnostics: Diagnostic[], hasHoles: boolean);
}
//# sourceMappingURL=diagnostic.d.ts.map