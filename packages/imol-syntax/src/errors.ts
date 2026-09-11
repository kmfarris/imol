import type { Span } from "./ast.js";

export class ImolSyntaxError extends Error {
    readonly code = "E_SYNTAX";
    constructor(
        message: string,
        readonly span: Span,
    ) {
        super(message);
        this.name = "ImolSyntaxError";
    }
}

export function spanAt(source: string, index: number): Span {
    let line = 1;
    let col = 1;
    for (let i = 0; i < index && i < source.length; i++) {
        if (source[i] === "\n") {
            line++;
            col = 1;
        } else {
            col++;
        }
    }
    return { start: index, end: index, line, col };
}
