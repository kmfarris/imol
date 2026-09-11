type McpTool = {
    name: string;
    description?: string;
    inputSchema?: {
        type?: string;
        properties?: Record<string, { type?: string }>;
        required?: string[];
    };
};

type McpExport = {
    tools: McpTool[];
};

function jsonTypeToImol(prop: { type?: string } | undefined): string {
    switch (prop?.type) {
        case "integer":
        case "number":
            return "Int";
        case "boolean":
            return "Bool";
        default:
            return "Text";
    }
}

export function mcpToImolTools(exportJson: McpExport): string {
    const lines: string[] = ["module mcp_generated @id(\"mcp-generated\")", ""];
    lines.push("type Result = Ok Text | Err Text", "");
    for (const tool of exportJson.tools) {
        const props = tool.inputSchema?.properties ?? {};
        const required = new Set(tool.inputSchema?.required ?? []);
        const fields = Object.keys(props).map((k) => {
            const ty = jsonTypeToImol(props[k]);
            return `${k}: ${ty}`;
        });
        if (fields.length === 0 && required.size === 0) {
            lines.push(`tool ${tool.name} from mcp.${tool.name} @io`);
            lines.push(`  { } -> Result`, "");
        } else {
            lines.push(`tool ${tool.name} from mcp.${tool.name} @io`);
            lines.push(`  { ${fields.join(", ")} } -> Result`, "");
        }
    }
    return lines.join("\n").trimEnd() + "\n";
}

export function parseMcpExport(json: string): McpExport {
    const data = JSON.parse(json) as McpExport;
    if (!Array.isArray(data.tools)) {
        throw new Error("MCP export must have tools array");
    }
    return data;
}
