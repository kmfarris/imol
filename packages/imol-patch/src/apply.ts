import { formatModule } from "@imol/fmt";
import {
    buildDeclIndex,
    getDeclById,
    parse,
    type FunctionDecl,
    type ModuleDecl,
    type ToolDecl,
    type TypeDecl,
} from "@imol/syntax";
import type { PatchFile, PatchOp } from "./types.js";

export class PatchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PatchError";
    }
}

function parseDeclSnippet(source: string): FunctionDecl | TypeDecl | ToolDecl {
    const wrapped = `module __patch__\n${source.trim()}\n`;
    const mod = parse(wrapped);
    if (mod.functions.length === 1) {
        return mod.functions[0]!;
    }
    if (mod.types.length === 1) {
        return mod.types[0]!;
    }
    if (mod.tools.length === 1) {
        return mod.tools[0]!;
    }
    throw new PatchError("Patch source must contain exactly one function, type, or tool declaration");
}

function declKind(entry: { kind: string }): "function" | "type" | "tool" {
    if (entry.kind === "function" || entry.kind === "type" || entry.kind === "tool") {
        return entry.kind;
    }
    throw new PatchError(`Cannot patch declaration kind ${entry.kind}`);
}

function removeDecl(mod: ModuleDecl, kind: "function" | "type" | "tool", name: string): void {
    if (kind === "function") {
        mod.functions = mod.functions.filter((f) => f.name !== name);
    } else if (kind === "type") {
        mod.types = mod.types.filter((t) => t.name !== name);
    } else {
        mod.tools = mod.tools.filter((t) => t.name !== name);
    }
}

function insertAfter<T extends { name: string }>(items: T[], afterName: string, item: T): T[] {
    const idx = items.findIndex((x) => x.name === afterName);
    if (idx < 0) {
        return [...items, item];
    }
    const next = [...items];
    next.splice(idx + 1, 0, item);
    return next;
}

function applyOne(mod: ModuleDecl, patch: PatchOp): void {
    const index = buildDeclIndex(mod);
    const entry = getDeclById(index, patch.id);
    if (!entry) {
        throw new PatchError(`Unknown @id ${patch.id}`);
    }
    if (entry.kind === "module") {
        throw new PatchError(`Cannot patch module @id with ${patch.op}; target a function, type, or tool`);
    }
    const kind = declKind(entry);

    if (patch.op === "delete_decl_by_id") {
        removeDecl(mod, kind, entry.name);
        return;
    }

    const newDecl = parseDeclSnippet(patch.source);
    const newKind =
        newDecl.kind === "function" ? "function" : newDecl.kind === "type" ? "type" : "tool";
    if (newKind !== kind && patch.op === "replace_decl_by_id") {
        throw new PatchError(`Patch kind ${newKind} does not match existing ${kind} for @id ${patch.id}`);
    }

    if (patch.op === "replace_decl_by_id") {
        removeDecl(mod, kind, entry.name);
        if (kind === "function") {
            mod.functions.push(newDecl as FunctionDecl);
        } else if (kind === "type") {
            mod.types.push(newDecl as TypeDecl);
        } else {
            mod.tools.push(newDecl as ToolDecl);
        }
        return;
    }

    if (patch.op === "insert_after_id") {
        if (newKind === "function") {
            mod.functions = insertAfter(mod.functions, entry.name, newDecl as FunctionDecl);
        } else if (newKind === "type") {
            mod.types = insertAfter(mod.types, entry.name, newDecl as TypeDecl);
        } else {
            mod.tools = insertAfter(mod.tools, entry.name, newDecl as ToolDecl);
        }
    }
}

export function applyPatches(source: string, patchFile: PatchFile): string {
    let mod = parse(source);
    for (const p of patchFile.patches) {
        applyOne(mod, p);
    }
    return formatModule(mod);
}

export function parsePatchFile(json: string): PatchFile {
    const data = JSON.parse(json) as PatchFile;
    if (!Array.isArray(data.patches)) {
        throw new PatchError("Patch file must have patches array");
    }
    return data;
}
