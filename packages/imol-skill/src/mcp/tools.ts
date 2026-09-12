import { readFile } from "node:fs/promises";
import { loadCodebook } from "../codebook/load.js";
import { loadRouterWeights } from "../router/weights.js";
import { routeSkills } from "../router/route.js";
import {
    agentCheck,
    agentFmtCheck,
    agentPatch,
    agentWorkshopPlan,
    defaultLoadModule,
} from "../oracle/agent.js";
import { assertPathAllowed } from "./paths.js";

function jsonText(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

export async function handleSkillRoute(args: {
    task: string;
    file?: string;
    file_snippet?: string;
    last_oracle_json?: string;
    k?: number;
}): Promise<string> {
    const codebook = await loadCodebook();
    const weights = await loadRouterWeights();
    let file_snippet = args.file_snippet;
    if (args.file && !file_snippet) {
        const abs = assertPathAllowed(args.file);
        file_snippet = await readFile(abs, "utf8");
    }
    const result = routeSkills(
        codebook,
        {
            task: args.task,
            k: args.k ?? 5,
            ...(file_snippet ? { file_snippet } : {}),
            ...(args.last_oracle_json ? { last_oracle_json: args.last_oracle_json } : {}),
        },
        weights,
    );
    return jsonText(result);
}

export async function handleSkillPrepare(args: {
    task: string;
    file?: string;
    k?: number;
}): Promise<string> {
    const codebook = await loadCodebook();
    const weights = await loadRouterWeights();
    let file_snippet: string | undefined;
    if (args.file) {
        const abs = assertPathAllowed(args.file);
        file_snippet = await readFile(abs, "utf8");
    }
    const route = routeSkills(
        codebook,
        {
            task: args.task,
            k: args.k ?? 5,
            ...(file_snippet ? { file_snippet } : {}),
        },
        weights,
    );
    return jsonText({
        spec_version: route.spec_version,
        packet: route.packet,
        codewords: route.codewords,
        tool_policy: route.tool_policy,
        token_estimate: route.token_estimate,
    });
}

export async function handleAgentCheck(args: {
    file: string;
    allow_holes?: boolean;
}): Promise<string> {
    const abs = assertPathAllowed(args.file);
    const body = await agentCheck(defaultLoadModule, abs, args.allow_holes ?? false);
    return jsonText(body);
}

export async function handleAgentFmtCheck(args: { file: string }): Promise<string> {
    const abs = assertPathAllowed(args.file);
    return jsonText(await agentFmtCheck(abs));
}

export async function handleAgentPatch(args: {
    file: string;
    patches_path: string;
}): Promise<string> {
    const imol = assertPathAllowed(args.file);
    const patches = assertPathAllowed(args.patches_path);
    return jsonText(await agentPatch(imol, patches));
}

export async function handleAgentWorkshopPlan(args: { file: string }): Promise<string> {
    const abs = assertPathAllowed(args.file);
    return jsonText(await agentWorkshopPlan(defaultLoadModule, abs));
}
