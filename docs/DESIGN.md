# Design: check before patch, plan before side effects

Patches and tool invokes often arrive before the module parses. IMOL runs parse → diagnose → canonical fmt first; agents edit against that IR, not raw text alone.

## Editing model

LLM-authored edits arrive as partial syntax, duplicated declarations, or JSON tool payloads that assume a valid module. Applying them blindly corrupts the file or hides errors until runtime. IMOL separates three concerns:

1. **Oracle (`imol agent check`)** — parse merged imports, surface diagnostics with optional `@id` anchors, return JSON suitable for automated retry loops.
2. **Surgical edit (`imol agent patch`)** — apply id-keyed operations in memory; re-check before any write.
3. **Effect preview (`imol agent workshop-plan`)** — dry-run plan invokes under workshop caps before approval.

The agent API (`spec_version` **0.4** on stdout JSON) is stable for Cursor and MCP integrations. Language surface features may advance (spec **0.5** for shell, async preview); agent responses remain on 0.4 until a deliberate bump with schema migration.

## Why IDs beat line numbers

Patches address declarations by stable `@id` UUIDs (`replace_decl_by_id`, `insert_after_id`, `delete_decl_by_id`). Line-based diffs drift when fmt or imports change. ID-keyed ops commute with canonical formatting: fmt is the IR.

## Workshop as capability envelope

The `workshop` block declares `allow_net`, `allow_write`, `allow_shell`, and MCP binds. Runtime enforces these flags; workshop dry-run emits a trace without mutating disk. Approval (`--approve`) is a deliberate second step—agents can propose plans; humans or policy gates execution.

## MCP and offline tooling

`imol tools import` generates stubs from exported MCP tool lists. The host starts servers; IMOL does not silently spawn network clients during `check`. Dynamic `mcp.*` tools require explicit workshop bind.

## Conformance

The monorepo ships `npm run conformance`: build all packages, run vitest, execute conformance scripts on representative `.imol` modules. A clean clone should pass `npm run check` after `npm install`.

## Further reading

- [`packages/imol-spec/SPEC.md`](../packages/imol-spec/SPEC.md) — grammar, agent API section
- [`packages/imol-spec/agent-api.json`](../packages/imol-spec/agent-api.json) — response schemas
