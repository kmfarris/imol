export class ImolSyntaxError extends Error {
    span;
    code = "E_SYNTAX";
    constructor(message, span) {
        super(message);
        this.span = span;
        this.name = "ImolSyntaxError";
    }
}
export function spanAt(source, index) {
    let line = 1;
    let col = 1;
    for (let i = 0; i < index && i < source.length; i++) {
        if (source[i] === "\n") {
            line++;
            col = 1;
        }
        else {
            col++;
        }
    }
    return { start: index, end: index, line, col };
}
//# sourceMappingURL=errors.js.map