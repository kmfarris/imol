import { describe, expect, it } from "vitest";
import { mcpToImolTools, parseMcpExport } from "../packages/imol-cli/src/mcp-import.js";

describe("mcp import", () => {
    it("generates tool stubs", () => {
        const imol = mcpToImolTools(
            parseMcpExport(
                JSON.stringify({
                    tools: [
                        {
                            name: "search",
                            inputSchema: {
                                type: "object",
                                properties: { query: { type: "string" } },
                                required: ["query"],
                            },
                        },
                    ],
                }),
            ),
        );
        expect(imol).toContain("tool search from mcp.search");
        expect(imol).toContain("query: Text");
    });
});
