import { describe, expect, it } from "vitest";
import { checkModule } from "@kmfarris/imol-check";
import { parse } from "@kmfarris/imol-syntax";
import { isExternAllowed, isKnownExternKey } from "@kmfarris/imol-syntax";

describe("mcp.* extern catalog", () => {
    it("recognizes dynamic mcp keys", () => {
        expect(isKnownExternKey("mcp.search")).toBe(true);
        expect(isKnownExternKey("std.fs.read")).toBe(true);
        expect(isKnownExternKey("bogus.key")).toBe(false);
    });

    it("requires bind tools.mcp in workshop", () => {
        expect(
            isExternAllowed("mcp.search", { binds: ["tools.mcp"], allowWrite: false }),
        ).toBe(true);
        expect(
            isExternAllowed("mcp.search", { binds: ["std.fs"], allowWrite: false }),
        ).toBe(false);
    });

    it("mcp import stub checks with workshop bind", async () => {
        const source = `module mcp_test @id("mcp-test")

workshop
  allow_net false
  allow_write false
  bind tools.mcp
end

type Result = Ok Text | Err Text

tool search from mcp.search @io
  { query: Text } -> Result
`;
        const mod = parse(source);
        const result = checkModule(mod);
        expect(result.ok).toBe(true);
    });
});
