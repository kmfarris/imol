import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeEach } from "vitest";
import { buildCodebookFromInventory } from "@kmfarris/imol-skill";
import { routeSkills } from "@kmfarris/imol-skill";
import { handleAgentCheck, handleSkillRoute } from "@kmfarris/imol-skill/mcp/tools";
import { assertPathAllowed, setWorkspaceRoot } from "@kmfarris/imol-skill/mcp/paths";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("MCP tools", () => {
    beforeEach(() => {
        setWorkspaceRoot(root);
    });

    it("agent check on greet.imol returns ok", async () => {
        const text = await handleAgentCheck({ file: "examples/greet.imol" });
        const body = JSON.parse(text) as { ok: boolean; spec_version: string };
        expect(body.ok).toBe(true);
        expect(body.spec_version).toBe("0.4");
    });

    it("rejects paths outside workspace", () => {
        expect(() => assertPathAllowed("/etc/passwd")).toThrow(/outside workspace/);
    });

    it("skill route returns packet under budget", async () => {
        const text = await handleSkillRoute({ task: "patch by id agent check", k: 5 });
        const body = JSON.parse(text) as { packet: string; token_estimate: number };
        expect(body.packet.length).toBeGreaterThan(50);
        expect(body.token_estimate).toBeLessThan(5000);
    });

    it("routeSkills smoke", () => {
        const book = buildCodebookFromInventory();
        const r = routeSkills(book, { task: "workshop plan approve gate", k: 5 });
        expect(r.tool_policy.length).toBeGreaterThan(0);
    });
});
