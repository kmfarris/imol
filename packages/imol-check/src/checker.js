import { CheckResult } from "./diagnostic.js";
function resolveType(expr, aliases) {
    switch (expr.kind) {
        case "named": {
            const b = builtin(expr.name);
            if (b)
                return b;
            const a = aliases.get(expr.name);
            if (!a)
                return { kind: "named", name: expr.name };
            return a;
        }
        case "record": {
            const fields = new Map();
            for (const f of expr.fields) {
                fields.set(f.name, resolveType(f.type, aliases));
            }
            return { kind: "record", fields };
        }
        case "sum": {
            const variants = new Map();
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
function builtin(name) {
    switch (name) {
        case "Unit":
            return { kind: "unit" };
        case "Bool":
            return { kind: "bool" };
        case "Int":
            return { kind: "int" };
        case "Text":
            return { kind: "text" };
        default:
            return undefined;
    }
}
function typeToString(t) {
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
function typesEqual(a, b) {
    if (a.kind !== b.kind)
        return false;
    switch (a.kind) {
        case "unit":
        case "bool":
        case "int":
        case "text":
            return true;
        case "named":
            return b.kind === "named" && a.name === b.name;
        case "record": {
            if (b.kind !== "record" || a.fields.size !== b.fields.size)
                return false;
            for (const [k, v] of a.fields) {
                const bv = b.fields.get(k);
                if (!bv || !typesEqual(v, bv))
                    return false;
            }
            return true;
        }
        case "sum": {
            if (b.kind !== "sum" || a.variants.size !== b.variants.size)
                return false;
            for (const [k, v] of a.variants) {
                if (!b.variants.has(k))
                    return false;
                const bp = b.variants.get(k);
                if (v === undefined && bp === undefined)
                    continue;
                if (!v || !bp || !typesEqual(v, bp))
                    return false;
            }
            return true;
        }
    }
}
function effectFromAttrs(attrs) {
    for (const a of attrs) {
        if (a.name === "@pure")
            return "pure";
        if (a.name === "@io")
            return "io";
        if (a.name === "@net")
            return "net";
        if (a.name === "@unsafe")
            return "unsafe";
    }
    return "pure";
}
function maxEffect(a, b) {
    const order = ["pure", "io", "net", "unsafe"];
    return order[Math.max(order.indexOf(a), order.indexOf(b))] ?? "unsafe";
}
export function checkModule(mod, options = {}) {
    const diags = [];
    let hasHoles = false;
    const aliases = new Map();
    for (const td of mod.types) {
        aliases.set(td.name, resolveType(td.definition, aliases));
    }
    const tools = new Map();
    for (const tool of mod.tools) {
        tools.set(tool.name, {
            input: resolveType(tool.inputType, aliases),
            output: resolveType(tool.outputType, aliases),
            effect: effectFromAttrs(tool.attrs),
            from: tool.from,
        });
    }
    const imports = new Map();
    for (const imp of mod.imports) {
        imports.set(imp.alias ?? imp.path.split(".").pop() ?? imp.path, imp.path);
    }
    function checkFunction(fn) {
        const fnEffect = effectFromAttrs(fn.attrs);
        const env = new Map();
        for (const p of fn.params) {
            env.set(p.name, resolveType(p.type, aliases));
        }
        const ret = resolveType(fn.returnType, aliases);
        let bodyEffect = "pure";
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
    function checkStmt(stmt, env, ret, fnEffect) {
        let effect = "pure";
        let hasHolesLocal = false;
        switch (stmt.kind) {
            case "let": {
                const t = checkExpr(stmt.value, env);
                effect = maxEffect(effect, t.effect);
                hasHolesLocal = t.hasHoles;
                const expected = stmt.type ? resolveType(stmt.type, aliases) : t.type;
                if (!typesEqual(t.type, expected)) {
                    diags.push({
                        code: "E_TYPE",
                        message: `let ${stmt.name}: expected ${typeToString(expected)}, got ${typeToString(t.type)}`,
                        span: stmt.span,
                        hint: "Adjust the binding or add an explicit type.",
                    });
                }
                env.set(stmt.name, expected);
                break;
            }
            case "return": {
                const t = checkExpr(stmt.value, env);
                effect = t.effect;
                hasHolesLocal = t.hasHoles;
                if (!typesEqual(t.type, ret)) {
                    diags.push({
                        code: "E_RETURN",
                        message: `return: expected ${typeToString(ret)}, got ${typeToString(t.type)}`,
                        span: stmt.span,
                    });
                }
                break;
            }
            case "expr": {
                const t = checkExpr(stmt.value, env);
                effect = t.effect;
                hasHolesLocal = t.hasHoles;
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
    function effectRank(e) {
        return { pure: 0, io: 1, net: 2, unsafe: 3 }[e];
    }
    function checkExpr(expr, env) {
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
                const fields = new Map();
                let effect = "pure";
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
                const callee = checkExpr(expr.callee, env);
                let effect = callee.effect;
                const argTypes = [];
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
                const s = checkExpr(expr.scrutinee, env);
                if (s.type.kind !== "sum") {
                    diags.push({ code: "E_MATCH", message: "match scrutinee must be a sum type", span: expr.span });
                }
                let armType;
                const covered = new Set();
                let effect = s.effect;
                for (const arm of expr.arms) {
                    const envArm = new Map(env);
                    bindPattern(arm.pattern, s.type, envArm, diags);
                    if (arm.pattern.kind === "variant")
                        covered.add(arm.pattern.name);
                    const b = checkExpr(arm.body, envArm);
                    effect = maxEffect(effect, b.effect);
                    if (!armType)
                        armType = b.type;
                    else if (!typesEqual(armType, b.type)) {
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
                return { type: { kind: "unit" }, effect: m.effect, hasHoles: m.hasHoles };
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
    function bindPattern(p, scr, env, diags) {
        if (p.kind === "wildcard")
            return;
        if (scr.kind !== "sum")
            return;
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
    for (const fn of mod.functions) {
        checkFunction(fn);
    }
    const ok = diags.filter((d) => d.code.startsWith("E_")).length === 0 && (options.allowHoles || !hasHoles);
    return new CheckResult(ok, diags, hasHoles);
}
//# sourceMappingURL=checker.js.map