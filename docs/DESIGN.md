# Why IMOL is shaped this way

AI coding assistants usually change a file by writing text into it, often before anyone has confirmed the new code is valid or what it will do. IMOL is designed so the safe steps come first: check the program for mistakes, edit it by permanent name tags rather than line numbers, rehearse its actions, and only then let it change anything. This document explains each step in more technical detail.

## Three jobs

1. **Check** (`imol agent check`) — merge imports, parse, report diagnostics. When a declaration has an `@id`, errors can point at that id so the next edit is surgical.
2. **Patch** (`imol agent patch`) — apply replace / insert / delete by id, in memory. Run check again before any write.
3. **Workshop-plan** (`imol agent workshop-plan`) — execute only the planned tool calls as a dry-run, under caps in the `workshop` block (`allow_net`, `allow_write`, `allow_shell`, MCP binds). The trace is the preview. `--approve` is a second, explicit step for real effects.

Agent responses are JSON with `spec_version` **0.4**. The language itself has moved to **0.5** (shell, async preview). Those two version numbers should travel together on the next schema change so hosts do not guess.

## Why ids instead of line numbers

Formatting rewrites whitespace and import order. A patch that says “replace the declaration with this UUID” still applies. Canonical fmt is the stored program; patches are defined against that form.

## MCP

`imol tools import` turns an exported MCP tool list into IMOL stubs. `check` does not start those servers. A program that calls `mcp.*` tools must `bind` them in the workshop block.

## Conformance

`npm run check` after `npm install` builds packages, runs unit tests, and runs conformance scripts on sample `.imol` files.

- [`packages/imol-spec/SPEC.md`](../packages/imol-spec/SPEC.md)
- [`packages/imol-spec/agent-api.json`](../packages/imol-spec/agent-api.json)
