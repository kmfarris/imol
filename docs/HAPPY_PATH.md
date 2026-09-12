# IMOL happy path (dogfood + MCP)

This repo dogfoods IMOL on **`examples/dogfood/`**: a multi-step module with workshop binds, imported tools, a **plan**, and `@id` anchors for patches.

## Build once

```bash
npm install
npm run build
```

## CLI sanity

```bash
npm run imol -- check examples/dogfood/catalog.imol
npm run imol -- agent check examples/dogfood/catalog.imol
npm run imol -- agent workshop-plan examples/dogfood/catalog.imol
npm run imol -- run examples/dogfood/catalog.imol --approve
```

## Cursor MCP loop (recommended)

1. Enable MCP: project [`.cursor/mcp.json`](../.cursor/mcp.json) → `scripts/imol-mcp.mjs` with `IMOL_WORKSPACE_ROOT=${workspaceFolder}`.
2. **`imol_skill_prepare`** — task e.g. “add a third read in dogfood plan for `examples/plan_demo.imol`”, file `examples/dogfood/catalog.imol`.
3. Edit IMOL (or **`imol_agent_patch`** with `@id("dogfood-main")` / module `@id("dogfood-app")`).
4. **`imol_agent_check`** on `examples/dogfood/catalog.imol` until diagnostics are clean.
5. **`imol_agent_workshop_plan`** — inspect trace before any real I/O.
6. Run **`imol run … --approve`** in the terminal only when you intend side effects (not exposed on MCP).

See [packages/imol-skill/README.md](../packages/imol-skill/README.md) and [`.cursor/rules/imol.mdc`](../.cursor/rules/imol.mdc).

## Patch target

Extend the `plan` block in `catalog.imol` (plans cannot take `@id`; anchor edits on `@id("dogfood-main")` or the module id).
