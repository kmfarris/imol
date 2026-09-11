import { checkModule } from "@imol/check";
import { createDefaultExterns, runModule } from "@imol/run";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
export class WorkshopSession {
    module;
    options;
    trace = [];
    tracePath;
    constructor(module, options = {}) {
        this.module = module;
        this.options = options;
        const dir = options.traceDir ?? ".imol-trace";
        this.tracePath = join(dir, `${module.name}.jsonl`);
    }
    async run() {
        const check = checkModule(this.module);
        if (!check.ok) {
            const msg = check.diagnostics.map((d) => d.message).join("; ");
            throw new Error(`Check failed: ${msg}`);
        }
        if (this.module.workshop?.allowNet && !this.options.allowNet) {
            throw new Error("Workshop allow_net true but session allowNet is false");
        }
        await mkdir(this.options.traceDir ?? ".imol-trace", { recursive: true });
        await runModule(this.module, createDefaultExterns(), {
            dryRun: this.options.dryRun,
            onTrace: (entry) => {
                this.trace.push(entry);
                void this.persistTrace(entry);
            },
        });
    }
    async persistTrace(entry) {
        await appendFile(this.tracePath, `${JSON.stringify({ ...entry, ts: Date.now() })}\n`, "utf8");
    }
    getTracePath() {
        return this.tracePath;
    }
}
//# sourceMappingURL=session.js.map