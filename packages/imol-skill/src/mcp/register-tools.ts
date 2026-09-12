import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer as McpServerType } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
    handleAgentCheck,
    handleAgentFmtCheck,
    handleAgentPatch,
    handleAgentSanitize,
    handleAgentWorkshopPlan,
    handleSkillPrepare,
    handleSkillRoute,
} from "./tools.js";

type ToolArgs = Record<string, unknown>;

type TextResult = { content: { type: "text"; text: string }[] };

function register(
    server: McpServerType,
    name: string,
    description: string,
    inputSchema: z.ZodRawShape,
    run: (args: ToolArgs) => Promise<string>,
): void {
    const handler = async (args: ToolArgs): Promise<TextResult> => ({
        content: [{ type: "text", text: await run(args) }],
    });
    // Preserve `this`; avoid TS2589 from registerTool generics.
    (McpServer.prototype.registerTool as (...a: unknown[]) => void).call(
        server,
        name,
        { description, inputSchema },
        handler,
    );
}

export function registerImolTools(server: McpServerType): void {
    register(
        server,
        "imol_skill_route",
        "Select codewords and compile minimal IMOL skill packet (CSD)",
        {
            task: z.string(),
            file: z.string().optional(),
            file_snippet: z.string().optional(),
            last_oracle_json: z.string().optional(),
            k: z.number().optional(),
        },
        async (args) =>
            handleSkillRoute({
                task: String(args.task ?? ""),
                ...(typeof args.file === "string" ? { file: args.file } : {}),
                ...(typeof args.file_snippet === "string" ? { file_snippet: args.file_snippet } : {}),
                ...(typeof args.last_oracle_json === "string"
                    ? { last_oracle_json: args.last_oracle_json }
                    : {}),
                ...(typeof args.k === "number" ? { k: args.k } : {}),
            }),
    );

    register(
        server,
        "imol_skill_prepare",
        "One-shot context: route + optional file → packet and tool_policy",
        {
            task: z.string(),
            file: z.string().optional(),
            k: z.number().optional(),
        },
        async (args) =>
            handleSkillPrepare({
                task: String(args.task ?? ""),
                ...(typeof args.file === "string" ? { file: args.file } : {}),
                ...(typeof args.k === "number" ? { k: args.k } : {}),
            }),
    );

    register(
        server,
        "imol_agent_check",
        "Run imol agent check on an IMOL file",
        {
            file: z.string(),
            allow_holes: z.boolean().optional(),
        },
        async (args) =>
            handleAgentCheck({
                file: String(args.file ?? ""),
                ...(typeof args.allow_holes === "boolean" ? { allow_holes: args.allow_holes } : {}),
            }),
    );

    register(
        server,
        "imol_agent_fmt_check",
        "Parse → fmt → compare; returns changed flag",
        { file: z.string() },
        async (args) => handleAgentFmtCheck({ file: String(args.file ?? "") }),
    );

    register(
        server,
        "imol_agent_patch",
        "Dry-run patch; returns output and nested check (does not write disk)",
        {
            file: z.string(),
            patches_path: z.string(),
        },
        async (args) =>
            handleAgentPatch({
                file: String(args.file ?? ""),
                patches_path: String(args.patches_path ?? ""),
            }),
    );

    register(
        server,
        "imol_agent_workshop_plan",
        "Dry-run workshop plan invokes; returns trace and state",
        { file: z.string() },
        async (args) => handleAgentWorkshopPlan({ file: String(args.file ?? "") }),
    );

    register(
        server,
        "imol_agent_sanitize",
        "Grammar v2 repair + fmt on IMOL source (file or raw source string)",
        {
            file: z.string().optional(),
            source: z.string().optional(),
            write: z.boolean().optional(),
        },
        async (args) => handleAgentSanitize(args),
    );
}
