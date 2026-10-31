# IMOL

LLMs edit source by emitting diffs and tool calls. The file often breaks before anyone runs the typechecker: half a declaration, duplicated `@id`, a plan block that invokes write before the module parses. **IMOL** is a language and runtime built for that loop—typed tools, effect tags, canonical formatting as the IR, patches keyed by declaration UUID, and a **workshop** session that traces plan invokes in dry-run before anything hits disk.

Cursor and other hosts integrate through **`imol agent`** JSON on stdout and MCP tools (`imol_agent_check`, `imol_agent_patch`, `imol_agent_workshop_plan`) so the model gets pass/fail oracles instead of guessing from stderr.

## Status

| Area | State |
|------|--------|
| Parser, checker, fmt, patch, run, workshop | Shipped in monorepo packages; **`npm run check`** (build + vitest + conformance) green |
| Language surface | Spec **0.5** — shell (`std.shell.exec`), async invoke preview, workshop/plan semantics |
| Agent / MCP JSON | Spec **0.4** on stdout — schema in [`packages/imol-spec/agent-api.json`](packages/imol-spec/agent-api.json) |
| Skill codebook + router | CSD codewords, `imol skill route`, MCP skill host ([`packages/imol-skill`](packages/imol-skill)) |
| Formal semantics / npm publish | Not claimed; publish tooling may live on feature branches |

Design notes: [`docs/DESIGN.md`](docs/DESIGN.md) · terminal walkthrough: [`docs/DEMO.md`](docs/DEMO.md)

## Quick start

```bash
npm install
npm run build
npm run imol -- check examples/greet.imol
npm run imol -- agent check examples/dogfood/catalog.imol
```

Cursor MCP: [`.cursor/mcp.json`](.cursor/mcp.json) · dogfood loop: [`docs/HAPPY_PATH.md`](docs/HAPPY_PATH.md), [`docs/ONBOARDING.md`](docs/ONBOARDING.md) · runtime roadmap: [`docs/ROADMAP_RUNTIME.md`](docs/ROADMAP_RUNTIME.md).

```bash
npm run imol -- run examples/hello.imol
npm run imol -- workshop examples/workshop_read.imol --dry-run
npm run imol -- run examples/plan_demo.imol --approve
npm run conformance
```

## Agent loop (Cursor)

MCP when the **imol** server is connected: `imol_skill_prepare` → edit / `imol_agent_patch` → `imol_agent_check` → `imol_agent_workshop_plan`.

CLI: `imol agent check` · `imol agent patch` · `imol agent workshop-plan` · real execution only with `imol run --approve` / `imol workshop --approve`.

See `.cursor/rules/imol.mdc`.

## Skill dictionary (CSD)

```bash
npm run imol -- skill route "patch greet by @id" --file examples/greet.imol
npm run skill:bench
```

MCP example config: [`packages/imol-skill/mcp/cursor-mcp.example.json`](packages/imol-skill/mcp/cursor-mcp.example.json) · [`packages/imol-skill/README.md`](packages/imol-skill/README.md)

## Repository layout

- `packages/imol-syntax` — lexer, parser, AST
- `packages/imol-fmt` — canonical formatter (IR)
- `packages/imol-check` — type and effect checker
- `packages/imol-run` — tree-walk interpreter
- `packages/imol-workshop` — session, trace, dry-run
- `packages/imol-cli` — `imol` command
- `packages/imol-patch` — `@id` patch application
- `packages/imol-load` — manifest + multi-file import
- `packages/imol-spec` — language spec (0.5 surface, 0.4 agent JSON)
- `packages/imol-skill` — skill codebook, router, MCP
- `examples/` — sample programs (`bad/`, `golden/`)
