# IMOL agent automation

Runnable oracle loop (same steps as MCP, no Cursor required).

## CLI

```bash
npm run imol -- agent loop --task "verify dogfood" --dry-llm examples/dogfood/catalog.imol
npm run imol -- agent loop --task "patch greet" --patch examples/agent/patch-greet.json examples/greet.imol
```

Flags:

- `--dry-llm` — prepare + check + workshop-plan on the file on disk (recommended default).
- `--patch path.json` — apply patch in memory on iteration 1.
- `--max-iter N` — LLM retries when not using `--dry-llm` (needs `IMOL_AGENTBENCH_API_KEY` or `OPENAI_API_KEY`).

Stdout JSON matches [`agent-api.json`](../packages/imol-spec/agent-api.json) `agent_loop`.

## MCP

Tool **`imol_agent_loop`** — same parameters as CLI (`task`, `file`, optional `patch_path`, `dry_llm`, `max_iter`).

## Local verify

See [LOCAL_VERIFY.md](LOCAL_VERIFY.md). Dogfood smoke:

```bash
npm run imol -- agent loop --dry-llm --task "dogfood oracle loop" examples/dogfood/catalog.imol
```

LLM loop (optional, uses your API key locally): omit `--dry-llm` and set `IMOL_AGENTBENCH_API_KEY` or `OPENAI_API_KEY`.

## Cursor Automation (recipe)

1. Trigger: schedule or manual in Cursor (this repo does not run GitHub Actions).
2. Enable MCP server **imol** (`scripts/imol-mcp.mjs`).
3. Agent instructions: link this doc; require `imol_agent_loop` with `dry_llm: true` before suggesting IMOL edits; never `run --approve` via MCP.

## Hooks

Project [`.cursor/hooks.json`](../.cursor/hooks.json): sessionStart reminder + afterFileEdit sanitize on `*.imol`.
