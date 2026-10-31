# IMOL

When an AI assistant writes a program, it usually pastes text: a diff, a blob of JSON, a tool call that writes a file. The program is often not even parseable yet. Line numbers drift after formatting. Network or disk actions fire before anyone has looked at a plan.

**IMOL** is a small language and a set of tools built for that loop. An IMOL program has types, named tools, and a **workshop** block that says what the program is allowed to do (network, write, shell). Formatting is the official form of the file. Every declaration can carry a stable **id**, so an assistant replaces “the function named *this*” instead of “lines 40–62.” Before anything hits disk, the assistant can:

1. **Check** — parse and typecheck; get machine-readable errors.
2. **Patch** — apply id-keyed edits in memory and check again.
3. **Workshop-plan** — dry-run planned tool calls and inspect a trace.

The purpose of the project is to give coding agents a language they can *verify* and a runtime they can *preview*, instead of treating source files as throwaway buffers.

## What works

- Parser, formatter, type/effect checker, interpreter, patcher, and workshop runtime ship as packages in this monorepo.
- Agent commands (`imol agent check`, `patch`, `workshop-plan`) print JSON that editors and MCP hosts can branch on. Cursor can call the same oracles as MCP tools.
- Workshop dry-run records intended side effects; real execution needs an explicit `--approve`.
- A skill codebook and router (`imol skill route`) help closed-model hosts pick the right command without loading the full spec.
- **`npm run check`** (build, unit tests, conformance) is the release bar on a clean clone.

Walkthrough: [`docs/DESIGN.md`](docs/DESIGN.md) · command outline: [`docs/DEMO.md`](docs/DEMO.md)

## What still needs work

- Language features (shell, async preview) are at spec **0.5**; the JSON that agents read is still **0.4**. A later bump should migrate both together.
- Formal semantics of the language are not written. Publishing to npm may live on a feature branch until that process is finished.
- IMOL does not start MCP servers for you; the editor or host process does.

## Quick start

```bash
npm install
npm run build
npm run imol -- check examples/greet.imol
npm run imol -- agent check examples/dogfood/catalog.imol
```

More:

```bash
npm run imol -- run examples/hello.imol
npm run imol -- workshop examples/workshop_read.imol --dry-run
npm run imol -- run examples/plan_demo.imol --approve
npm run conformance
```

Cursor MCP config: [`.cursor/mcp.json`](.cursor/mcp.json). Onboarding: [`docs/HAPPY_PATH.md`](docs/HAPPY_PATH.md), [`docs/ONBOARDING.md`](docs/ONBOARDING.md). Runtime roadmap: [`docs/ROADMAP_RUNTIME.md`](docs/ROADMAP_RUNTIME.md).

Typical agent sequence with MCP connected: `imol_skill_prepare` → edit or `imol_agent_patch` → `imol_agent_check` → `imol_agent_workshop_plan`. Real side effects: `imol run --approve` / `imol workshop --approve`.

## Skill dictionary

```bash
npm run imol -- skill route "patch greet by @id" --file examples/greet.imol
npm run skill:bench
```

MCP example: [`packages/imol-skill/mcp/cursor-mcp.example.json`](packages/imol-skill/mcp/cursor-mcp.example.json)

## Packages

| Package | Role |
|---------|------|
| `imol-syntax` | Lexer, parser, AST |
| `imol-fmt` | Canonical formatter (the stored form of a program) |
| `imol-check` | Types and effects |
| `imol-run` | Interpreter |
| `imol-workshop` | Session, trace, dry-run |
| `imol-cli` | `imol` command |
| `imol-patch` | Edits by declaration id |
| `imol-load` | Manifest and multi-file import |
| `imol-spec` | Language spec (0.5) and agent JSON schema (0.4) |
| `imol-skill` | Codebook, router, MCP |

Examples live in `examples/` (`bad/`, `golden/`).
