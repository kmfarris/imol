#!/usr/bin/env node
/**
 * sessionStart: set IMOL_WORKSPACE_ROOT and remind agents to use MCP oracle tools.
 * additional_context may be dropped on some Cursor builds (see Cursor hooks docs).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const root = process.cwd();
const context = [
    "IMOL workspace: use MCP tools imol_skill_prepare → edit → imol_agent_check → imol_agent_workshop_plan.",
    "Dogfood: examples/dogfood/catalog.imol. Docs: docs/HAPPY_PATH.md.",
    "Do not run --approve via MCP unless a future gated tool exists.",
].join(" ");

process.stdout.write(
    JSON.stringify({
        env: {
            IMOL_WORKSPACE_ROOT: root,
            IMOL_SESSION_ID: input.session_id ?? "",
        },
        additional_context: context,
    }),
);
