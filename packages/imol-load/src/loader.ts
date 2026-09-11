import { parse, type ImportDecl, type ModuleDecl } from "@imol/syntax";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type LoadOptions = {
    projectRoot?: string;
};

function importToPath(importPath: string): string {
    return importPath.replace(/\./g, "/") + ".imol";
}

export async function loadSource(path: string): Promise<string> {
    return readFile(path, "utf8");
}

export async function loadModuleFromFile(
    filePath: string,
    options: LoadOptions = {},
): Promise<ModuleDecl> {
    const root = options.projectRoot ?? dirname(filePath);
    const abs = resolve(filePath);
    const seen = new Set<string>();
    return loadRecursive(abs, root, seen);
}

async function loadRecursive(
    filePath: string,
    projectRoot: string,
    seen: Set<string>,
): Promise<ModuleDecl> {
    if (seen.has(filePath)) {
        throw new Error(`Circular import: ${filePath}`);
    }
    seen.add(filePath);
    const source = await readFile(filePath, "utf8");
    const mod = parse(source);

    const merged: ModuleDecl = {
        ...mod,
        plans: [...mod.plans],
        imports: [...mod.imports],
        tools: [...mod.tools],
        types: [...mod.types],
        functions: [...mod.functions],
    };

    for (const imp of mod.imports) {
        const childPath = resolve(projectRoot, importToPath(imp.path));
        try {
            const child = await loadRecursive(childPath, projectRoot, seen);
            mergeModules(merged, child, imp);
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code === "ENOENT") {
                continue;
            }
            throw e;
        }
    }

    return merged;
}

function mergeModules(target: ModuleDecl, child: ModuleDecl, _imp: ImportDecl): void {
    for (const t of child.types) {
        target.types.push(t);
    }
    for (const tool of child.tools) {
        target.tools.push(tool);
    }
    for (const fn of child.functions) {
        target.functions.push(fn);
    }
    for (const p of child.plans) {
        target.plans.push(p);
    }
}
