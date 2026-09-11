import { checkModule } from "@imol/check";
import { createDefaultExterns, runModule, type TraceEntry } from "@imol/run";
import type { ModuleDecl } from "@imol/syntax";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export type WorkshopOptions = {
    traceDir?: string;
    dryRun?: boolean;
    allowNet?: boolean;
};

export class WorkshopSession {
    readonly trace: TraceEntry[] = [];
    private readonly tracePath: string;

    constructor(
        readonly module: ModuleDecl,
        private readonly options: WorkshopOptions = {},
    ) {
        const dir = options.traceDir ?? ".imol-trace";
        this.tracePath = join(dir, `${module.name}.jsonl`);
    }

    async run(): Promise<void> {
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
            ...(this.options.dryRun ? { dryRun: true } : {}),
            onTrace: (entry) => {
                this.trace.push(entry);
                void this.persistTrace(entry);
            },
        });
    }

    private async persistTrace(entry: TraceEntry): Promise<void> {
        await appendFile(this.tracePath, `${JSON.stringify({ ...entry, ts: Date.now() })}\n`, "utf8");
    }

    getTracePath(): string {
        return this.tracePath;
    }
}
