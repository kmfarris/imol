import type {
    Attribute,
    Expr,
    FunctionDecl,
    ImportDecl,
    MatchArm,
    ModuleDecl,
    Pattern,
    Stmt,
    ToolDecl,
    TypeDecl,
    TypeExpr,
    PlanDecl,
    Span,
    WorkshopDecl,
} from "./ast.js";
import { ImolSyntaxError } from "./errors.js";
import { lex, type Token } from "./lexer.js";

export function parse(source: string): ModuleDecl {
    const tokens = lex(source);
    const p = new Parser(tokens);
    return p.parseModule();
}

class Parser {
    private pos = 0;

    constructor(private readonly tokens: Token[]) {}

    private peek(): Token {
        return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1]!;
    }

    private advance(): Token {
        return this.tokens[this.pos++] ?? this.peek();
    }

    private at(kind: Token["kind"]): boolean {
        return this.peek().kind === kind;
    }

    private expect(kind: Token["kind"], msg: string): Token {
        const t = this.peek();
        if (t.kind !== kind) {
            throw new ImolSyntaxError(`${msg} (got '${t.lexeme}')`, t.span);
        }
        return this.advance();
    }

    parseModule(): ModuleDecl {
        const start = this.peek().span;
        this.expect("module", "Expected 'module' at start of file");
        const nameTok = this.expect("ident", "Expected module name");
        const attrs: Attribute[] =
            this.at("at") && this.peek().span.line === nameTok.span.line
                ? this.parseAttributes()
                : [];

        let workshop: WorkshopDecl | undefined;
        if (this.at("workshop")) {
            workshop = this.parseWorkshop();
        }

        const imports: ImportDecl[] = [];
        const tools: ToolDecl[] = [];
        const types: TypeDecl[] = [];
        const functions: FunctionDecl[] = [];
        const plans: PlanDecl[] = [];

        while (!this.at("eof")) {
            if (this.at("import")) imports.push(this.parseImport());
            else if (this.at("plan")) plans.push(this.parsePlan());
            else if (this.at("tool")) tools.push(this.parseTool());
            else if (this.at("type")) types.push(this.parseTypeDecl());
            else if (this.at("at")) {
                const attrs = this.parseAttributes();
                if (this.at("type")) {
                    types.push(this.finishTypeDecl(attrs));
                } else {
                    functions.push(this.finishFunctionDecl(attrs));
                }
            } else if (this.at("function")) functions.push(this.parseFunction());
            else {
                throw new ImolSyntaxError(
                    `Unexpected token '${this.peek().lexeme}' at module level`,
                    this.peek().span,
                );
            }
        }

        return {
            kind: "module",
            name: nameTok.lexeme,
            attrs,
            ...(workshop ? { workshop } : {}),
            plans,
            imports,
            tools,
            types,
            functions,
            span: { ...start, end: nameTok.span.end },
        };
    }

    private parsePlan(): PlanDecl {
        const t = this.expect("plan", "Expected 'plan'");
        const invokes: Expr[] = [];
        while (!this.at("end")) {
            if (!this.at("invoke")) {
                throw new ImolSyntaxError("Plan body may only contain invoke expressions", this.peek().span);
            }
            invokes.push(this.parseExpr());
        }
        this.expect("end", "Expected 'end' to close plan");
        return { kind: "plan", invokes, span: t.span };
    }

    private parseAttributes(): Attribute[] {
        const attrs: Attribute[] = [];
        while (this.at("at")) {
            const t = this.advance();
            const args: string[] = [];
            if (this.at("lparen")) {
                this.advance();
                const arg =
                    this.at("text") || this.at("text_block")
                        ? this.advance()
                        : this.expect("text", "Expected string argument for attribute");
                args.push(arg.lexeme);
                this.expect("rparen", "Expected ')' after attribute argument");
            }
            attrs.push({ name: t.lexeme, args, span: t.span });
        }
        return attrs;
    }

    private parseWorkshop(): WorkshopDecl {
        const t = this.expect("workshop", "Expected 'workshop'");
        let allowNet = false;
        let allowWrite = false;
        let allowShell = false;
        const binds: string[] = [];
        while (!this.at("end")) {
            if (this.at("allow_net")) {
                this.advance();
                if (this.at("true")) {
                    this.advance();
                    allowNet = true;
                } else if (this.at("false")) {
                    this.advance();
                    allowNet = false;
                } else {
                    throw new ImolSyntaxError("Expected true or false after allow_net", this.peek().span);
                }
            } else if (this.at("allow_write")) {
                this.advance();
                if (this.at("true")) {
                    this.advance();
                    allowWrite = true;
                } else if (this.at("false")) {
                    this.advance();
                    allowWrite = false;
                } else {
                    throw new ImolSyntaxError("Expected true or false after allow_write", this.peek().span);
                }
            } else if (this.at("allow_shell")) {
                this.advance();
                if (this.at("true")) {
                    this.advance();
                    allowShell = true;
                } else if (this.at("false")) {
                    this.advance();
                    allowShell = false;
                } else {
                    throw new ImolSyntaxError("Expected true or false after allow_shell", this.peek().span);
                }
            } else if (this.at("bind")) {
                this.advance();
                binds.push(this.parseDottedPath());
            } else {
                throw new ImolSyntaxError(
                    "Expected allow_net, allow_write, allow_shell, bind, or end in workshop",
                    this.peek().span,
                );
            }
        }
        this.expect("end", "Expected 'end' to close workshop");
        return { kind: "workshop", allowNet, allowWrite, allowShell, binds, span: t.span };
    }

    private parseDottedPath(): string {
        let path = this.expect("ident", "Expected path").lexeme;
        while (this.at("dot")) {
            this.advance();
            path += `.${this.expect("ident", "Expected path segment").lexeme}`;
        }
        return path;
    }

    private parseImport(): ImportDecl {
        const t = this.expect("import", "Expected 'import'");
        const path = this.parseDottedPath();
        let alias: string | undefined;
        if (this.at("as")) {
            this.advance();
            alias = this.expect("ident", "Expected import alias").lexeme;
        }
        return {
            kind: "import",
            path,
            ...(alias ? { alias } : {}),
            span: t.span,
        };
    }

    private parseTool(): ToolDecl {
        const t = this.expect("tool", "Expected 'tool'");
        const name = this.expect("ident", "Expected tool name").lexeme;
        this.expect("from", "Expected 'from' after tool name");
        const from = this.parseDottedPath();
        const attrs = this.parseAttributes();
        let inputType: TypeExpr = { kind: "record", fields: [], span: t.span };
        let outputType: TypeExpr = { kind: "named", name: "Unit", span: t.span };
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

    private parseTypeDecl(): TypeDecl {
        return this.finishTypeDecl(this.parseAttributes());
    }

    private finishTypeDecl(attrs: Attribute[]): TypeDecl {
        const t = this.expect("type", "Expected 'type'");
        const name = this.expect("ident", "Expected type name").lexeme;
        this.expect("eq", "Expected '=' in type declaration");
        const definition = this.parseTypeExpr();
        const span: Span = attrs.length
            ? { ...attrs[0]!.span, end: definition.span.end }
            : { ...t.span, end: definition.span.end };
        return { kind: "type", name, definition, attrs, span };
    }

    private parseTypeExpr(): TypeExpr {
        const start = this.peek().span;
        if (this.at("lbrace")) {
            return this.parseRecordType();
        }
        const first = this.expect("ident", "Expected type name");
        const builtinTypes = new Set(["Unit", "Bool", "Int", "Text", "Result"]);
        if (builtinTypes.has(first.lexeme) && !this.at("pipe")) {
            return { kind: "named", name: first.lexeme, span: first.span };
        }
        const isVariantStart =
            /^[A-Z]/.test(first.lexeme) &&
            (this.at("pipe") ||
                this.at("lbrace") ||
                (this.at("ident") &&
                    !this.at("function") &&
                    !this.at("import") &&
                    !this.at("type") &&
                    !this.at("tool") &&
                    this.peek().lexeme !== "end"));
        if (isVariantStart) {
            const variants: { name: string; payload?: TypeExpr }[] = [
                this.parseSumVariant(first.lexeme),
            ];
            while (this.at("pipe")) {
                this.advance();
                const vname = this.expect("ident", "Expected variant name").lexeme;
                variants.push(this.parseSumVariant(vname));
            }
            return { kind: "sum", variants, span: start };
        }
        return { kind: "named", name: first.lexeme, span: first.span };
    }

    private parseSumVariant(name: string): { name: string; payload?: TypeExpr } {
        if (this.at("ident") || this.at("lbrace")) {
            const payload = this.parseTypeAtom();
            return { name, payload };
        }
        return { name };
    }

    private parseTypeAtom(): TypeExpr {
        if (this.at("lbrace")) {
            return this.parseRecordType();
        }
        const t = this.expect("ident", "Expected type name");
        return { kind: "named", name: t.lexeme, span: t.span };
    }

    private parseRecordType(): TypeExpr {
        const start = this.expect("lbrace", "Expected '{'").span;
        const fields: { name: string; type: TypeExpr }[] = [];
        while (!this.at("rbrace")) {
            const fname = this.expect("ident", "Expected field name").lexeme;
            if (this.at("colon")) this.advance();
            const ftype = this.parseTypeExpr();
            fields.push({ name: fname, type: ftype });
        }
        this.expect("rbrace", "Expected '}'");
        return { kind: "record", fields, span: start };
    }

    private parseFunction(): FunctionDecl {
        return this.finishFunctionDecl(this.parseAttributes());
    }

    private finishFunctionDecl(attrs: Attribute[]): FunctionDecl {
        const fnStart = this.expect("function", "Expected 'function'");
        const name = this.expect("ident", "Expected function name").lexeme;
        this.expect("lparen", "Expected '(' after function name");
        const params: { name: string; type: TypeExpr }[] = [];
        if (!this.at("rparen")) {
            do {
                const pname = this.expect("ident", "Expected parameter name").lexeme;
                const ptype = this.parseTypeExpr();
                params.push({ name: pname, type: ptype });
                if (this.at("comma")) this.advance();
                else break;
            } while (!this.at("rparen"));
        }
        this.expect("rparen", "Expected ')' after parameters");
        this.expect("arrow", "Expected '->' before return type");
        const returnType = this.parseTypeExpr();
        const body = this.parseBlockStmts();
        this.expect("end", "Expected 'end' to close function");
        const span: Span = attrs.length
            ? { ...attrs[0]!.span, end: body.length ? body[body.length - 1]!.span.end : fnStart.span.end }
            : { ...fnStart.span, end: body.length ? body[body.length - 1]!.span.end : fnStart.span.end };
        return {
            kind: "function",
            name,
            params,
            returnType,
            body,
            attrs,
            span,
        };
    }

    private parseBlockStmts(): Stmt[] {
        const stmts: Stmt[] = [];
        while (!this.at("end") && !this.at("eof")) {
            if (this.at("let")) {
                const t = this.advance();
                const name = this.expect("ident", "Expected let binding name").lexeme;
                let type: TypeExpr | undefined;
                if (this.at("ident") && !this.at("true") && !this.at("false")) {
                    const la = this.peek().lexeme;
                    if (la[0] === la[0]?.toUpperCase()) {
                        type = this.parseTypeExpr();
                    }
                }
                if (this.at("eq")) {
                    this.advance();
                }
                const value = this.parseExpr();
                stmts.push({
                    kind: "let",
                    name,
                    ...(type ? { type } : {}),
                    value,
                    span: t.span,
                });
            } else if (this.at("return")) {
                const t = this.advance();
                stmts.push({ kind: "return", value: this.parseExpr(), span: t.span });
            } else if (this.at("run")) {
                const t = this.advance();
                this.expect("plan", "Expected 'plan' after run");
                stmts.push({ kind: "run_plan", span: t.span });
            } else if (this.at("if")) {
                const t = this.advance();
                const cond = this.parseExpr();
                const then = this.parseBlockStmts();
                this.expect("end", "Expected 'end' to close if");
                let elseStmts: Stmt[] = [];
                if (this.at("else")) {
                    this.advance();
                    elseStmts = this.parseBlockStmts();
                    this.expect("end", "Expected 'end' to close else");
                }
                stmts.push({ kind: "if_block", cond, then, else: elseStmts, span: t.span });
            } else {
                stmts.push({ kind: "expr", value: this.parseExpr(), span: this.peek().span });
            }
        }
        return stmts;
    }

    private parseExpr(): Expr {
        return this.parseMatchExpr();
    }

    private parseMatchExpr(): Expr {
        if (this.at("match")) {
            const t = this.advance();
            const scrutinee = this.parsePrimary();
            const arms: MatchArm[] = [];
            while (!this.at("end")) {
                arms.push(this.parseMatchArm());
            }
            this.expect("end", "Expected 'end' to close match");
            return { kind: "match", scrutinee, arms, span: t.span };
        }
        return this.parseIfExpr();
    }

    private parseMatchArm(): MatchArm {
        const start = this.peek().span;
        const pattern = this.parsePattern();
        this.expect("arrow", "Expected '->' in match arm");
        const body = this.parseExpr();
        return { pattern, body, span: start };
    }

    private parsePattern(): Pattern {
        if (this.at("ident") && this.peek().lexeme === "_") {
            const t = this.advance();
            return { kind: "wildcard", span: t.span };
        }
        const name = this.expect("ident", "Expected pattern variant").lexeme;
        let bind: string | undefined;
        if (this.at("ident")) {
            bind = this.advance().lexeme;
        }
        return {
            kind: "variant",
            name,
            ...(bind ? { bind } : {}),
            span: this.peek().span,
        };
    }

    private parseIfExpr(): Expr {
        if (this.at("if")) {
            const t = this.advance();
            const cond = this.parseExpr();
            const then = this.parseExpr();
            this.expect("end", "Expected 'end' after if branch");
            let elseExpr: Expr = { kind: "unit", span: t.span };
            if (this.at("else")) {
                this.advance();
                elseExpr = this.parseExpr();
                this.expect("end", "Expected 'end' to close else");
            }
            return { kind: "if", cond, then, else: elseExpr, span: t.span };
        }
        return this.parseBinary(0);
    }

    private parseBinary(min: number): Expr {
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

    private parsePrimary(): Expr {
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
            let expr: Expr = { kind: "ident", name: this.advance().lexeme, span: this.peek().span };
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
                        ...(payload ? { payload } : {}),
                        span: expr.span,
                    };
                }
                const args: Expr[] = [];
                if (!this.at("rparen")) {
                    do {
                        args.push(this.parseExpr());
                        if (this.at("comma")) this.advance();
                        else break;
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

    private parseRecordFields(): { name: string; value: Expr }[] {
        this.expect("lbrace", "Expected '{' after invoke");
        return this.parseRecordFieldsInner();
    }

    private parseRecordFieldsInner(): { name: string; value: Expr }[] {
        const fields: { name: string; value: Expr }[] = [];
        while (!this.at("rbrace")) {
            const fname = this.expect("ident", "Expected field name").lexeme;
            if (this.at("colon")) this.advance();
            else if (this.at("eq")) this.advance();
            fields.push({ name: fname, value: this.parseExpr() });
            if (this.at("comma")) this.advance();
        }
        this.expect("rbrace", "Expected '}'");
        return fields;
    }
}
