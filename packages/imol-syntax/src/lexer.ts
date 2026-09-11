import { ImolSyntaxError, spanAt } from "./errors.js";

export type TokenKind =
    | "module"
    | "workshop"
    | "tool"
    | "from"
    | "import"
    | "as"
    | "type"
    | "function"
    | "let"
    | "return"
    | "if"
    | "match"
    | "invoke"
    | "end"
    | "else"
    | "hole"
    | "fail"
    | "bind"
    | "allow_net"
    | "true"
    | "false"
    | "at"
    | "arrow"
    | "lparen"
    | "rparen"
    | "lbrace"
    | "rbrace"
    | "comma"
    | "colon"
    | "dot"
    | "pipe"
    | "eq"
    | "eqeq"
    | "plusplus"
    | "ident"
    | "int"
    | "text"
    | "text_block"
    | "eof";

export type Token = {
    kind: TokenKind;
    lexeme: string;
    span: { start: number; end: number; line: number; col: number };
};

const KEYWORDS: Record<string, TokenKind> = {
    module: "module",
    workshop: "workshop",
    tool: "tool",
    from: "from",
    import: "import",
    as: "as",
    type: "type",
    function: "function",
    let: "let",
    return: "return",
    if: "if",
    match: "match",
    invoke: "invoke",
    end: "end",
    else: "else",
    hole: "hole",
    fail: "fail",
    bind: "bind",
    allow_net: "allow_net",
    true: "true",
    false: "false",
};

export function lex(source: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    const peek = (n = 0) => source[i + n] ?? "";
    const advance = () => source[i++] ?? "";

    while (i < source.length) {
        const start = i;
        const c = peek();

        if (c === " " || c === "\t" || c === "\r" || c === "\n") {
            advance();
            continue;
        }
        if (c === "#") {
            while (i < source.length && peek() !== "\n") advance();
            continue;
        }

        if (c === "@" && peek(1) === "i" && source.slice(i, i + 3) === "@id") {
            i += 3;
            tokens.push({ kind: "at", lexeme: "@id", span: spanAt(source, start) });
            continue;
        }
        if (c === "@") {
            advance();
            let name = "@";
            while (/[a-zA-Z_]/.test(peek())) name += advance();
            tokens.push({ kind: "at", lexeme: name, span: spanAt(source, start) });
            continue;
        }

        if (c === '"' && peek(1) === '"' && peek(2) === '"') {
            i += 3;
            let value = "";
            while (i < source.length) {
                if (peek() === '"' && peek(1) === '"' && peek(2) === '"') {
                    i += 3;
                    break;
                }
                value += advance();
            }
            tokens.push({
                kind: "text_block",
                lexeme: value,
                span: { ...spanAt(source, start), end: i },
            });
            continue;
        }

        if (c === '"') {
            advance();
            let value = "";
            while (i < source.length && peek() !== '"') {
                if (peek() === "\\") {
                    advance();
                    const esc = advance();
                    value +=
                        esc === "n"
                            ? "\n"
                            : esc === "t"
                              ? "\t"
                              : esc === '"'
                                ? '"'
                                : esc;
                } else {
                    value += advance();
                }
            }
            if (peek() === '"') advance();
            tokens.push({
                kind: "text",
                lexeme: value,
                span: { ...spanAt(source, start), end: i },
            });
            continue;
        }

        if (/[0-9]/.test(c)) {
            let num = "";
            while (/[0-9]/.test(peek())) num += advance();
            tokens.push({
                kind: "int",
                lexeme: num,
                span: { ...spanAt(source, start), end: i },
            });
            continue;
        }

        if (/[a-zA-Z_]/.test(c)) {
            let id = "";
            while (/[a-zA-Z0-9_]/.test(peek())) id += advance();
            const kw = KEYWORDS[id];
            tokens.push({
                kind: kw ?? "ident",
                lexeme: id,
                span: { ...spanAt(source, start), end: i },
            });
            continue;
        }

        if (c === "-" && peek(1) === ">") {
            i += 2;
            tokens.push({ kind: "arrow", lexeme: "->", span: spanAt(source, start) });
            continue;
        }
        if (c === "=" && peek(1) === "=") {
            i += 2;
            tokens.push({ kind: "eqeq", lexeme: "==", span: spanAt(source, start) });
            continue;
        }
        if (c === "=") {
            advance();
            tokens.push({ kind: "eq", lexeme: "=", span: spanAt(source, start) });
            continue;
        }
        if (c === "+" && peek(1) === "+") {
            i += 2;
            tokens.push({ kind: "plusplus", lexeme: "++", span: spanAt(source, start) });
            continue;
        }

        const singles: Record<string, TokenKind> = {
            "(": "lparen",
            ")": "rparen",
            "{": "lbrace",
            "}": "rbrace",
            ",": "comma",
            ":": "colon",
            ".": "dot",
            "|": "pipe",
        };
        if (singles[c]) {
            advance();
            tokens.push({ kind: singles[c]!, lexeme: c, span: spanAt(source, start) });
            continue;
        }

        throw new ImolSyntaxError(`Unexpected character '${c}'`, spanAt(source, start));
    }

    tokens.push({
        kind: "eof",
        lexeme: "",
        span: spanAt(source, i),
    });
    return tokens;
}
