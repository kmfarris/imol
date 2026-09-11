export type TokenKind = "module" | "workshop" | "tool" | "from" | "import" | "as" | "type" | "function" | "let" | "return" | "if" | "match" | "invoke" | "end" | "hole" | "fail" | "bind" | "allow_net" | "true" | "false" | "at" | "arrow" | "lparen" | "rparen" | "lbrace" | "rbrace" | "comma" | "colon" | "dot" | "pipe" | "eq" | "eqeq" | "plusplus" | "ident" | "int" | "text" | "text_block" | "eof";
export type Token = {
    kind: TokenKind;
    lexeme: string;
    span: {
        start: number;
        end: number;
        line: number;
        col: number;
    };
};
export declare function lex(source: string): Token[];
//# sourceMappingURL=lexer.d.ts.map