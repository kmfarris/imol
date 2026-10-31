import { describe, expect, it } from "vitest";
import { formatModule } from "@kmfarris/imol-fmt";
import { parse } from "../src/index.js";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const hello = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../examples/hello.imol"),
    "utf8",
);

describe("parse and fmt", () => {
    it("parses hello.imol", () => {
        const mod = parse(hello);
        expect(mod.name).toBe("hello");
        expect(mod.functions.length).toBe(1);
    });

    it("round-trips hello.imol", () => {
        const mod = parse(hello);
        const again = parse(formatModule(mod));
        expect(again.name).toBe(mod.name);
        expect(again.functions[0]?.name).toBe("main");
    });
});
