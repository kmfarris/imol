import { parse } from "@imol/syntax";
function formatType(t) {
    switch (t.kind) {
        case "named":
            return t.name;
        case "record": {
            const inner = t.fields.map((f) => `${f.name}: ${formatType(f.type)}`).join(", ");
            return `{ ${inner} }`;
        }
        case "sum":
            return t.variants
                .map((v) => (v.payload ? `${v.name} ${formatType(v.payload)}` : v.name))
                .join(" | ");
        case "result":
            return `Result(${formatType(t.ok)}, ${formatType(t.err)})`;
    }
}
function formatAttrs(attrs) {
    if (attrs.length === 0)
        return "";
    return attrs.map((a) => (a.args.length ? `${a.name}("${a.args[0]}")` : a.name)).join(" ") + "\n";
}
function formatExpr(e, indent) {
    switch (e.kind) {
        case "int":
            return String(e.value);
        case "text":
            return `"${e.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
        case "bool":
            return e.value ? "true" : "false";
        case "unit":
            return "()";
        case "ident":
            return e.name;
        case "field":
            return `${formatExpr(e.object, indent)}.${e.field}`;
        case "record": {
            const inner = e.fields.map((f) => `${f.name}: ${formatExpr(f.value, indent)}`).join(", ");
            return `{ ${inner} }`;
        }
        case "variant":
            return e.payload
                ? `${e.name}(${formatExpr(e.payload, indent)})`
                : `${e.name}()`;
        case "call":
            return `${formatExpr(e.callee, indent)}(${e.args.map((a) => formatExpr(a, indent)).join(", ")})`;
        case "invoke": {
            const inner = e.fields.map((f) => `${f.name}: ${formatExpr(f.value, indent)}`).join(", ");
            return `invoke ${e.tool} { ${inner} }`;
        }
        case "binary":
            return `${formatExpr(e.left, indent)} ${e.op === "eq" ? "==" : "++"} ${formatExpr(e.right, indent)}`;
        case "if":
            return `if ${formatExpr(e.cond, indent)}\n${indent}  ${formatExpr(e.then, indent)}\n${indent}else\n${indent}  ${formatExpr(e.else, indent)}\n${indent}end`;
        case "match": {
            const arms = e.arms
                .map((a) => `${indent}  ${formatPattern(a.pattern)} -> ${formatExpr(a.body, indent + "  ")}`)
                .join("\n");
            return `match ${formatExpr(e.scrutinee, indent)}\n${arms}\n${indent}end`;
        }
        case "fail":
            return `fail(${formatExpr(e.message, indent)})`;
        case "hole":
            return `hole ${e.name} "${e.reason.replace(/"/g, '\\"')}"`;
    }
}
function formatPattern(p) {
    if (p.kind === "wildcard")
        return "_";
    return p.bind ? `${p.name} ${p.bind}` : p.name;
}
function formatStmt(s, indent) {
    switch (s.kind) {
        case "let":
            return s.type
                ? `${indent}let ${s.name} ${formatType(s.type)} = ${formatExpr(s.value, indent)}`
                : `${indent}let ${s.name} = ${formatExpr(s.value, indent)}`;
        case "return":
            return `${indent}return ${formatExpr(s.value, indent)}`;
        case "expr":
            return `${indent}${formatExpr(s.value, indent)}`;
        case "if_block": {
            const thenLines = s.then.map((x) => formatStmt(x, indent + "  ")).join("\n");
            const elseLines = s.else.length > 0
                ? `\n${indent}else\n${s.else.map((x) => formatStmt(x, indent + "  ")).join("\n")}\n${indent}end`
                : "";
            return `${indent}if ${formatExpr(s.cond, indent)}\n${thenLines}\n${indent}end${elseLines}`;
        }
    }
}
function formatWorkshop(w, indent) {
    const lines = [`${indent}workshop`];
    lines.push(`${indent}  allow_net ${w.allowNet ? "true" : "false"}`);
    for (const b of w.binds) {
        lines.push(`${indent}  bind ${b}`);
    }
    lines.push(`${indent}end`);
    return lines.join("\n");
}
function formatImport(i) {
    return i.alias ? `import ${i.path} as ${i.alias}` : `import ${i.path}`;
}
function formatTool(t) {
    return (formatAttrs(t.attrs) +
        `tool ${t.name} from ${t.from}\n` +
        `  ${formatType(t.inputType)} -> ${formatType(t.outputType)}`);
}
function formatFunction(f) {
    const params = f.params.map((p) => `${p.name} ${formatType(p.type)}`).join(", ");
    const body = f.body.map((s) => formatStmt(s, "  ")).join("\n");
    return (formatAttrs(f.attrs) +
        `function ${f.name}(${params}) -> ${formatType(f.returnType)}\n${body}\nend`);
}
function formatTypeDecl(t) {
    return `type ${t.name} = ${formatType(t.definition)}`;
}
export function formatModule(m) {
    const moduleAttrs = m.attrs.length
        ? " " + m.attrs.map((a) => (a.args[0] ? `${a.name}("${a.args[0]}")` : a.name)).join(" ")
        : "";
    const parts = [`module ${m.name}${moduleAttrs}`, ""];
    if (m.workshop) {
        parts.push(formatWorkshop(m.workshop, ""));
        parts.push("");
    }
    for (const i of m.imports)
        parts.push(formatImport(i));
    if (m.imports.length)
        parts.push("");
    for (const t of m.tools)
        parts.push(formatTool(t), "");
    for (const t of m.types)
        parts.push(formatTypeDecl(t), "");
    for (const f of m.functions)
        parts.push(formatFunction(f), "");
    return parts.join("\n").trimEnd() + "\n";
}
export function format(source) {
    return formatModule(parse(source));
}
//# sourceMappingURL=format.js.map