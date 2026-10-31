import type { Attribute, Expr, FunctionDecl, ModuleDecl, Stmt } from "@kmfarris/imol-syntax";
import type { Capabilities } from "./capabilities.js";
import type { ExternRegistry } from "./externs.js";
import { type Value, valueToString } from "./value.js";

export type RunOptions = {
    dryRun?: boolean;
    planApproved?: boolean;
    capabilities?: Capabilities;
    onTrace?: (entry: TraceEntry) => void;
};

export type TraceEntry = {
    ts: number;
    kind: "invoke" | "extern" | "io" | "async_scheduled" | "async_done";
    name: string;
    tool?: string;
    extern?: string;
    args_digest?: string;
    effect?: string;
    dry_run: boolean;
    result_kind?: string;
    detail?: string;
};

function effectFromAttrs(attrs: Attribute[]): string {
    for (const a of attrs) {
        if (a.name === "@net") return "net";
        if (a.name === "@unsafe") return "unsafe";
        if (a.name === "@io") return "io";
    }
    return "pure";
}

function digestRecord(fields: { name: string; value: Expr }[]): string {
    return fields.map((f) => f.name).sort().join(",");
}

function emitTrace(options: RunOptions, entry: Omit<TraceEntry, "ts" | "dry_run">): void {
    options.onTrace?.({
        ...entry,
        ts: Date.now(),
        dry_run: options.dryRun ?? false,
    });
}

function assertEffect(options: RunOptions, effect: string): void {
    const caps = options.capabilities;
    if (!caps) return;
    if (effect === "net" && !caps.net) {
        throw new ImolRuntimeError("effect net not allowed");
    }
    if (effect === "unsafe" && !caps.unsafe) {
        throw new ImolRuntimeError("effect unsafe not allowed");
    }
    if (effect === "io" && !caps.io) {
        throw new ImolRuntimeError("effect io not allowed");
    }
}

export class ImolRuntimeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ImolRuntimeError";
    }
}

function moduleMaps(mod: ModuleDecl): {
    fns: Map<string, FunctionDecl>;
    tools: Map<string, import("@kmfarris/imol-syntax").ToolDecl>;
} {
    const fns = new Map<string, FunctionDecl>();
    for (const f of mod.functions) {
        fns.set(f.name, f);
    }
    const tools = new Map(mod.tools.map((t) => [t.name, t]));
    return { fns, tools };
}

/** Dry-run plan invokes only (no main). Used by workshop plan-first flow. */
export async function runPlanDryRun(
    mod: ModuleDecl,
    externs: ExternRegistry,
    options: RunOptions = {},
): Promise<void> {
    const plan = mod.plans[0];
    if (!plan) {
        return;
    }
    const { fns, tools } = moduleMaps(mod);
    const env = new Map<string, Value>();
    const planOpts: RunOptions = { ...options, dryRun: true };
    for (const inv of plan.invokes) {
        await evalExpr(inv, env, mod, fns, tools, externs, planOpts);
    }
}

export async function runModule(
    mod: ModuleDecl,
    externs: ExternRegistry,
    options: RunOptions = {},
): Promise<Value> {
    const { fns, tools } = moduleMaps(mod);
    const main = fns.get("main");
    if (!main) {
        throw new ImolRuntimeError("No function main() found");
    }
    return evalFunction(main, mod, fns, tools, externs, options, new Map(), []);
}

async function evalFunction(
    fn: FunctionDecl,
    mod: ModuleDecl,
    fns: Map<string, FunctionDecl>,
    tools: Map<string, import("@kmfarris/imol-syntax").ToolDecl>,
    externs: ExternRegistry,
    options: RunOptions,
    closure: Map<string, Value>,
    args: Value[],
): Promise<Value> {
    const env = new Map(closure);
    fn.params.forEach((p, i) => {
        const v = args[i];
        if (!v) {
            throw new ImolRuntimeError(`Missing argument ${p.name}`);
        }
        env.set(p.name, v);
    });
    for (const stmt of fn.body) {
        const r = await evalStmt(stmt, env, mod, fns, tools, externs, options, fn);
        if (r.type === "return") {
            return r.value;
        }
    }
    return { kind: "unit" };
}

type StmtResult = { type: "normal"; value: Value } | { type: "return"; value: Value };

async function evalStmt(
    stmt: Stmt,
    env: Map<string, Value>,
    mod: ModuleDecl,
    fns: Map<string, FunctionDecl>,
    tools: Map<string, import("@kmfarris/imol-syntax").ToolDecl>,
    externs: ExternRegistry,
    options: RunOptions,
    fn: FunctionDecl,
): Promise<StmtResult> {
    switch (stmt.kind) {
        case "run_plan": {
            if (!options.planApproved) {
                throw new ImolRuntimeError("run plan blocked: not approved (use --approve)");
            }
            const plan = mod.plans[0];
            if (!plan) {
                throw new ImolRuntimeError("no plan block in module");
            }
            for (const inv of plan.invokes) {
                await evalExpr(inv, env, mod, fns, tools, externs, options);
            }
            return { type: "normal", value: { kind: "unit" } };
        }
        case "if_block": {
            const c = await evalExpr(stmt.cond, env, mod, fns, tools, externs, options);
            if (c.kind !== "bool") throw new ImolRuntimeError("if condition must be Bool");
            const branch = c.value ? stmt.then : stmt.else;
            for (const s of branch) {
                const r = await evalStmt(s, env, mod, fns, tools, externs, options, fn);
                if (r.type === "return") return r;
            }
            return { type: "normal", value: { kind: "unit" } };
        }
        case "let": {
            const v = await evalExpr(stmt.value, env, mod, fns, tools, externs, options);
            env.set(stmt.name, v);
            return { type: "normal", value: v };
        }
        case "return":
            return {
                type: "return",
                value: await evalExpr(stmt.value, env, mod, fns, tools, externs, options),
            };
        case "expr":
            return {
                type: "normal",
                value: await evalExpr(stmt.value, env, mod, fns, tools, externs, options),
            };
        case "await_invoke": {
            const toolDecl = tools.get(stmt.tool);
            const effect = toolDecl ? effectFromAttrs(toolDecl.attrs) : "pure";
            const asyncMeta: Omit<TraceEntry, "ts" | "dry_run"> = {
                kind: "async_scheduled",
                name: stmt.tool,
                tool: stmt.tool,
                args_digest: digestRecord(stmt.fields),
                effect,
            };
            if (toolDecl) asyncMeta.extern = toolDecl.from;
            emitTrace(options, asyncMeta);
            const inv: Expr = {
                kind: "invoke",
                tool: stmt.tool,
                fields: stmt.fields,
                span: stmt.span,
            };
            const value = await evalExpr(inv, env, mod, fns, tools, externs, options);
            emitTrace(options, { ...asyncMeta, kind: "async_done" });
            return { type: "normal", value };
        }
    }
}

async function evalExpr(
    expr: Expr,
    env: Map<string, Value>,
    mod: ModuleDecl,
    fns: Map<string, FunctionDecl>,
    tools: Map<string, import("@kmfarris/imol-syntax").ToolDecl>,
    externs: ExternRegistry,
    options: RunOptions,
): Promise<Value> {
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
            if (!v) throw new ImolRuntimeError(`Unbound ${expr.name}`);
            return v;
        }
        case "field":
            throw new ImolRuntimeError("Bare field access cannot be evaluated");
        case "record": {
            const fields = new Map<string, Value>();
            for (const f of expr.fields) {
                fields.set(f.name, await evalExpr(f.value, env, mod, fns, tools, externs, options));
            }
            return { kind: "record", fields };
        }
        case "variant":
            if (expr.payload) {
                return {
                    kind: "variant",
                    name: expr.name,
                    payload: await evalExpr(expr.payload, env, mod, fns, tools, externs, options),
                };
            }
            return { kind: "variant", name: expr.name };
        case "binary": {
            const l = await evalExpr(expr.left, env, mod, fns, tools, externs, options);
            const r = await evalExpr(expr.right, env, mod, fns, tools, externs, options);
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
            const c = await evalExpr(expr.cond, env, mod, fns, tools, externs, options);
            if (c.kind !== "bool") throw new ImolRuntimeError("if condition must be Bool");
            return c.value
                ? evalExpr(expr.then, env, mod, fns, tools, externs, options)
                : evalExpr(expr.else, env, mod, fns, tools, externs, options);
        }
        case "match": {
            const s = await evalExpr(expr.scrutinee, env, mod, fns, tools, externs, options);
            if (s.kind !== "variant") throw new ImolRuntimeError("match on non-variant");
            for (const arm of expr.arms) {
                if (arm.pattern.kind === "wildcard") {
                    return evalExpr(arm.body, env, mod, fns, tools, externs, options);
                }
                if (arm.pattern.kind === "variant" && arm.pattern.name === s.name) {
                    const env2 = new Map(env);
                    if (arm.pattern.bind && s.payload) {
                        env2.set(arm.pattern.bind, s.payload);
                    }
                    return evalExpr(arm.body, env2, mod, fns, tools, externs, options);
                }
            }
            throw new ImolRuntimeError(`No match arm for ${s.name}`);
        }
        case "fail": {
            const m = await evalExpr(expr.message, env, mod, fns, tools, externs, options);
            throw new ImolRuntimeError(m.kind === "text" ? m.value : valueToString(m));
        }
        case "call":
            return evalCall(expr.callee, expr.args, env, mod, fns, tools, externs, options);
        case "invoke": {
            const tool = tools.get(expr.tool);
            if (!tool) throw new ImolRuntimeError(`Unknown tool ${expr.tool}`);
            const effect = effectFromAttrs(tool.attrs);
            assertEffect(options, effect);
            if (tool.from === "std.shell.exec") {
                if (!options.planApproved) {
                    throw new ImolRuntimeError("shell exec blocked: not approved (use --approve)");
                }
                if (!options.capabilities?.shell) {
                    throw new ImolRuntimeError("shell exec blocked: workshop allow_shell false");
                }
            }
            const fields = new Map<string, Value>();
            for (const f of expr.fields) {
                fields.set(f.name, await evalExpr(f.value, env, mod, fns, tools, externs, options));
            }
            const argRecord: Value = { kind: "record", fields };
            emitTrace(options, {
                kind: "invoke",
                name: expr.tool,
                tool: expr.tool,
                extern: tool.from,
                args_digest: digestRecord(expr.fields),
                effect,
            });
            if (options.dryRun) {
                return { kind: "variant", name: "Ok", payload: { kind: "text", value: "" } };
            }
            const handler = externs.get(tool.from);
            if (!handler) {
                throw new ImolRuntimeError(`No extern registered for ${tool.from}`);
            }
            const result = await handler([argRecord]);
            emitTrace(options, {
                kind: "extern",
                name: tool.from,
                extern: tool.from,
                effect,
                result_kind: result.kind === "variant" ? result.name : result.kind,
            });
            return result;
        }
    }
}

async function evalCall(
    callee: Expr,
    args: Expr[],
    env: Map<string, Value>,
    mod: ModuleDecl,
    fns: Map<string, FunctionDecl>,
    tools: Map<string, import("@kmfarris/imol-syntax").ToolDecl>,
    externs: ExternRegistry,
    options: RunOptions,
): Promise<Value> {
    if (callee.kind === "field" && callee.field === "println") {
        const arg: Value = args[0]
            ? await evalExpr(args[0], env, mod, fns, tools, externs, options)
            : { kind: "unit" };
        const text = arg.kind === "text" ? arg.value : valueToString(arg);
        assertEffect(options, "io");
        emitTrace(options, {
            kind: "io",
            name: "println",
            effect: "io",
            detail: text,
        });
        if (!options.dryRun) {
            console.log(text);
        }
        return { kind: "variant", name: "Ok", payload: { kind: "unit" } };
    }
    if (callee.kind === "ident") {
        const fn = fns.get(callee.name);
        if (fn) {
            const argValues: Value[] = [];
            for (const a of args) {
                argValues.push(await evalExpr(a, env, mod, fns, tools, externs, options));
            }
            return evalFunction(fn, mod, fns, tools, externs, options, env, argValues);
        }
    }
    throw new ImolRuntimeError("Unsupported call");
}
