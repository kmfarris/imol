# IMOL runtime roadmap (post–grammar v2)

Preview and planned work beyond spec 0.4.

## Shell (`std.shell`) — preview (this branch)

- **Check:** `std.shell.exec` is in the extern catalog; tools need `bind std.shell` and `@unsafe`.
- **Run:** handler returns `Err` with a fixed message until a gated implementation lands (no silent no-ops).
- Example: `examples/shell_preview.imol`.

## Async (planned)

- Syntax: `async function` / `await invoke` not in the parser yet.
- Target: workshop-scheduled invokes with trace entries for pending/async completion.
- Dogfood trigger: dogfood catalog or a service module that needs concurrent I/O.

## Live MCP server (planned)

- IMOL will not autostart external MCP servers (non-goal).
- Planned: optional **host bridge** tool that forwards `invoke` to an already-running MCP session configured in the workshop manifest.

## Bytecode (planned)

- Tree-walk interpreter remains default.
- Bytecode slice is optimization only; spec/IR stay fmt-canonical source.

## Next engineering steps

1. Implement `std.shell.exec` behind `workshop allow_shell true` (new capability flag).
2. Prototype async trace in `@imol/workshop` without changing check semantics.
3. LLM bench tasks for shell + async once syntax exists.
