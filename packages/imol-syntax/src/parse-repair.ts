import type { ModuleDecl } from "./ast.js";
import { ImolSyntaxError } from "./errors.js";
import { repairAgentGrammar } from "./grammar-repair.js";
import { parse } from "./parser.js";

export type ParseWithRepairResult = {
    module: ModuleDecl;
    source: string;
    repairs: string[];
};

const MAX_REPAIR_ROUNDS = 3;

/**
 * Parse IMOL source, applying grammar repair rounds until parse succeeds or repairs stall.
 */
export function parseWithRepair(source: string): ParseWithRepairResult {
    let s = source;
    const allRepairs: string[] = [];

    for (let round = 0; round < MAX_REPAIR_ROUNDS; round++) {
        try {
            return { module: parse(s), source: s, repairs: allRepairs };
        } catch (e) {
            if (!(e instanceof ImolSyntaxError)) {
                throw e;
            }
            const before = s;
            const { source: repaired, repairs } = repairAgentGrammar(s);
            if (repairs.length === 0 || repaired === before) {
                throw e;
            }
            s = repaired;
            allRepairs.push(...repairs);
        }
    }

    return { module: parse(s), source: s, repairs: allRepairs };
}
