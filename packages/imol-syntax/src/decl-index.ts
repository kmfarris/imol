import type { Attribute, FunctionDecl, ModuleDecl, ToolDecl } from "./ast.js";
import type { Span } from "./ast.js";

export type DeclKind = "module" | "function" | "tool" | "type";

export type DeclEntry = {
    id: string;
    kind: DeclKind;
    name: string;
    span: Span;
};

function idFromAttrs(attrs: Attribute[]): string | undefined {
    for (const a of attrs) {
        if (a.name === "@id" && a.args[0]) {
            return a.args[0];
        }
    }
    return undefined;
}

export function buildDeclIndex(mod: ModuleDecl): Map<string, DeclEntry> {
    const index = new Map<string, DeclEntry>();

    const moduleId = idFromAttrs(mod.attrs);
    if (moduleId) {
        index.set(moduleId, {
            id: moduleId,
            kind: "module",
            name: mod.name,
            span: mod.span,
        });
    }

    for (const fn of mod.functions) {
        registerDecl(index, fn.attrs, "function", fn.name, fn.span);
    }
    for (const tool of mod.tools) {
        registerDecl(index, tool.attrs, "tool", tool.name, tool.span);
    }
    for (const td of mod.types) {
        registerDecl(index, td.attrs, "type", td.name, td.span);
    }

    return index;
}

function registerDecl(
    index: Map<string, DeclEntry>,
    attrs: Attribute[],
    kind: DeclKind,
    name: string,
    span: Span,
): void {
    const id = idFromAttrs(attrs);
    if (!id) return;
    index.set(id, { id, kind, name, span });
}

export function findDeclIdForSpan(index: Map<string, DeclEntry>, span: Span): string | undefined {
    let best: DeclEntry | undefined;
    let bestSize = Infinity;
    for (const entry of index.values()) {
        if (span.start >= entry.span.start && span.end <= entry.span.end) {
            const size = entry.span.end - entry.span.start;
            if (size < bestSize) {
                bestSize = size;
                best = entry;
            }
        }
    }
    return best?.id;
}

export function getDeclById(index: Map<string, DeclEntry>, id: string): DeclEntry | undefined {
    return index.get(id);
}

export function listDecls(mod: ModuleDecl): DeclEntry[] {
    return [...buildDeclIndex(mod).values()];
}
