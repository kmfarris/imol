import { ImolSyntaxError } from "./errors.js";
import { lex } from "./lexer.js";
export function parse(source) {
    const tokens = lex(source);
    const p = new Parser(tokens);
    return p.parseModule();
}
class Parser {
    tokens;
    pos = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    peek() {
        return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
    }
    advance() {
        return this.tokens[this.pos++] ?? this.peek();
    }
    at(kind) {
        return this.peek().kind === kind;
    }
    expect(kind, msg) {
        const t = this.peek();
        if (t.kind !== kind) {
            throw new ImolSyntaxError(`${msg} (got '${t.lexeme}')`, t.span);
        }
        return this.advance();
    }
    parseModule() {
        const start = this.peek().span;
        this.expect("module", "Expected 'module' at start of file");
        const nameTok = this.expect("ident", "Expected module name");
        const attrs = this.parseAttributes();
        let workshop;
        if (this.at("workshop")) {
            workshop = this.parseWorkshop();
        }
        const imports = [];
        const tools = [];
        const types = [];
        const functions = [];
        while (!this.at("eof")) {
            if (this.at("import"))
                imports.push(this.parseImport());
            else if (this.at("tool"))
                tools.push(this.parseTool());
            else if (this.at("type"))
                types.push(this.parseTypeDecl());
            else if (this.at("function"))
                functions.push(this.parseFunction());
            else {
                throw new ImolSyntaxError(`Unexpected token '${this.peek().lexeme}' at module level`, this.peek().span);
            }
        }
        return {
            kind: "module",
            name: nameTok.lexeme,
            attrs,
            workshop,
            imports,
            tools,
            types,
            functions,
            span: { ...start, end: nameTok.span.end },
        };
    }
    parseAttributes() {
        const attrs = [];
        while (this.at("at")) {
            const t = this.advance();
            const args = [];
            if (this.at("lparen")) {
                this.advance();
                const arg = this.at("text") || this.at("text_block")
                    ? this.advance()
                    : this.expect("text", "Expected string argument for attribute");
                args.push(arg.lexeme);
                this.expect("rparen", "Expected ')' after attribute argument");
            }
            attrs.push({ name: t.lexeme, args, span: t.span });
        }
        return attrs;
    }
    parseWorkshop() {
        const t = this.expect("workshop", "Expected 'workshop'");
        let allowNet = false;
        const binds = [];
        while (!this.at("end")) {
            if (this.at("allow_net")) {
                this.advance();
                if (this.at("true")) {
                    this.advance();
                    allowNet = true;
                }
                else if (this.at("false")) {
                    this.advance();
                    allowNet = false;
                }
                else {
                    throw new ImolSyntaxError("Expected true or false after allow_net", this.peek().span);
                }
            }
            else if (this.at("bind")) {
                this.advance();
                binds.push(this.expect("ident", "Expected bind path").lexeme);
            }
            else {
                throw new ImolSyntaxError("Expected allow_net, bind, or end in workshop", this.peek().span);
            }
        }
        this.expect("end", "Expected 'end' to close workshop");
        return { kind: "workshop", allowNet, binds, span: t.span };
    }
    parseImport() {
        const t = this.expect("import", "Expected 'import'");
        const path = this.expect("ident", "Expected import path").lexeme;
        let alias;
        if (this.at("as")) {
            this.advance();
            alias = this.expect("ident", "Expected import alias").lexeme;
        }
        return { kind: "import", path, alias, span: t.span };
    }
    parseTool() {
        const t = this.expect("tool", "Expected 'tool'");
        const name = this.expect("ident", "Expected tool name").lexeme;
        this.expect("from", "Expected 'from' after tool name");
        const from = this.expect("ident", "Expected tool source path").lexeme;
        const attrs = this.parseAttributes();
        let inputType = { kind: "record", fields: [], span: t.span };
        let outputType = { kind: "named", name: "Unit", span: t.span };
        if (this.at("lbrace")) {
            inputType = this.parseTypeExpr();
            if (this.at("arrow")) {
                this.advance();
                outputType = this.parseTypeExpr();
            }
        }
        return {
            kind: "tool",
            name,
            from,
            inputType,
            outputType,
            attrs,
            span: t.span,
        };
    }
    parseTypeDecl() {
        const t = this.expect("type", "Expected 'type'");
        const name = this.expect("ident", "Expected type name").lexeme;
        this.expect("eq", "Expected '=' in type declaration");
        const definition = this.parseTypeExpr();
        return { kind: "type", name, definition, span: t.span };
    }
    parseTypeExpr() {
        const start = this.peek().span;
        if (this.at("lbrace")) {
            return this.parseRecordType();
        }
        const first = this.expect("ident", "Expected type name");
        if (!this.at("pipe")) {
            return { kind: "named", name: first.lexeme, span: first.span };
        }
        const variants = [
            this.parseSumVariant(first.lexeme),
        ];
        while (this.at("pipe")) {
            this.advance();
            const vname = this.expect("ident", "Expected variant name").lexeme;
            variants.push(this.parseSumVariant(vname));
        }
        return { kind: "sum", variants, span: start };
    }
    parseSumVariant(name) {
        if (this.at("ident") || this.at("lbrace")) {
            return { name, payload: this.parseTypeAtom() };
        }
        return { name };
    }
    parseTypeAtom() {
        if (this.at("lbrace")) {
            return this.parseRecordType();
        }
        const t = this.expect("ident", "Expected type name");
        return { kind: "named", name: t.lexeme, span: t.span };
    }
    parseRecordType() {
        const start = this.expect("lbrace", "Expected '{'").span;
        const fields = [];
        while (!this.at("rbrace")) {
            const fname = this.expect("ident", "Expected field name").lexeme;
            if (this.at("colon"))
                this.advance();
            const ftype = this.parseTypeExpr();
            fields.push({ name: fname, type: ftype });
        }
        this.expect("rbrace", "Expected '}'");
        return { kind: "record", fields, span: start };
    }
    parseFunction() {
        const attrs = this.parseAttributes();
        const fnStart = this.expect("function", "Expected 'function'");
        const name = this.expect("ident", "Expected function name").lexeme;
        this.expect("lparen", "Expected '(' after function name");
        const params = [];
        if (!this.at("rparen")) {
            do {
                const pname = this.expect("ident", "Expected parameter name").lexeme;
                const ptype = this.parseTypeExpr();
                params.push({ name: pname, type: ptype });
                if (this.at("comma"))
                    this.advance();
                else
                    break;
            } while (!this.at("rparen"));
        }
        this.expect("rparen", "Expected ')' after parameters");
        this.expect("arrow", "Expected '->' before return type");
        const returnType = this.parseTypeExpr();
        const body = this.parseBlockStmts();
        this.expect("end", "Expected 'end' to close function");
        return {
            kind: "function",
            name,
            params,
            returnType,
            body,
            attrs,
            span: fnStart.span,
        };
    }
    parseBlockStmts() {
        const stmts = [];
        while (!this.at("end") && !this.at("eof")) {
            if (this.at("let")) {
                const t = this.advance();
                const name = this.expect("ident", "Expected let binding name").lexeme;
                let type;
                if (this.at("ident") && !this.at("true") && !this.at("false")) {
                    const la = this.peek().lexeme;
                    if (la[0] === la[0]?.toUpperCase()) {
                        type = this.parseTypeExpr();
                    }
                }
                const value = this.parseExpr();
                stmts.push({ kind: "let", name, type, value, span: t.span });
            }
            else if (this.at("return")) {
                const t = this.advance();
                stmts.push({ kind: "return", value: this.parseExpr(), span: t.span });
            }
            else if (this.at("if")) {
                const t = this.advance();
                const cond = this.parseExpr();
                const then = this.parseBlockStmts();
                this.expect("end", "Expected 'end' to close if");
                let elseStmts = [];
                if (this.at("else")) {
                    this.advance();
                    elseStmts = this.parseBlockStmts();
                    this.expect("end", "Expected 'end' to close else");
                }
                stmts.push({ kind: "if_block", cond, then, else: elseStmts, span: t.span });
            }
            else {
                stmts.push({ kind: "expr", value: this.parseExpr(), span: this.peek().span });
            }
        }
        return stmts;
    }
    parseExpr() {
        return this.parseMatchExpr();
    }
    parseMatchExpr() {
        if (this.at("match")) {
            const t = this.advance();
            const scrutinee = this.parsePrimary();
            const arms = [];
            while (!this.at("end")) {
                arms.push(this.parseMatchArm());
            }
            this.expect("end", "Expected 'end' to close match");
            return { kind: "match", scrutinee, arms, span: t.span };
        }
        return this.parseIfExpr();
    }
    parseMatchArm() {
        const start = this.peek().span;
        const pattern = this.parsePattern();
        this.expect("arrow", "Expected '->' in match arm");
        const body = this.parseExpr();
        return { pattern, body, span: start };
    }
    parsePattern() {
        if (this.at("ident") && this.peek().lexeme === "_") {
            const t = this.advance();
            return { kind: "wildcard", span: t.span };
        }
        const name = this.expect("ident", "Expected pattern variant").lexeme;
        let bind;
        if (this.at("ident")) {
            bind = this.advance().lexeme;
        }
        return { kind: "variant", name, bind, span: this.peek().span };
    }
    parseIfExpr() {
        if (this.at("if")) {
            const t = this.advance();
            const cond = this.parseExpr();
            const then = this.parseExpr();
            this.expect("end", "Expected 'end' after if branch");
            let elseExpr = { kind: "unit", span: t.span };
            if (this.at("else")) {
                this.advance();
                elseExpr = this.parseExpr();
                this.expect("end", "Expected 'end' to close else");
            }
            return { kind: "if", cond, then, else: elseExpr, span: t.span };
        }
        return this.parseBinary(0);
    }
    parseBinary(min) {
        let left = this.parsePrimary();
        while (this.at("eqeq") || this.at("plusplus")) {
            const op = this.advance();
            const right = this.parsePrimary();
            left = {
                kind: "binary",
                op: op.kind === "eqeq" ? "eq" : "concat",
                left,
                right,
                span: left.span,
            };
            void min;
        }
        return left;
    }
    parsePrimary() {
        if (this.at("invoke")) {
            const t = this.advance();
            const tool = this.expect("ident", "Expected tool name after invoke").lexeme;
            const fields = this.parseRecordFields();
            return { kind: "invoke", tool, fields, span: t.span };
        }
        if (this.at("hole")) {
            const t = this.advance();
            const name = this.expect("ident", "Expected hole name").lexeme;
            const reasonTok = this.at("text") || this.at("text_block") ? this.advance() : this.expect("text", "Expected hole reason string");
            return { kind: "hole", name, reason: reasonTok.lexeme, span: t.span };
        }
        if (this.at("fail")) {
            const t = this.advance();
            this.expect("lparen", "Expected '(' after fail");
            const message = this.parseExpr();
            this.expect("rparen", "Expected ')' after fail");
            return { kind: "fail", message, span: t.span };
        }
        if (this.at("int")) {
            const t = this.advance();
            return { kind: "int", value: Number(t.lexeme), span: t.span };
        }
        if (this.at("text") || this.at("text_block")) {
            const t = this.advance();
            return { kind: "text", value: t.lexeme, span: t.span };
        }
        if (this.at("true") || this.at("false")) {
            const t = this.advance();
            return { kind: "bool", value: t.lexeme === "true", span: t.span };
        }
        if (this.at("lbrace")) {
            const start = this.advance().span;
            const fields = this.parseRecordFieldsInner();
            return { kind: "record", fields, span: start };
        }
        if (this.at("ident")) {
            let expr = { kind: "ident", name: this.advance().lexeme, span: this.peek().span };
            while (this.at("dot")) {
                this.advance();
                const field = this.expect("ident", "Expected field name after '.'").lexeme;
                expr = { kind: "field", object: expr, field, span: expr.span };
            }
            if (this.at("lparen")) {
                this.advance();
                if (expr.kind === "ident" && /^[A-Z]/.test(expr.name)) {
                    const payload = this.at("rparen") ? undefined : this.parseExpr();
                    this.expect("rparen", "Expected ')' after variant");
                    return {
                        kind: "variant",
                        name: expr.name,
                        payload,
                        span: expr.span,
                    };
                }
                const args = [];
                if (!this.at("rparen")) {
                    do {
                        args.push(this.parseExpr());
                        if (this.at("comma"))
                            this.advance();
                        else
                            break;
                    } while (!this.at("rparen"));
                }
                this.expect("rparen", "Expected ')' after call");
                return { kind: "call", callee: expr, args, span: expr.span };
            }
            return expr;
        }
        if (this.at("lparen")) {
            this.advance();
            if (this.at("rparen")) {
                this.advance();
                return { kind: "unit", span: this.peek().span };
            }
            const e = this.parseExpr();
            this.expect("rparen", "Expected ')'");
            return e;
        }
        throw new ImolSyntaxError("Expected expression", this.peek().span);
    }
    parseRecordFields() {
        this.expect("lbrace", "Expected '{' after invoke");
        return this.parseRecordFieldsInner();
    }
    parseRecordFieldsInner() {
        const fields = [];
        while (!this.at("rbrace")) {
            const fname = this.expect("ident", "Expected field name").lexeme;
            if (this.at("colon"))
                this.advance();
            else if (this.at("eq"))
                this.advance();
            fields.push({ name: fname, value: this.parseExpr() });
            if (this.at("comma"))
                this.advance();
        }
        this.expect("rbrace", "Expected '}'");
        return fields;
    }
}
//# sourceMappingURL=parser.js.map