import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { agentLoop, defaultLoadModule } from "@kmfarris/imol-skill/oracle";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("agent loop", () => {
    it("dry-llm succeeds on dogfood catalog", async () => {
        const body = (await agentLoop(defaultLoadModule, {
            task: "verify dogfood catalog",
            file: join(root, "examples/dogfood/catalog.imol"),
            dry_llm: true,
            max_iter: 1,
        })) as { ok: boolean; workshop_plan?: { ok: boolean } };
        expect(body.ok).toBe(true);
        expect(body.workshop_plan?.ok).toBe(true);
    });

    it("patch path produces valid check in memory", async () => {
        const body = (await agentLoop(defaultLoadModule, {
            task: "patch greet by id",
            file: join(root, "examples/greet.imol"),
            patch_path: join(root, "examples/agent/patch-greet.json"),
            max_iter: 1,
        })) as { ok: boolean; final_check?: { ok: boolean } };
        expect(body.final_check?.ok).toBe(true);
    });
});
