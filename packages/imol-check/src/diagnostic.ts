import type { Span } from "@imol/syntax";

export type Diagnostic = {
    code: string;
    message: string;
    span: Span;
    hint?: string;
};

export class CheckResult {
    constructor(
        readonly ok: boolean,
        readonly diagnostics: Diagnostic[],
        readonly hasHoles: boolean,
    ) {}
}
