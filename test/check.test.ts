import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkModule } from "@imol/check";
import { parse } from "@imol/syntax";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("check examples", () => {
    it("hello.imol passes", async () => {
        const src = await readFile(join(root, "examples/hello.imol"), "utf8");
        const result = checkModule(parse(src));
        expect(result.ok).toBe(true);
    });

    it("greet.imol passes", async () => {
        const src = await readFile(join(root, "examples/greet.imol"), "utf8");
        const result = checkModule(parse(src));
        if (!result.ok) {
            console.log(result.diagnostics);
        }
        expect(result.ok).toBe(true);
    });
});
