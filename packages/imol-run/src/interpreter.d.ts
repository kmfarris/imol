import type { ModuleDecl } from "@imol/syntax";
import type { ExternRegistry } from "./externs.js";
import { type Value } from "./value.js";
export type RunOptions = {
    dryRun?: boolean;
    onTrace?: (entry: TraceEntry) => void;
};
export type TraceEntry = {
    kind: "invoke" | "extern" | "io";
    name: string;
    dryRun: boolean;
    detail?: string;
};
export declare class ImolRuntimeError extends Error {
    constructor(message: string);
}
export declare function runModule(mod: ModuleDecl, externs: ExternRegistry, options?: RunOptions): Promise<Value>;
//# sourceMappingURL=interpreter.d.ts.map