export type Span = { start: number; end: number; line: number; col: number };

export type Effect = "pure" | "io" | "net" | "unsafe";

export type Attribute = {
    name: string;
    args: string[];
    span: Span;
};

export type TypeExpr =
    | { kind: "named"; name: string; span: Span }
    | { kind: "record"; fields: { name: string; type: TypeExpr }[]; span: Span }
    | { kind: "sum"; variants: { name: string; payload?: TypeExpr }[]; span: Span }
    | { kind: "result"; ok: TypeExpr; err: TypeExpr; span: Span };

export type Expr =
    | { kind: "int"; value: number; span: Span }
    | { kind: "text"; value: string; span: Span }
    | { kind: "bool"; value: boolean; span: Span }
    | { kind: "unit"; span: Span }
    | { kind: "ident"; name: string; span: Span }
    | { kind: "field"; object: Expr; field: string; span: Span }
    | { kind: "record"; fields: { name: string; value: Expr }[]; span: Span }
    | { kind: "variant"; name: string; payload?: Expr; span: Span }
    | { kind: "call"; callee: Expr; args: Expr[]; span: Span }
    | { kind: "invoke"; tool: string; fields: { name: string; value: Expr }[]; span: Span }
    | { kind: "binary"; op: "eq" | "concat"; left: Expr; right: Expr; span: Span }
    | { kind: "if"; cond: Expr; then: Expr; else: Expr; span: Span }
    | { kind: "match"; scrutinee: Expr; arms: MatchArm[]; span: Span }
    | { kind: "fail"; message: Expr; span: Span }
    | { kind: "hole"; name: string; reason: string; span: Span };

export type MatchArm = {
    pattern: Pattern;
    body: Expr;
    span: Span;
};

export type Pattern =
    | { kind: "variant"; name: string; bind?: string; span: Span }
    | { kind: "wildcard"; span: Span };

export type Stmt =
    | { kind: "let"; name: string; type?: TypeExpr; value: Expr; span: Span }
    | { kind: "return"; value: Expr; span: Span }
    | { kind: "expr"; value: Expr; span: Span }
    | { kind: "if_block"; cond: Expr; then: Stmt[]; else: Stmt[]; span: Span };

export type FunctionDecl = {
    kind: "function";
    name: string;
    params: { name: string; type: TypeExpr }[];
    returnType: TypeExpr;
    body: Stmt[];
    attrs: Attribute[];
    span: Span;
};

export type TypeDecl = {
    kind: "type";
    name: string;
    definition: TypeExpr;
    span: Span;
};

export type ToolDecl = {
    kind: "tool";
    name: string;
    from: string;
    inputType: TypeExpr;
    outputType: TypeExpr;
    attrs: Attribute[];
    span: Span;
};

export type ImportDecl = {
    kind: "import";
    path: string;
    alias?: string;
    span: Span;
};

export type WorkshopDecl = {
    kind: "workshop";
    allowNet: boolean;
    binds: string[];
    span: Span;
};

export type ModuleDecl = {
    kind: "module";
    name: string;
    attrs: Attribute[];
    workshop?: WorkshopDecl;
    imports: ImportDecl[];
    tools: ToolDecl[];
    types: TypeDecl[];
    functions: FunctionDecl[];
    span: Span;
};
