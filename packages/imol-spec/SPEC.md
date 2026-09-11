# IMOL spec_version 0.3

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

## Patch format

See [patch-schema.json](patch-schema.json). CLI: `imol patch file.imol patches.json [--write]`.

Operations: `replace_decl_by_id`, `insert_after_id`, `delete_decl_by_id`.

## Diagnostics

`imol check file.imol --json` returns `{ ok, has_holes, diagnostics[] }` with optional `decl_id` when the error span falls inside a declaration carrying `@id`.

## Project manifest

`imol.json` or minimal `imol.toml` with `entry = "path.imol"`. `imol check` with no path uses the manifest entry.

## MCP tool import

`imol tools import mcp.json [out.imol]` generates IMOL tool stubs from an exported MCP tool list (offline JSON).

## Types

- Builtins: `Unit`, `Bool`, `Int`, `Text`, `Never`
- Records, sums, aliases
- No implicit casts

## Effects

`@pure`, `@io`, `@net`, `@unsafe` on functions and tools. Runtime enforces workshop and capability flags.

## Agent API (spec_version 0.3)

Cursor and other agents should use `imol agent` subcommands. Responses are JSON on stdout with `spec_version: "0.3"`. Schema: [agent-api.json](agent-api.json).

- `imol agent check [file.imol]` — same as `check --json`, plus `entry` path
- `imol agent fmt-check <file.imol>` — `{ ok, changed }` after parse → fmt → compare
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
