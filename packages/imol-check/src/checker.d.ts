import type { ModuleDecl } from "@imol/syntax";
import { CheckResult } from "./diagnostic.js";
export type CheckOptions = {
    allowHoles?: boolean;
};
export declare function checkModule(mod: ModuleDecl, options?: CheckOptions): CheckResult;
//# sourceMappingURL=checker.d.ts.map