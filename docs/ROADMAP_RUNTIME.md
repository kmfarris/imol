# IMOL runtime roadmap (post–grammar v2)

Preview and planned work beyond spec 0.4.

## Shell (`std.shell`) — implemented (spec 0.5)

- **Check:** `std.shell.exec`, `bind std.shell`, `allow_shell true`.
- **Run:** allowlisted `execFile` + `--approve`. See `examples/shell_preview.imol`.

## Async — preview (spec 0.5)

- **Syntax:** statement `await invoke <tool> { ... }` only (no `async function` yet).
- **Runtime:** sequential execution (same as `invoke`); workshop trace adds `async_scheduled` / `async_done` metadata around the invoke.
- **Example:** `examples/async_preview.imol`.

## Live MCP server (manifest preview)

- IMOL will not autostart external MCP servers (non-goal).
- **`imol.json`:** optional `mcp_servers: [{ name, command }]` documents host-side MCP processes for editors/agents.
- **Forward path:** future `extern mcp_host.*` bridge to an already-running session (see SPEC appendix).

## Bytecode (planned)

- Tree-walk interpreter remains default.
- Bytecode slice is optimization only; spec/IR stay fmt-canonical source.

## Next engineering steps

1. Implement `std.shell.exec` behind `workshop allow_shell true` (new capability flag).
2. Prototype async trace in `@imol/workshop` without changing check semantics.
3. LLM bench tasks for shell + async once syntax exists.
