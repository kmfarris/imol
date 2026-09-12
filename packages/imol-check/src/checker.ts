import type {
    Attribute,
    Effect,
    Expr,
    FunctionDecl,
    ModuleDecl,
    Pattern,
    Stmt,
    TypeExpr,
} from "@imol/syntax";
import { isExternAllowed, isKnownExternKey } from "@imol/syntax";
import { attachDeclIds } from "./enrich.js";
import { CheckResult, type Diagnostic } from "./diagnostic.js";

type Type =
    | { kind: "unit" }
    | { kind: "bool" }
    | { kind: "int" }
    | { kind: "text" }
    | { kind: "named"; name: string }
    | { kind: "record"; fields: Map<string, Type> }
    | { kind: "sum"; variants: Map<string, Type | undefined> };

function resolveType(expr: TypeExpr, aliases: Map<string, Type>): Type {
    switch (expr.kind) {
        case "named": {
            const b = builtin(expr.name);
            if (b) return b;
            const a = aliases.get(expr.name);
            if (!a) return { kind: "named", name: expr.name };
            return a;
        }
        case "record": {
            const fields = new Map<string, Type>();
            for (const f of expr.fields) {
                fields.set(f.name, resolveType(f.type, aliases));
            }
            return { kind: "record", fields };
        }
        case "sum": {
            const variants = new Map<string, Type | undefined>();
            for (const v of expr.variants) {
                variants.set(v.name, v.payload ? resolveType(v.payload, aliases) : undefined);
            }
            return { kind: "sum", variants };
        }
        case "result":
            return {
                kind: "sum",
                variants: new Map([
                    ["Ok", resolveType(expr.ok, aliases)],
                    ["Err", resolveType(expr.err, aliases)],
                ]),
            };
    }
}

function builtin(name: string): Type | undefined {
    switch (name) {
        case "Unit":
            return { kind: "unit" };
        case "Bool":
            return { kind: "bool" };
        case "Int":
            return { kind: "int" };
        case "Text":
            return { kind: "text" };
        case "Never":
            return { kind: "named", name: "Never" };
        default:
            return undefined;
    }
}

function typeToString(t: Type): string {
    switch (t.kind) {
        case "unit":
            return "Unit";
        case "bool":
            return "Bool";
        case "int":
            return "Int";
        case "text":
            return "Text";
        case "named":
            return t.name;
        case "record":
            return "{ ... }";
        case "sum":
            return "Sum";
    }
}

function isNever(t: Type): boolean {
    return t.kind === "named" && t.name === "Never";
}

function typeCompatible(expected: Type, got: Type): boolean {
    if (isNever(got)) return true;
    return typesEqual(expected, got);
}

function matchArmTypesAgree(a: Type, b: Type): boolean {
    if (isNever(a) || isNever(b)) return true;
    return typesEqual(a, b);
}

function typesEqual(a: Type, b: Type): boolean {
    if (a.kind !== b.kind) return false;
    switch (a.kind) {
        case "unit":
        case "bool":
        case "int":
        case "text":
            return true;
        case "named":
            return b.kind === "named" && a.name === b.name;
        case "record": {
            if (b.kind !== "record" || a.fields.size !== b.fields.size) return false;
            for (const [k, v] of a.fields) {
                const bv = b.fields.get(k);
                if (!bv || !typesEqual(v, bv)) return false;
            }
            return true;
        }
        case "sum": {
            if (b.kind !== "sum" || a.variants.size !== b.variants.size) return false;
            for (const [k, v] of a.variants) {
                if (!b.variants.has(k)) return false;
                const bp = b.variants.get(k);
                if (v === undefined && bp === undefined) continue;
                if (!v || !bp || !typesEqual(v, bp)) return false;
            }
            return true;
        }
    }
}

function effectFromAttrs(attrs: Attribute[]): Effect {
    let effect: Effect = "pure";
    for (const a of attrs) {
        if (a.name === "@pure") effect = "pure";
        else if (a.name === "@io") effect = maxEffect(effect, "io");
        else if (a.name === "@net") effect = maxEffect(effect, "net");
        else if (a.name === "@unsafe") effect = maxEffect(effect, "unsafe");
    }
    return effect;
}

function maxEffect(a: Effect, b: Effect): Effect {
    const order: Effect[] = ["pure", "io", "net", "unsafe"];
    return order[Math.max(order.indexOf(a), order.indexOf(b))] ?? "unsafe";
}

export type CheckOptions = {
    allowHoles?: boolean;
};

function collectNameCollisions(mod: ModuleDecl, diags: Diagnostic[]): void {
    const groups: { items: { name: string; span: import("@imol/syntax").Span }[]; label: string }[] =
        [
            { items: mod.tools, label: "tool" },
            { items: mod.functions, label: "function" },
            { items: mod.types, label: "type" },
        ];
    for (const { items, label } of groups) {
        const seen = new Set<string>();
        for (const item of items) {
            if (seen.has(item.name)) {
                diags.push({
                    code: "E_IMPORT_COLLISION",
                    message: `Duplicate ${label} name '${item.name}'`,
                    span: item.span,
                    hint: "Rename declarations so imported names do not collide.",
                });
            }
            seen.add(item.name);
        }
    }
}

export function checkModule(mod: ModuleDecl, options: CheckOptions = {}): CheckResult {
    const diags: Diagnostic[] = [];
    let hasHoles = false;
    collectNameCollisions(mod, diags);
    const aliases = new Map<string, Type>();
    for (const td of mod.types) {
        aliases.set(td.name, resolveType(td.definition, aliases));
    }

    const tools = new Map<
        string,
        { input: Type; output: Type; effect: Effect; from: string }
    >();
    for (const tool of mod.tools) {
        tools.set(tool.name, {
            input: resolveType(tool.inputType, aliases),
            output: resolveType(tool.outputType, aliases),
            effect: effectFromAttrs(tool.attrs),
            from: tool.from,
        });
        if (!isKnownExternKey(tool.from)) {
            diags.push({
                code: "E_EXTERN",
                message: `Unknown extern key '${tool.from}' on tool ${tool.name}`,
                span: tool.span,
                hint: "Use std.fs.*, tools.filesystem.*, or mcp.* with bind tools.mcp.",
            });
        } else if (tool.from === "std.shell.exec" && mod.workshop && !mod.workshop.allowShell) {
            diags.push({
                code: "E_WORKSHOP",
                message: `Tool ${tool.name} uses std.shell.exec but workshop allow_shell is false`,
                span: tool.span,
                hint: "Set allow_shell true in workshop for shell tools.",
            });
        } else if (
            mod.workshop &&
            !isExternAllowed(tool.from, {
                binds: mod.workshop.binds,
                allowWrite: mod.workshop.allowWrite,
            })
        ) {
            diags.push({
                code: "E_EXTERN",
                message: `Extern '${tool.from}' not allowed by workshop bind list`,
                span: tool.span,
                hint: "Add bind std.fs (or matching prefix) to workshop.",
            });
        }
    }

    const imports = new Map<string, string>();
    for (const imp of mod.imports) {
        imports.set(imp.alias ?? imp.path.split(".").pop() ?? imp.path, imp.path);
    }

    const fnTypes = new Map<string, { params: Type[]; ret: Type; effect: Effect }>();
    for (const fn of mod.functions) {
        fnTypes.set(fn.name, {
            params: fn.params.map((p) => resolveType(p.type, aliases)),
            ret: resolveType(fn.returnType, aliases),
            effect: effectFromAttrs(fn.attrs),
        });
    }

    function checkStmt(
        stmt: Stmt,
        env: Map<string, Type>,
        ret: Type,
        fnEffect: Effect,
    ): { effect: Effect; hasHoles: boolean } {
        let effect: Effect = "pure";
        let hasHolesLocal = false;
        switch (stmt.kind) {
            case "let": {
                const expected = stmt.type
                    ? resolveType(stmt.type, aliases)
                    : undefined;
                const t = checkExpr(stmt.value, env, expected);
                effect = maxEffect(effect, t.effect);
                hasHolesLocal = t.hasHoles;
                const bound = expected ?? t.type;
                if (expected && !typeCompatible(expected, t.type)) {
                    diags.push({
                        code: "E_TYPE",
                        message: `let ${stmt.name}: expected ${typeToString(expected)}, got ${typeToString(t.type)}`,
                        span: stmt.span,
                        hint: "Adjust the binding or add an explicit type.",
                    });
                }
                env.set(stmt.name, bound);
                break;
            }
            case "return": {
                const t = checkExpr(stmt.value, env);
                effect = t.effect;
                hasHolesLocal = t.hasHoles;
                if (!typeCompatible(ret, t.type)) {
                    diags.push({
                        code: "E_RETURN",
                        message: `return: expected ${typeToString(ret)}, got ${typeToString(t.type)}`,
                        span: stmt.span,
                    });
                }
                break;
            }
            case "expr": {
                const t = checkExpr(stmt.value, env, ret);
                effect = t.effect;
                hasHolesLocal = t.hasHoles;
                break;
            }
            case "run_plan": {
                diags.push({
                    code: "W_RUN_PLAN",
                    message: "run plan requires workshop approval at runtime",
                    span: stmt.span,
                });
                break;
            }
            case "if_block": {
                const c = checkExpr(stmt.cond, env);
                if (!typesEqual(c.type, { kind: "bool" })) {
                    diags.push({
                        code: "E_IF",
                        message: "if condition must be Bool",
                        span: stmt.span,
                    });
                }
                effect = c.effect;
                for (const s of stmt.then) {
                    const r = checkStmt(s, env, ret, fnEffect);
                    effect = maxEffect(effect, r.effect);
                    hasHolesLocal ||= r.hasHoles;
                }
                for (const s of stmt.else) {
                    const r = checkStmt(s, env, ret, fnEffect);
                    effect = maxEffect(effect, r.effect);
                    hasHolesLocal ||= r.hasHoles;
                }
                break;
            }
        }
        if (effectRank(effect) > effectRank(fnEffect)) {
            diags.push({
                code: "E_EFFECT",
                message: `Function lacks ${effect} permission (has ${fnEffect})`,
                span: stmt.span,
                hint: "Add @io, @net, or @unsafe on the function.",
            });
        }
        return { effect, hasHoles: hasHolesLocal };
    }

    function effectRank(e: Effect): number {
        return { pure: 0, io: 1, net: 2, unsafe: 3 }[e];
    }

    function checkExpr(
        expr: Expr,
        env: Map<string, Type>,
        expected?: Type,
    ): { type: Type; effect: Effect; hasHoles: boolean } {
        switch (expr.kind) {
            case "int":
                return { type: { kind: "int" }, effect: "pure", hasHoles: false };
            case "text":
                return { type: { kind: "text" }, effect: "pure", hasHoles: false };
            case "bool":
                return { type: { kind: "bool" }, effect: "pure", hasHoles: false };
            case "unit":
                return { type: { kind: "unit" }, effect: "pure", hasHoles: false };
            case "hole":
                hasHoles = true;
                if (!options.allowHoles) {
                    diags.push({
                        code: "E_HOLE",
                        message: `Open hole ${expr.name}: ${expr.reason}`,
                        span: expr.span,
                    });
                }
                return { type: { kind: "unit" }, effect: "pure", hasHoles: true };
            case "ident": {
                if (fnTypes.has(expr.name)) {
                    return { type: fnTypes.get(expr.name)!.ret, effect: "pure", hasHoles: false };
                }
                const t = env.get(expr.name) ?? aliases.get(expr.name);
                if (!t) {
                    diags.push({
                        code: "E_UNBOUND",
                        message: `Unknown identifier '${expr.name}'`,
                        span: expr.span,
                    });
                    return { type: { kind: "unit" }, effect: "pure", hasHoles: false };
                }
                return { type: t, effect: "pure", hasHoles: false };
            }
            case "field": {
                if (expr.object.kind === "ident" && expr.object.name === "io" && expr.field === "println") {
                    return {
                        type: {
                            kind: "sum",
                            variants: new Map([
                                ["Ok", { kind: "unit" }],
                                ["Err", { kind: "text" }],
                            ]),
                        },
                        effect: "io",
                        hasHoles: false,
                    };
                }
                const obj = checkExpr(expr.object, env);
                if (expr.field === "println" && obj.type.kind === "named") {
                    return {
                        type: {
                            kind: "sum",
                            variants: new Map([
                                ["Ok", { kind: "unit" }],
                                ["Err", { kind: "text" }],
                            ]),
                        },
                        effect: "io",
                        hasHoles: false,
                    };
                }
                return { type: { kind: "unit" }, effect: obj.effect, hasHoles: false };
            }
            case "record": {
                const fields = new Map<string, Type>();
                let effect: Effect = "pure";
                for (const f of expr.fields) {
                    const v = checkExpr(f.value, env);
                    effect = maxEffect(effect, v.effect);
                    fields.set(f.name, v.type);
                }
                return { type: { kind: "record", fields }, effect, hasHoles: false };
            }
            case "variant": {
                for (const t of aliases.values()) {
                    if (t.kind === "sum" && t.variants.has(expr.name)) {
                        const payload = t.variants.get(expr.name);
                        if (payload && expr.payload) {
                            const p = checkExpr(expr.payload, env);
                            if (!typesEqual(p.type, payload)) {
                                diags.push({
                                    code: "E_VARIANT",
                                    message: `${expr.name} payload mismatch`,
                                    span: expr.span,
                                });
                            }
                            return { type: t, effect: p.effect, hasHoles: p.hasHoles };
                        }
                        return { type: t, effect: "pure", hasHoles: false };
                    }
                }
                diags.push({
                    code: "E_VARIANT",
                    message: `Unknown variant ${expr.name}`,
                    span: expr.span,
                });
                return { type: { kind: "unit" }, effect: "pure", hasHoles: false };
            }
            case "call": {
                if (expr.callee.kind === "ident") {
                    const calleeName = expr.callee.name;
                    const sig = fnTypes.get(calleeName);
                    if (sig) {
                        let effect: Effect = sig.effect;
                        if (expr.args.length !== sig.params.length) {
                            diags.push({
                                code: "E_CALL",
                                message: `${calleeName} expects ${sig.params.length} arguments`,
                                span: expr.span,
                            });
                        }
                        expr.args.forEach((a, i) => {
                            const t = checkExpr(a, env);
                            effect = maxEffect(effect, t.effect);
                            const expected = sig.params[i];
                            if (expected && !typesEqual(t.type, expected)) {
                                diags.push({
                                    code: "E_CALL",
                                    message: `Argument ${i + 1} type mismatch in ${calleeName}`,
                                    span: expr.span,
                                });
                            }
                        });
                        return { type: sig.ret, effect, hasHoles: false };
                    }
                }
                const callee = checkExpr(expr.callee, env);
                let effect = callee.effect;
                const argTypes: Type[] = [];
                for (const a of expr.args) {
                    const t = checkExpr(a, env);
                    effect = maxEffect(effect, t.effect);
                    argTypes.push(t.type);
                }
                if (expr.callee.kind === "field" && expr.callee.field === "println") {
                    if (argTypes[0] && !typesEqual(argTypes[0], { kind: "text" })) {
                        diags.push({
                            code: "E_CALL",
                            message: "println expects Text",
                            span: expr.span,
                        });
                    }
                    return {
                        type: {
                            kind: "sum",
                            variants: new Map([
                                ["Ok", { kind: "unit" }],
                                ["Err", { kind: "text" }],
                            ]),
                        },
                        effect: "io",
                        hasHoles: false,
                    };
                }
                return { type: callee.type, effect, hasHoles: false };
            }
            case "binary": {
                const l = checkExpr(expr.left, env);
                const r = checkExpr(expr.right, env);
                if (expr.op === "concat") {
                    if (!typesEqual(l.type, { kind: "text" }) || !typesEqual(r.type, { kind: "text" })) {
                        diags.push({
                            code: "E_TYPE",
                            message: "++ requires Text on both sides",
                            span: expr.span,
                        });
                    }
                    return {
                        type: { kind: "text" },
                        effect: maxEffect(l.effect, r.effect),
                        hasHoles: l.hasHoles || r.hasHoles,
                    };
                }
                if (!typesEqual(l.type, r.type)) {
                    diags.push({
                        code: "E_TYPE",
                        message: "== requires matching types",
                        span: expr.span,
                    });
                }
                return {
                    type: { kind: "bool" },
                    effect: maxEffect(l.effect, r.effect),
                    hasHoles: l.hasHoles || r.hasHoles,
                };
            }
            case "if": {
                const c = checkExpr(expr.cond, env);
                const t = checkExpr(expr.then, env);
                const e = checkExpr(expr.else, env);
                if (!typesEqual(c.type, { kind: "bool" })) {
                    diags.push({ code: "E_IF", message: "if condition must be Bool", span: expr.span });
                }
                if (!typesEqual(t.type, e.type)) {
                    diags.push({
                        code: "E_IF",
                        message: "if branches must have the same type",
                        span: expr.span,
                    });
                }
                return {
                    type: t.type,
                    effect: maxEffect(c.effect, maxEffect(t.effect, e.effect)),
                    hasHoles: c.hasHoles || t.hasHoles || e.hasHoles,
                };
            }
            case "match": {
                const s = checkExpr(expr.scrutinee, env, expected);
                if (s.type.kind !== "sum") {
                    diags.push({ code: "E_MATCH", message: "match scrutinee must be a sum type", span: expr.span });
                }
                let armType: Type | undefined;
                const covered = new Set<string>();
                let effect: Effect = s.effect;
                for (const arm of expr.arms) {
                    const envArm = new Map(env);
                    bindPattern(arm.pattern, s.type, envArm, diags);
                    if (arm.pattern.kind === "variant") covered.add(arm.pattern.name);
                    const b = checkExpr(arm.body, envArm, expected);
                    effect = maxEffect(effect, b.effect);
                    if (!armType) armType = b.type;
                    else if (!matchArmTypesAgree(armType, b.type)) {
                        diags.push({
                            code: "E_MATCH",
                            message: "match arms must agree on type",
                            span: arm.span,
                        });
                    }
                }
                if (s.type.kind === "sum") {
                    for (const v of s.type.variants.keys()) {
                        if (!covered.has(v)) {
                            diags.push({
                                code: "E_EXHAUST",
                                message: `match not exhaustive: missing ${v}`,
                                span: expr.span,
                            });
                        }
                    }
                }
                return {
                    type: armType ?? { kind: "unit" },
                    effect,
                    hasHoles: s.hasHoles,
                };
            }
            case "fail": {
                const m = checkExpr(expr.message, env);
                return {
                    type: { kind: "named", name: "Never" },
                    effect: m.effect,
                    hasHoles: m.hasHoles,
                };
            }
            case "invoke": {
                const tool = tools.get(expr.tool);
                if (!tool) {
                    diags.push({
                        code: "E_TOOL",
                        message: `Unknown tool '${expr.tool}'`,
                        span: expr.span,
                    });
                    return { type: { kind: "unit" }, effect: "pure", hasHoles: false };
                }
                if (tool.input.kind === "record") {
                    for (const [fname, ftype] of tool.input.fields) {
                        const field = expr.fields.find((f) => f.name === fname);
                        if (!field) {
                            diags.push({
                                code: "E_INVOKE",
                                message: `invoke ${expr.tool} missing field ${fname}`,
                                span: expr.span,
                            });
                            continue;
                        }
                        const v = checkExpr(field.value, env);
                        if (!typesEqual(v.type, ftype)) {
                            diags.push({
                                code: "E_INVOKE",
                                message: `invoke ${expr.tool}.${fname} type mismatch`,
                                span: expr.span,
                            });
                        }
                    }
                }
                return { type: tool.output, effect: tool.effect, hasHoles: false };
            }
        }
    }

    function bindPattern(p: Pattern, scr: Type, env: Map<string, Type>, diags: Diagnostic[]): void {
        if (p.kind === "wildcard") return;
        if (scr.kind !== "sum") return;
        const payload = scr.variants.get(p.name);
        if (payload === undefined && !scr.variants.has(p.name)) {
            diags.push({ code: "E_PATTERN", message: `Unknown variant ${p.name}`, span: p.span });
            return;
        }
        if (p.bind && payload) {
            env.set(p.bind, payload);
        }
    }

    if (mod.workshop?.allowNet) {
        /* policy recorded at runtime */
    }

    function checkFunction(fn: FunctionDecl): void {
        const fnEffect = effectFromAttrs(fn.attrs);
        const env = new Map<string, Type>();
        for (const p of fn.params) {
            env.set(p.name, resolveType(p.type, aliases));
        }
        const ret = resolveType(fn.returnType, aliases);
        let bodyEffect: Effect = "pure";

        for (const stmt of fn.body) {
            const r = checkStmt(stmt, env, ret, fnEffect);
            bodyEffect = maxEffect(bodyEffect, r.effect);
            hasHoles ||= r.hasHoles;
        }

        if (fn.name === "main" && fn.params.length === 0 && !typesEqual(ret, { kind: "unit" })) {
            diags.push({
                code: "W_MAIN_RET",
                message: "main() should return Unit for simple programs",
                span: fn.span,
            });
        }

        void bodyEffect;
    }

    for (const plan of mod.plans ?? []) {
        for (const inv of plan.invokes) {
            if (inv.kind !== "invoke") {
                diags.push({
                    code: "E_PLAN",
                    message: "Plan may only contain invoke expressions",
                    span: inv.span,
                });
                continue;
            }
            checkExpr(inv, new Map());
        }
    }

    for (const fn of mod.functions) {
        checkFunction(fn);
    }

    const ok = diags.filter((d) => d.code.startsWith("E_")).length === 0 && (options.allowHoles || !hasHoles);
    return new CheckResult(ok, attachDeclIds(mod, diags), hasHoles);
}
