#!/usr/bin/env node
/**
 * Stable MCP entry: resolves server.js from this repo regardless of process cwd.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(repoRoot, "packages/imol-skill/dist/mcp/server.js");

if (!existsSync(server)) {
    console.error(`IMOL MCP: build first (missing ${server}). Run: npm run build`);
    process.exit(1);
}

const env = { ...process.env };
if (!env.IMOL_WORKSPACE_ROOT) {
    env.IMOL_WORKSPACE_ROOT = repoRoot;
}

const child = spawn(process.execPath, [server], {
    stdio: "inherit",
    env,
    cwd: repoRoot,
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.exit(1);
    }
    process.exit(code ?? 1);
});

child.on("error", (err) => {
    console.error(err);
    process.exit(1);
});
