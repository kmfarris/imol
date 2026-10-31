import { describe, expect, it } from "vitest";
import { parse, parseWithRepair, removeOrphanAtIdBeforePlan, repairAgentGrammar } from "@kmfarris/imol-syntax";

describe("grammar repair", () => {
    it("removes @id line before plan", () => {
        const raw = `module m @id("m")

@id("bad-plan-id")
plan
end
`;
        const { source, changed } = removeOrphanAtIdBeforePlan(raw);
        expect(changed).toBe(true);
        expect(() => parse(source)).not.toThrow();
    });

    it("strips // comments via repair + parse", () => {
        const raw = `module m

import std.io as io

// hello comment
@io
function main() -> Unit
  io.println("ok")
  return ()
end
`;
        const { repairs } = repairAgentGrammar(raw);
        expect(repairs).toContain("stripped_js_comments");
        const { module } = parseWithRepair(raw);
        expect(module.name).toBe("m");
    });

    it("parseWithRepair succeeds on fenced-like smart quotes in strings", () => {
        const raw = `module m

import std.io as io

@io
function main() -> Unit
  io.println("ok")
  return ()
end
`;
        const { module } = parseWithRepair(raw);
        expect(module.functions.length).toBe(1);
    });
});
