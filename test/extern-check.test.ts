import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkModule } from "@imol/check";
import { parse } from "@imol/syntax";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("E_EXTERN", () => {
    it("rejects unknown extern key when workshop present", () => {
        const src = `module t
workshop
  allow_net false
  allow_write false
  bind std.fs
end
tool bad from bogus.key @io
  { path: Text } -> Unit
function main() -> Unit
  return ()
end
`;
        const result = checkModule(parse(src));
        expect(result.ok).toBe(false);
        expect(result.diagnostics.some((d) => d.code === "E_EXTERN")).toBe(true);
    });

    it("accepts std.fs.read with bind std.fs", () => {
        const src = readFileSync(join(root, "examples/workshop_read.imol"), "utf8");
        const result = checkModule(parse(src));
        expect(result.diagnostics.filter((d) => d.code === "E_EXTERN")).toHaveLength(0);
    });
});
