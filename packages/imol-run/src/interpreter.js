import { valueToString } from "./value.js";
export class ImolRuntimeError extends Error {
    constructor(message) {
        super(message);
        this.name = "ImolRuntimeError";
    }
}
export async function runModule(mod, externs, options = {}) {
    const fns = new Map();
    for (const f of mod.functions) {
        fns.set(f.name, f);
    }
    const tools = new Map(mod.tools.map((t) => [t.name, t]));
    const main = fns.get("main");
    if (!main) {
        throw new ImolRuntimeError("No function main() found");
    }
    return evalFunction(main, fns, tools, externs, options, new Map(), []);
}
async function evalFunction(fn, fns, tools, externs, options, closure, args) {
    const env = new Map(closure);
    fn.params.forEach((p, i) => {
        const v = args[i];
        if (!v) {
            throw new ImolRuntimeError(`Missing argument ${p.name}`);
        }
        env.set(p.name, v);
    });
    for (const stmt of fn.body) {
        const r = await evalStmt(stmt, env, fns, tools, externs, options, fn);
        if (r.type === "return") {
            return r.value;
        }
    }
    return { kind: "unit" };
}
async function evalStmt(stmt, env, fns, tools, externs, options, fn) {
    switch (stmt.kind) {
        case "if_block": {
            const c = await evalExpr(stmt.cond, env, fns, tools, externs, options);
            if (c.kind !== "bool")
                throw new ImolRuntimeError("if condition must be Bool");
            const branch = c.value ? stmt.then : stmt.else;
            for (const s of branch) {
                const r = await evalStmt(s, env, fns, tools, externs, options, fn);
                if (r.type === "return")
                    return r;
            }
            return { type: "normal", value: { kind: "unit" } };
        }
        case "let": {
            const v = await evalExpr(stmt.value, env, fns, tools, externs, options);
            env.set(stmt.name, v);
            return { type: "normal", value: v };
        }
        case "return":
            return {
                type: "return",
                value: await evalExpr(stmt.value, env, fns, tools, externs, options),
            };
        case "expr":
            return {
                type: "normal",
                value: await evalExpr(stmt.value, env, fns, tools, externs, options),
            };
    }
}
async function evalExpr(expr, env, fns, tools, externs, options) {
    switch (expr.kind) {
        case "int":
            return { kind: "int", value: expr.value };
        case "text":
            return { kind: "text", value: expr.value };
        case "bool":
            return { kind: "bool", value: expr.value };
        case "unit":
            return { kind: "unit" };
        case "hole":
            throw new ImolRuntimeError(`Cannot run program with open hole ${expr.name}`);
        case "ident": {
            const v = env.get(expr.name);
            if (!v)
                throw new ImolRuntimeError(`Unbound ${expr.name}`);
            return v;
        }
        case "field":
            throw new ImolRuntimeError("Bare field access cannot be evaluated");
        case "record": {
            const fields = new Map();
            for (const f of expr.fields) {
                fields.set(f.name, await evalExpr(f.value, env, fns, tools, externs, options));
            }
            return { kind: "record", fields };
        }
        case "variant":
            return {
                kind: "variant",
                name: expr.name,
                payload: expr.payload
                    ? await evalExpr(expr.payload, env, fns, tools, externs, options)
                    : undefined,
            };
        case "binary": {
            const l = await evalExpr(expr.left, env, fns, tools, externs, options);
            const r = await evalExpr(expr.right, env, fns, tools, externs, options);
            if (expr.op === "concat") {
                if (l.kind !== "text" || r.kind !== "text") {
                    throw new ImolRuntimeError("++ requires Text");
                }
                return { kind: "text", value: l.value + r.value };
            }
            if (l.kind === "text" && r.kind === "text") {
                return { kind: "bool", value: l.value === r.value };
            }
            if (l.kind === "int" && r.kind === "int") {
                return { kind: "bool", value: l.value === r.value };
            }
            if (l.kind === "bool" && r.kind === "bool") {
                return { kind: "bool", value: l.value === r.value };
            }
            return { kind: "bool", value: false };
        }
        case "if": {
            const c = await evalExpr(expr.cond, env, fns, tools, externs, options);
            if (c.kind !== "bool")
                throw new ImolRuntimeError("if condition must be Bool");
            return c.value
                ? evalExpr(expr.then, env, fns, tools, externs, options)
                : evalExpr(expr.else, env, fns, tools, externs, options);
        }
        case "match": {
            const s = await evalExpr(expr.scrutinee, env, fns, tools, externs, options);
            if (s.kind !== "variant")
                throw new ImolRuntimeError("match on non-variant");
            for (const arm of expr.arms) {
                if (arm.pattern.kind === "wildcard") {
                    return evalExpr(arm.body, env, fns, tools, externs, options);
                }
                if (arm.pattern.kind === "variant" && arm.pattern.name === s.name) {
                    const env2 = new Map(env);
                    if (arm.pattern.bind && s.payload) {
                        env2.set(arm.pattern.bind, s.payload);
                    }
                    return evalExpr(arm.body, env2, fns, tools, externs, options);
                }
            }
            throw new ImolRuntimeError(`No match arm for ${s.name}`);
        }
        case "fail": {
            const m = await evalExpr(expr.message, env, fns, tools, externs, options);
            throw new ImolRuntimeError(m.kind === "text" ? m.value : valueToString(m));
        }
        case "call":
            return evalCall(expr.callee, expr.args, env, fns, tools, externs, options);
        case "invoke": {
            const tool = tools.get(expr.tool);
            if (!tool)
                throw new ImolRuntimeError(`Unknown tool ${expr.tool}`);
            const fields = new Map();
            for (const f of expr.fields) {
                fields.set(f.name, await evalExpr(f.value, env, fns, tools, externs, options));
            }
            const argRecord = { kind: "record", fields };
            options.onTrace?.({
                kind: "invoke",
                name: expr.tool,
                dryRun: options.dryRun ?? false,
                detail: tool.from,
            });
            if (options.dryRun) {
                return { kind: "variant", name: "Ok", payload: { kind: "text", value: "" } };
            }
            const handler = externs.get(tool.from);
            if (!handler) {
                throw new ImolRuntimeError(`No extern registered for ${tool.from}`);
            }
            options.onTrace?.({ kind: "extern", name: tool.from, dryRun: false });
            return handler([argRecord]);
        }
    }
}
async function evalCall(callee, args, env, fns, tools, externs, options) {
    if (callee.kind === "field" && callee.field === "println") {
        const arg = args[0] ? await evalExpr(args[0], env, fns, tools, externs, options) : { kind: "unit" };
        const text = arg.kind === "text" ? arg.value : valueToString(arg);
        options.onTrace?.({ kind: "io", name: "println", dryRun: options.dryRun ?? false, detail: text });
        if (!options.dryRun) {
            console.log(text);
        }
        return { kind: "variant", name: "Ok", payload: { kind: "unit" } };
    }
    throw new ImolRuntimeError("Unsupported call");
}
//# sourceMappingURL=interpreter.js.map