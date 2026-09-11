import { type TraceEntry } from "@imol/run";
import type { ModuleDecl } from "@imol/syntax";
export type WorkshopOptions = {
    traceDir?: string;
    dryRun?: boolean;
    allowNet?: boolean;
};
export declare class WorkshopSession {
    readonly module: ModuleDecl;
    private readonly options;
    readonly trace: TraceEntry[];
    private readonly tracePath;
    constructor(module: ModuleDecl, options?: WorkshopOptions);
    run(): Promise<void>;
    private persistTrace;
    getTracePath(): string;
}
//# sourceMappingURL=session.d.ts.map