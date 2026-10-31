import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkModule } from "@kmfarris/imol-check";
import { loadModuleFromFile } from "@kmfarris/imol-load";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("import merge", () => {
    it("loads entry_with_tools with imported read_file tool", async () => {
        const mod = await loadModuleFromFile(join(root, "examples/entry_with_tools.imol"), {
            projectRoot: join(root, "examples"),
        });
        const check = checkModule(mod);
        expect(check.diagnostics.filter((d) => d.code === "E_IMPORT_COLLISION")).toHaveLength(0);
        expect(check.ok).toBe(true);
        expect(mod.tools.some((t) => t.name === "read_file")).toBe(true);
    });
});
