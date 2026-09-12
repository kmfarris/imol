# IMOL cheat sheet (baseline B)

- Module: `module name` then workshop/imports/plans/tools/types/functions; need `main()`.
- Agent: `imol agent check` → patch by `@id` → `workshop-plan`; spec 0.3 JSON stdout.
- Never `--approve` unless user asked.
- Tools: `tool x from std.fs.read @io` + workshop `bind std.fs`.
- Plan: dry-run without approve; full run needs `--approve`.
- Patch ops: replace_decl_by_id, insert_after_id, delete_decl_by_id.
- Errors: E_EXTERN (bad from), E_IMPORT_COLLISION (duplicate names).
