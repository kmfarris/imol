import { describe, expect, it } from "vitest";
import { sanitizeAndFormat, stripMarkdownFences } from "@imol/fmt";

describe("agent sanitize", () => {
    it("strips markdown fences and formats", () => {
        const raw = "```imol\nmodule m @id(\"m\")\n\nimport std.io as io\n\n@io\nfunction main() -> Unit\n  io.println(\"x\")\n  return ()\nend\n```";
        const r = sanitizeAndFormat(raw);
        expect(r.ok).toBe(true);
        expect(r.steps).toContain("stripped_fences");
        expect(r.output).toContain("module m");
        expect(r.output).not.toContain("```");
    });

    it("stripMarkdownFences alone", () => {
        expect(stripMarkdownFences("```\nmodule x\n```").trim()).toBe("module x");
    });
});
