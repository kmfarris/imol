# @imol/skill — IMOL Skill Dictionary (CSD)

Host-side flat codebook + router + packet compiler for closed-model APIs. Replaces stuffing full SPEC into context.

## Commands

```bash
npm run imol -- skill route "patch greet by id" --file examples/greet.imol --k 5
npm run skill:bench   # codeword recall + llm_eval (skipped without API key)
npm run skill:train   # synth oracle trajectories + train router weights
npm run imol -- skill mcp   # stdio MCP server (official SDK)
# or after build:
npx imol-mcp
```

## MCP server (Cursor)

1. `npm run build` in repo root.
2. Add MCP config (merge into Cursor Settings → MCP):

   Prefer `${workspaceFolder}/scripts/imol-mcp.mjs` (see [mcp/cursor-mcp.example.json](mcp/cursor-mcp.example.json)) so paths work when the workspace root is the repo.

3. Set `IMOL_WORKSPACE_ROOT` to your project root (example uses `${workspaceFolder}`).

### Tools

| Tool | Purpose |
|------|---------|
| `imol_skill_prepare` | **Start here:** task + optional file → packet + tool_policy |
| `imol_skill_route` | Codewords + packet only |
| `imol_agent_check` | Same as `imol agent check` (in-process oracle) |
| `imol_agent_fmt_check` | Canonical fmt comparison |
| `imol_agent_patch` | Dry-run patch + nested check |
| `imol_agent_workshop_plan` | Dry-run plan trace (no `--approve`) |

### Resources

- `imol://codebook/v0.3` — codeword id list
- `imol://codebook/v0.3/{id}` — one codeword expansion

### Recommended agent loop (MCP)

1. `imol_skill_prepare` with user task and target `.imol` path.
2. Edit IMOL (prefer patch JSON + `@id`).
3. `imol_agent_check` on the file; fix diagnostics.
4. Before side effects: `imol_agent_workshop_plan`.
5. Do **not** expose `run --approve` via MCP unless explicitly added later.

Paths must resolve under `IMOL_WORKSPACE_ROOT`.

Dogfood walkthrough: [docs/HAPPY_PATH.md](../../docs/HAPPY_PATH.md).

### AgentBench LLM metrics

`skill:bench` reports `llm_eval.check_pass_at_1` / `check_pass_at_3` when:

```bash
export IMOL_AGENTBENCH_API_KEY=...   # or OPENAI_API_KEY
export IMOL_AGENTBENCH_MODEL=gpt-4o-mini   # optional
npm run skill:bench
```

Without a key, `llm_eval.skipped` is true (CI-safe).

## Layout

- `codebook/v0.3.json` — flat codeword table (built via `npm run codebook:build -w @imol/skill`)
- `codebook/codebook-schema.json` — JSON schema
- `codebook/router-weights.json` — trained sparse router (after `skill:train`)
- `bench/scenarios.json` — IMOL-AgentBench scenarios + baseline definitions
- `data/oracle-trajectories.jsonl` — synthetic oracle-labeled steps
- `src/oracle/agent.ts` — shared with `imol agent` CLI

## Spec

Pinned to IMOL `spec_version` **0.3**. Regenerate codebook when spec bumps.
