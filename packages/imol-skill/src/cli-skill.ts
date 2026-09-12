import { readFile } from "node:fs/promises";
import { loadCodebook } from "./codebook/load.js";
import { loadRouterWeights } from "./router/weights.js";
import { routeSkills } from "./router/route.js";

export async function cmdSkillRoute(
    task: string,
    filePath: string | undefined,
    k: number,
    lastOraclePath: string | undefined,
): Promise<number> {
    const codebook = await loadCodebook();
    const weights = await loadRouterWeights();
    let file_snippet: string | undefined;
    if (filePath) {
        file_snippet = await readFile(filePath, "utf8");
    }
    let last_oracle_json: string | undefined;
    if (lastOraclePath) {
        last_oracle_json = await readFile(lastOraclePath, "utf8");
    }
    const result = routeSkills(
        codebook,
        {
            task,
            k,
            ...(file_snippet ? { file_snippet } : {}),
            ...(last_oracle_json ? { last_oracle_json } : {}),
        },
        weights,
    );
    console.log(JSON.stringify(result, null, 2));
    return 0;
}
