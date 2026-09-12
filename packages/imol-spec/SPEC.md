# IMOL spec_version 0.4

IMOL is a language for LLM-authored programs and tool orchestration. Canonical formatted source is the IR.

## Module

```
module <name> [@id("uuid")]...
<imports>
<workshop>? 
<plan>* 
<tools>*
<types>*
<functions>*
```

Module-level `@id` must not appear immediately before a `plan` block (parser treats `@id` as starting a function). Use `@id` on functions, tools, types, or the module line.

## Workshop

```
workshop
  allow_net true|false
  allow_write true|false
  bind <module.path>
end
```

## Plan

```
plan
  invoke <tool> { ... }
end
```

`run plan` inside a function executes the module plan when the session is approved (`imol run --approve` or `imol workshop --approve`).

When a module has a `plan` block and workshop runs **without** `--approve`, only plan invokes run (dry-run); `main` is not executed. State becomes `Planned`. With `--approve`, the full program including `run plan` runs.

## Tools

```
tool <name> from <extern.key> [@io|@net|@pure]...
  { field: Type, ... } -> <output Type>
```

Bundled extern keys include `std.fs.read`, `std.fs.list`, `std.fs.write` (write requires `allow_write true`).

**Preview:** `std.shell.exec` is recognised at check time with `bind std.shell`; runtime returns a structured `Err` until shell execution is enabled (see [docs/ROADMAP_RUNTIME.md](../../docs/ROADMAP_RUNTIME.md)).

Dynamic **MCP** tools use `from mcp.<toolName>` and require `bind tools.mcp` (or `bind mcp`) in the workshop block. Generate stubs with `imol tools import`.

## Patch format

See [patch-schema.json](patch-schema.json). CLI: `imol patch file.imol patches.json [--write]`.

Operations: `replace_decl_by_id`, `insert_after_id`, `delete_decl_by_id`.

## Diagnostics

`imol check file.imol --json` returns `{ ok, has_holes, diagnostics[] }` with optional `decl_id` when the error span falls inside a declaration carrying `@id`.

## Project manifest

`imol.json` or minimal `imol.toml` with `entry = "path.imol"`. `imol check` with no path uses the manifest entry.

## MCP tool import

`imol tools import mcp.json [out.imol]` generates IMOL tool stubs from an exported MCP tool list (offline JSON), including a workshop block with `bind tools.mcp`.

## Language server

`imol lsp` runs a stdio LSP that publishes `checkModule` diagnostics on open/save for `*.imol` files (multi-file via import merge on disk).

## Comments

Line comments begin with `#` or `//` and run to end of line.

## Grammar reference

Formal surface grammar: [GRAMMAR.ebnf](GRAMMAR.ebnf). CLI: `imol grammar show`.

## Agent output (grammar v2)

`imol agent sanitize` / MCP `imol_agent_sanitize` runs the repair pipeline (smart quotes, `//` comments, orphan `@id` before `plan`, etc.), then `parseWithRepair` and canonical fmt. Project hook: `.cursor/hooks/imol-after-imol-edit.mjs` on agent `Write` of `*.imol`. Dry-run repairs: `imol grammar repair file.imol`.

## Types

- Builtins: `Unit`, `Bool`, `Int`, `Text`, `Never`
- Records, sums, aliases
- No implicit casts

## Effects

`@pure`, `@io`, `@net`, `@unsafe` on functions and tools. Runtime enforces workshop and capability flags.

## Agent API (spec_version 0.4)

Cursor and other agents should use `imol agent` subcommands or MCP oracle tools. Responses are JSON on stdout with `spec_version: "0.4"`. Schema: [agent-api.json](agent-api.json).

- `imol agent check [file.imol]` — same as `check --json`, plus `entry` path
- `imol agent fmt-check <file.imol>` — `{ ok, changed }` after parse → fmt → compare
- `imol agent sanitize <file.imol> [--write]` / `--stdin` — post-filter LLM output, optional nested `check`
- `imol agent patch <file.imol> <patches.json>` — apply in memory; `{ output, check }` (does not write)
- `imol agent workshop-plan [file.imol]` — dry-run workshop; `{ trace, state, trace_path }`

Failures emit `{ ok: false, error, spec_version }` on stdout for agent subcommands.

## CLI

- `imol check [file.imol] [--json] [--allow-holes]`
- `imol fmt file.imol [--write]`
- `imol run [file.imol] [--approve]`
- `imol patch file.imol patches.json [--write]`
- `imol workshop [file.imol] [--dry-run] [--approve]`
- `imol workshop trace [file.jsonl]`
- `imol tools import mcp.json [out.imol]`
- `imol lsp` — stdio language server
