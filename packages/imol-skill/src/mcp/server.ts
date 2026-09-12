#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadCodebook } from "../codebook/load.js";
import { initWorkspaceRootFromEnv } from "./paths.js";
import { registerImolTools } from "./register-tools.js";

const INSTRUCTIONS = `IMOL MCP: use imol_skill_prepare before editing .imol files, then imol_agent_check after edits. Use imol_agent_workshop_plan before side effects. Optional: imol agent sanitize for raw LLM output. Never suggest --approve unless the user explicitly requested execution. spec_version 0.4.`;

async function registerResources(server: McpServer): Promise<void> {
    const codebook = await loadCodebook();
    server.registerResource(
        "imol_codebook_index",
        "imol://codebook/v0.4",
        {
            description: "IMOL skill codebook codeword ids (spec 0.4)",
            mimeType: "application/json",
        },
        async () => ({
            contents: [
                {
                    uri: "imol://codebook/v0.4",
                    mimeType: "application/json",
                    text: JSON.stringify({
                        spec_version: codebook.spec_version,
                        ids: codebook.codewords.map((c) => c.id),
                    }),
                },
            ],
        }),
    );

    server.registerResource(
        "imol_codebook_entry",
        new ResourceTemplate("imol://codebook/v0.4/{id}", { list: undefined }),
        {
            description: "Expansion text for one IMOL skill codeword",
            mimeType: "text/markdown",
        },
        async (uri, variables) => {
            const id = variables.id ?? decodeURIComponent(uri.pathname.replace(/^\//, ""));
            const cw = codebook.codewords.find((c) => c.id === id);
            if (!cw) {
                throw new Error(`Unknown codeword: ${id}`);
            }
            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: "text/markdown",
                        text: `# ${cw.id}\n\n${cw.expansion}\n`,
                    },
                ],
            };
        },
    );
}

async function main(): Promise<void> {
    initWorkspaceRootFromEnv();
    const server = new McpServer(
        { name: "imol", version: "0.1.0" },
        { capabilities: { tools: {}, resources: {} }, instructions: INSTRUCTIONS },
    );
    registerImolTools(server);
    await registerResources(server);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

const isMain =
    typeof process.argv[1] === "string" &&
    (process.argv[1].endsWith("server.js") || process.argv[1].endsWith("server.ts"));

if (isMain) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
