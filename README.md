# IMOL

LLM-native language and live **Workshop** runtime: typed tools, effect checks, audit trace.

## Quick start

```bash
npm install
npm run build
npm run imol -- run examples/hello.imol
npm run imol -- check examples/greet.imol
npm run imol -- workshop examples/workshop_read.imol --dry-run
npm run imol -- check --json examples/greet.imol
npm run imol -- run examples/plan_demo.imol --approve
npm run conformance
npm run imol -- agent check examples/greet.imol
```

## Agent loop (Cursor)

1. `imol agent check [file]` — JSON diagnostics before editing IMOL.
2. `imol agent patch <file> <patches.json>` — apply patches in memory; verify nested `check`.
3. `imol agent workshop-plan [file]` — dry-run plan invokes; inspect `trace` before side effects.
4. Use `imol run --approve` / `imol workshop --approve` only when the user wants real execution.

See `.cursor/rules/imol.mdc` and `packages/imol-spec/agent-api.json`.

## Skill dictionary (CSD)

Closed-model hosts can inject a minimal packet instead of full SPEC:

```bash
npm run imol -- skill route "patch greet by @id" --file examples/greet.imol
npm run skill:bench
```

MCP (production stdio): configure Cursor with [packages/imol-skill/mcp/cursor-mcp.example.json](packages/imol-skill/mcp/cursor-mcp.example.json), then use tools `imol_skill_prepare`, `imol_agent_check`, etc. See [packages/imol-skill/README.md](packages/imol-skill/README.md).

## Repository layout

- `packages/imol-syntax` — lexer, parser, AST
- `packages/imol-fmt` — canonical formatter (IR)
- `packages/imol-check` — type and effect checker
- `packages/imol-run` — tree-walk interpreter
- `packages/imol-workshop` — session, trace, dry-run
- `packages/imol-cli` — `imol` command
- `packages/imol-patch` — `@id` patch application
- `packages/imol-load` — manifest + multi-file import
- `packages/imol-spec` — language spec (0.3), agent API JSON
- `packages/imol-skill` — flat skill codebook (CSD), router, `imol skill route`, MCP host
- `examples/` — sample programs (`bad/`, `golden/`)

## Remote

```bash
git remote add origin git@github.com:kmfarris/imol.git
```
