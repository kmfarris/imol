import { agentFail } from "@kmfarris/imol-skill/oracle";
import type { ImolSyntaxError } from "@kmfarris/imol-syntax";

export {
    AGENT_SPEC_VERSION,
    agentCheck,
    agentFail,
    agentFmtCheck,
    agentPatch,
    agentSanitize,
    agentSanitizeFile,
    agentWorkshopPlan,
    agentLoop,
    defaultLoadModule,
    type AgentError,
    type LoadModuleFn,
} from "@kmfarris/imol-skill/oracle";

export function printAgentJson(value: object): void {
    console.log(JSON.stringify(value));
}

export function printAgentError(message: string): void {
    console.log(JSON.stringify(agentFail(message)));
}

export function printAgentSyntaxError(e: ImolSyntaxError): void {
    console.log(JSON.stringify({ ...agentFail(e.message), code: e.code, span: e.span }));
}
