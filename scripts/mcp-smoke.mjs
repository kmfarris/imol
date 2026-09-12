#!/usr/bin/env node
/**
 * Smoke-test IMOL MCP stdio server: initialize + tools/list.
 * MCP SDK uses newline-delimited JSON-RPC (not Content-Length).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(repoRoot, "packages/imol-skill/dist/mcp/server.js");

if (!existsSync(server)) {
    console.error(`mcp-smoke: missing ${server} — run npm run build`);
    process.exit(1);
}

function sendLine(obj) {
    child.stdin.write(`${JSON.stringify(obj)}\n`);
}

const child = spawn(process.execPath, [server], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, IMOL_WORKSPACE_ROOT: repoRoot },
    cwd: repoRoot,
});

let buf = "";
const pending = new Map();
let nextId = 1;

function send(method, params) {
    const id = nextId++;
    sendLine({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        setTimeout(() => {
            if (pending.has(id)) {
                pending.delete(id);
                reject(new Error(`timeout waiting for ${method}`));
            }
        }, 15_000);
    });
}

function onMessage(obj) {
    if (obj.id !== undefined && pending.has(obj.id)) {
        const { resolve, reject } = pending.get(obj.id);
        pending.delete(obj.id);
        if (obj.error) reject(new Error(obj.error.message ?? JSON.stringify(obj.error)));
        else resolve(obj.result);
    }
}

child.stdout.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    while (true) {
        const nl = buf.indexOf("\n");
        if (nl === -1) break;
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
            onMessage(JSON.parse(line));
        } catch (e) {
            console.error("mcp-smoke: invalid JSON line", line.slice(0, 200));
            process.exit(1);
        }
    }
});

child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
        console.error(`mcp-smoke: server exited ${code}`);
        process.exit(code ?? 1);
    }
});

async function main() {
    const init = await send("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcp-smoke", version: "1.0.0" },
    });
    if (!init?.serverInfo?.name) {
        console.error("mcp-smoke: initialize missing serverInfo", init);
        process.exit(1);
    }
    sendLine({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    const tools = await send("tools/list", {});
    const names = (tools?.tools ?? []).map((t) => t.name);
    const required = [
        "imol_skill_prepare",
        "imol_agent_check",
        "imol_agent_workshop_plan",
    ];
    for (const name of required) {
        if (!names.includes(name)) {
            console.error(`mcp-smoke: missing tool ${name}; got ${names.join(", ")}`);
            process.exit(1);
        }
    }
    console.log("mcp-smoke: ok", init.serverInfo.name, `tools=${names.length}`);
    child.stdin.end();
    setTimeout(() => process.exit(0), 100);
}

main().catch((e) => {
    console.error("mcp-smoke:", e.message);
    process.exit(1);
});
