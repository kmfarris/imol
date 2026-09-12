export const TOP_HELP = `imol — IMOL language CLI

Usage:
  imol <command> [options]

Commands:
  check [file]           Typecheck (manifest entry if file omitted)
  fmt <file>             Print canonical source
  run [file]             Execute module
  patch <file> <json>    Apply patch operations
  workshop [file]        Workshop session (trace, dry-run, approve)
  tools import <json>    Generate tool stubs from MCP export
  agent <subcmd>         Machine JSON API for agents (see spec agent-api.json)
  skill <subcmd>         IMOL skill dictionary route / MCP host
  lsp                    Stdio language server (check diagnostics on open/save)

Global:
  imol --help            This message
  imol <cmd> --help      Command help
`;

export const CMD_HELP: Record<string, string> = {
    check: `imol check [file.imol] [--json] [--allow-holes]`,
    fmt: `imol fmt <file.imol> [--write]`,
    run: `imol run [file.imol] [--approve]`,
    patch: `imol patch <file.imol> <patches.json> [--write]`,
    workshop: `imol workshop [file.imol] [--dry-run] [--approve]
  imol workshop trace [trace.jsonl]
  imol workshop replay <planned.jsonl> <executed.jsonl>`,
    tools: `imol tools import <mcp.json> [out.imol]`,
    agent: `imol agent check [file.imol]
  imol agent fmt-check <file.imol>
  imol agent patch <file.imol> <patches.json>
  imol agent workshop-plan [file.imol]

Stdout is JSON only. Errors: { ok: false, error, spec_version: "0.3" }`,
    skill: `imol skill route "<task>" [--file path.imol] [--k 5] [--oracle last.json]
  imol skill mcp          Stdio MCP server (skill route + agent tool defs)`,
};
