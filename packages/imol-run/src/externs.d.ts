import type { Value } from "./value.js";
export type ExternHandler = (args: Value[]) => Promise<Value> | Value;
export type ExternRegistry = Map<string, ExternHandler>;
export declare function createDefaultExterns(): ExternRegistry;
//# sourceMappingURL=externs.d.ts.map