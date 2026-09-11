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
- `examples/` — sample programs (`bad/`, `golden/`)

## Remote

```bash
git remote add origin git@github.com:kmfarris/imol.git
```
