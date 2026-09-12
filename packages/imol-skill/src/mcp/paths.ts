import { resolve, relative, isAbsolute } from "node:path";

let workspaceRoot = resolve(process.cwd());

export function setWorkspaceRoot(root: string): void {
    workspaceRoot = resolve(root);
}

export function getWorkspaceRoot(): string {
    return workspaceRoot;
}

export function initWorkspaceRootFromEnv(): void {
    const env = process.env.IMOL_WORKSPACE_ROOT;
    if (env) {
        setWorkspaceRoot(env);
    }
}

/** Resolve path and ensure it stays under workspace root. */
export function assertPathAllowed(inputPath: string): string {
    const abs = isAbsolute(inputPath) ? resolve(inputPath) : resolve(workspaceRoot, inputPath);
    const rel = relative(workspaceRoot, abs);
    if (rel.startsWith("..") || isAbsolute(rel)) {
        throw new Error(`Path outside workspace: ${inputPath}`);
    }
    return abs;
}
