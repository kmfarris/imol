import { describe, expect, it } from "vitest";
import { checkModule } from "@kmfarris/imol-check";
import { createExternRegistry, runCapabilities } from "@kmfarris/imol-run";
import { parse } from "@kmfarris/imol-syntax";

const shellPreview = `module shell_preview

workshop
  allow_net false
  allow_write false
  allow_shell true
  bind std.shell
end

type Result = Ok Text | Err Text

tool echo from std.shell.exec @unsafe
  { command: Text } -> Result
`;

describe("std.shell.exec", () => {
    it("checks with bind std.shell and allow_shell", () => {
        const mod = parse(shellPreview);
        expect(checkModule(mod).ok).toBe(true);
    });

    it("errors when allow_shell false", () => {
        const mod = parse(shellPreview.replace("allow_shell true", "allow_shell false"));
        expect(checkModule(mod).ok).toBe(false);
    });

    it("allowlisted command succeeds when approved", async () => {
        const caps = runCapabilities({ allowNet: false, allowWrite: false, allowShell: true }, true);
        const reg = createExternRegistry(caps, ["std.shell"]);
        const handler = reg.get("std.shell.exec");
        expect(handler).toBeDefined();
        const out = await handler!([
            {
                kind: "record",
                fields: new Map([["command", { kind: "text", value: "echo hi" }]]),
            },
        ]);
        expect(out.kind).toBe("variant");
        if (out.kind === "variant" && out.name === "Ok" && out.payload.kind === "text") {
            expect(out.payload.value).toContain("hi");
        }
    });

    it("rejects non-allowlisted binary", async () => {
        const caps = runCapabilities({ allowNet: false, allowWrite: false, allowShell: true }, true);
        const reg = createExternRegistry(caps, ["std.shell"]);
        const out = await reg.get("std.shell.exec")!([
            {
                kind: "record",
                fields: new Map([["command", { kind: "text", value: "bash -c id" }]]),
            },
        ]);
        expect(out.kind).toBe("variant");
        if (out.kind === "variant" && out.name === "Err" && out.payload.kind === "text") {
            expect(out.payload.value).toContain("not allowlisted");
        }
    });
});
