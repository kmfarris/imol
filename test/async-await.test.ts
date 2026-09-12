import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkModule } from "@imol/check";
import { loadModuleFromFile } from "@imol/load";
import { createExternRegistry, runCapabilities, runModule, type TraceEntry } from "@imol/run";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const asyncPath = join(root, "examples/async_preview.imol");

describe("await invoke", () => {
    it("checks async_preview example", async () => {
        const mod = await loadModuleFromFile(asyncPath, { projectRoot: join(root, "examples") });
        const check = checkModule(mod);
        expect(check.ok).toBe(true);
    });

    it("emits async_scheduled and async_done around invoke", async () => {
        const mod = await loadModuleFromFile(asyncPath, { projectRoot: join(root, "examples") });
        const caps = runCapabilities(mod.workshop, false);
        const externs = createExternRegistry(caps, mod.workshop?.binds ?? []);
        const trace: TraceEntry[] = [];
        await runModule(mod, externs, {
            dryRun: true,
            capabilities: caps,
            onTrace: (e) => trace.push(e),
        });
        const kinds = trace.map((e) => e.kind);
        expect(kinds).toContain("async_scheduled");
        expect(kinds).toContain("async_done");
        expect(kinds).toContain("invoke");
        const sched = kinds.indexOf("async_scheduled");
        const inv = kinds.indexOf("invoke");
        const done = kinds.indexOf("async_done");
        expect(sched).toBeLessThan(inv);
        expect(inv).toBeLessThan(done);
    });
});
