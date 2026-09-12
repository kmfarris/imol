import { describe, expect, it } from "vitest";
import { buildCodebookFromInventory } from "@imol/skill";
import { CODewORD_ENTRIES } from "@imol/skill";
import { routeSkills } from "@imol/skill";

describe("@imol/skill", () => {
    it("inventory has 40+ codewords", () => {
        expect(CODewORD_ENTRIES.length).toBeGreaterThanOrEqual(40);
    });

    it("routes patch task to patch codewords", () => {
        const book = buildCodebookFromInventory();
        const r = routeSkills(book, { task: "patch greet-fn by id using agent patch", k: 8 });
        const ids = r.codewords.map((c) => c.id);
        expect(ids.some((id) => id.includes("patch"))).toBe(true);
        expect(r.token_estimate).toBeLessThan(4000);
        expect(r.spec_version).toBe("0.4");
    });

    it("includes mandatory tool policy for agent loop", () => {
        const book = buildCodebookFromInventory();
        const r = routeSkills(book, { task: "edit imol file workshop side effects", k: 5 });
        expect(r.tool_policy.length).toBeGreaterThan(0);
    });
});
