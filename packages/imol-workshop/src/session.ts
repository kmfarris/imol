import { checkModule } from "@imol/check";
import {
    capabilitiesFromWorkshop,
    createExternRegistry,
    runModule,
    runPlanDryRun,
    type TraceEntry,
} from "@imol/run";
import type { ModuleDecl } from "@imol/syntax";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type WorkshopState = "Checked" | "Planned" | "Approved" | "Executed";

export type WorkshopOptions = {
    traceDir?: string;
    dryRun?: boolean;
    allowNet?: boolean;
    approve?: boolean;
    planApproved?: boolean;
};

export class WorkshopSession {
    readonly trace: TraceEntry[] = [];
    private readonly tracePath: string;
    private readonly statePath: string;
    state: WorkshopState = "Checked";

    constructor(
        readonly module: ModuleDecl,
        private readonly options: WorkshopOptions = {},
    ) {
        const dir = options.traceDir ?? ".imol-trace";
        this.tracePath = join(dir, `${module.name}.jsonl`);
        this.statePath = join(dir, `${module.name}.state.json`);
    }

    async run(): Promise<void> {
        const check = checkModule(this.module);
        if (!check.ok) {
            const msg = check.diagnostics.map((d) => d.message).join("; ");
            throw new Error(`Check failed: ${msg}`);
        }
        this.state = "Checked";
        if (this.module.workshop?.allowNet && !this.options.allowNet) {
            throw new Error("Workshop allow_net true but session allowNet is false");
        }
        const dir = this.options.traceDir ?? ".imol-trace";
        await mkdir(dir, { recursive: true });

        const overrides: Partial<import("@imol/run").Capabilities> = {};
        if (this.options.allowNet) overrides.net = true;
        if (this.module.workshop?.allowWrite) overrides.write = true;
        const caps = capabilitiesFromWorkshop(this.module.workshop, overrides);
        const binds = this.module.workshop?.binds ?? [];
        const externs = createExternRegistry(caps, binds);

        const approved = this.options.approve ?? this.options.planApproved ?? false;
        const dryRun = this.options.dryRun ?? false;
        const hasPlan = this.module.plans.length > 0;
        const traceHandler = (entry: TraceEntry) => {
            this.trace.push(entry);
            void this.persistTrace(entry);
        };

        if (hasPlan && !approved) {
            this.state = "Planned";
            await runPlanDryRun(this.module, externs, {
                capabilities: caps,
                onTrace: traceHandler,
            });
            await writeFile(
                join(dir, "last-trace.json"),
                JSON.stringify({ path: this.tracePath, module: this.module.name }, null, 2),
                "utf8",
            );
            await writeFile(this.statePath, JSON.stringify({ state: this.state }, null, 2), "utf8");
            return;
        }

        if (dryRun) {
            this.state = "Planned";
        } else if (approved) {
            this.state = "Approved";
        }

        await runModule(this.module, externs, {
            ...(dryRun ? { dryRun: true } : {}),
            capabilities: caps,
            planApproved: approved,
            onTrace: traceHandler,
        });

        if (!dryRun) {
            this.state = "Executed";
        }
        await writeFile(
            join(dir, "last-trace.json"),
            JSON.stringify({ path: this.tracePath, module: this.module.name }, null, 2),
            "utf8",
        );
        await writeFile(this.statePath, JSON.stringify({ state: this.state }, null, 2), "utf8");
    }

    private async persistTrace(entry: TraceEntry): Promise<void> {
        await appendFile(this.tracePath, `${JSON.stringify(entry)}\n`, "utf8");
    }

    getTracePath(): string {
        return this.tracePath;
    }

    getStatePath(): string {
        return this.statePath;
    }

    static async readTraceFile(path: string): Promise<TraceEntry[]> {
        try {
            const raw = await readFile(path, "utf8");
            return raw
                .split("\n")
                .filter(Boolean)
                .map((line) => JSON.parse(line) as TraceEntry);
        } catch {
            return [];
        }
    }
}
