import { describe, expect, it } from "vitest";
import { checkModule } from "@kmfarris/imol-check";
import { applyPatches } from "@kmfarris/imol-patch";
import { buildDeclIndex, parse } from "@kmfarris/imol-syntax";

describe("@id on types", () => {
    it("indexes type declarations", () => {
        const src = `module m
@id("result-type")
type Result = Ok Text | Err Text
function main() -> Unit
  return ()
end
`;
        const mod = parse(src);
        const index = buildDeclIndex(mod);
        expect(index.get("result-type")?.kind).toBe("type");
    });

    it("patches type by id", () => {
        const src = `module m
@id("result-type")
type Result = Ok Text | Err Text
function main() -> Unit
  return ()
end
`;
        const out = applyPatches(src, {
            patches: [
                {
                    op: "replace_decl_by_id",
                    id: "result-type",
                    source: 'type Result = Ok Int | Err Text',
                },
            ],
        });
        const check = checkModule(parse(out));
        expect(check.ok).toBe(true);
        expect(out).toContain("Ok Int");
    });
});
