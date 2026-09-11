import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkModule } from "@imol/check";
import { applyPatches } from "@imol/patch";
import { parse } from "@imol/syntax";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("patch by @id", () => {
    it("replaces greet function", () => {
        const src = readFileSync(join(root, "examples/greet.imol"), "utf8");
        const out = applyPatches(src, {
            patches: [
                {
                    op: "replace_decl_by_id",
                    id: "greet-fn",
                    source: `@io
function greet(name Text) -> Result
  if name == ""
    return Err("name required")
  end
  return Ok("patched")
end`,
                },
            ],
        });
        const mod = parse(out);
        const check = checkModule(mod);
        expect(check.ok).toBe(true);
        expect(out).toContain("patched");
    });
});
