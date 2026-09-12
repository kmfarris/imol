import { describe, expect, it } from "vitest";
import { checkModule } from "@imol/check";
import { createExternRegistry } from "@imol/run";
import { parse } from "@imol/syntax";

const shellPreview = `module shell_preview

workshop
  allow_net false
  allow_write false
  bind std.shell
end

type Result = Ok Text | Err Text

tool echo from std.shell.exec @unsafe
  { command: Text } -> Result
`;

describe("std.shell.exec preview", () => {
    it("checks with bind std.shell", () => {
        const mod = parse(shellPreview);
        expect(checkModule(mod).ok).toBe(true);
    });

    it("runtime handler returns Err until enabled", async () => {
        const reg = createExternRegistry(
            { io: true, net: false, unsafe: true, write: false },
            ["std.shell"],
        );
        const handler = reg.get("std.shell.exec");
        expect(handler).toBeDefined();
        const out = await handler!([
            {
                kind: "record",
                fields: new Map([["command", { kind: "text", value: "echo hi" }]]),
            },
        ]);
        expect(out.kind).toBe("variant");
        if (out.kind === "variant" && out.name === "Err") {
            expect(out.payload.kind).toBe("text");
            expect(String((out.payload as { value: string }).value)).toContain("not enabled");
        }
    });
});
