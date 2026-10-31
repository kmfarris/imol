# IMOL: a programming language built for AI coding assistants

## What it is

IMOL is a programming language and a set of tools designed so that AI assistants can write and change programs safely.

## The problem

When an AI assistant writes or edits code today, it usually produces plain text that gets dropped into a file. Three things tend to go wrong:

- **Mistakes are found late.** The new code may not even be valid, and nobody finds out until the program runs.
- **Edits miss their target.** An edit that says "change lines 40 to 62" breaks as soon as anything above those lines moves.
- **Actions happen too early.** A program can delete files, overwrite data, or contact the internet before anyone has looked at what it intends to do.

## How it works

- **Permanent name tags.** Every part of an IMOL program, such as a function or a tool, can carry a permanent tag. An assistant edits by tag ("replace this function") instead of by line number, so edits still land in the right place after the file changes.
- **Check before saving.** IMOL checks a program for mistakes before any change is written to disk. Problems come back in a structured format the assistant can read, so it can fix its own errors and try again.
- **Declared permissions.** Each program states up front what it's allowed to do: read files, write files, use the network, or run system commands. Anything not declared is blocked.
- **Rehearsal mode.** A program can be run as a rehearsal that records every action it *would* take, such as which files it would read or write, without doing any of them. Real actions only happen after explicit approval.

Together, these let an assistant propose a change, confirm it's valid, show exactly what it will do, and act only once a person says yes.

## Results so far

- The language, the mistake checker, the tag-based editor, the formatter, and the rehearsal runtime all work.
- The full automated test suite passes.
- IMOL connects to the Cursor code editor, so an AI assistant there can run these checks itself.
- A built-in guide helps assistants pick the right command for a task without reading the whole language manual.

## Still to do

- The language has gained new features (running system commands, early support for doing work in the background) faster than the format it uses to report back to assistants. The two need to be brought back in step.
- IMOL isn't yet published as a package that can be installed with one command.
- There's no formal written definition of the language yet.

Design notes: [`docs/DESIGN.md`](docs/DESIGN.md) · walkthrough: [`docs/DEMO.md`](docs/DEMO.md)

---

## For developers

Install, build, and check an example:

```bash
npm install
npm run build
npm run imol -- check examples/greet.imol
npm run imol -- agent check examples/dogfood/catalog.imol
```

More examples:

```bash
npm run imol -- run examples/hello.imol
npm run imol -- workshop examples/workshop_read.imol --dry-run
npm run imol -- run examples/plan_demo.imol --approve
```

Run everything (build, tests, and example checks):

```bash
npm run check
```

### Using it from Cursor

Cursor connects through [`.cursor/mcp.json`](.cursor/mcp.json). A typical assistant sequence is: prepare (`imol_skill_prepare`), edit (`imol_agent_patch`), check (`imol_agent_check`), rehearse (`imol_agent_workshop_plan`). Real side effects only run with `imol run --approve` or `imol workshop --approve`.

Guides: [`docs/HAPPY_PATH.md`](docs/HAPPY_PATH.md), [`docs/ONBOARDING.md`](docs/ONBOARDING.md), [`docs/ROADMAP_RUNTIME.md`](docs/ROADMAP_RUNTIME.md).

### Command guide for assistants

```bash
npm run imol -- skill route "patch greet by @id" --file examples/greet.imol
npm run skill:bench
```

Example editor config: [`packages/imol-skill/mcp/cursor-mcp.example.json`](packages/imol-skill/mcp/cursor-mcp.example.json)

### Packages

| Package | What it does |
|---------|--------------|
| `imol-syntax` | Reads IMOL source into a structure the other tools use |
| `imol-fmt` | Puts every program into one standard layout |
| `imol-check` | Finds type mistakes and undeclared actions |
| `imol-run` | Runs programs |
| `imol-workshop` | Rehearsal mode and action records |
| `imol-cli` | The `imol` command |
| `imol-patch` | Edits by name tag |
| `imol-load` | Project files and multi-file programs |
| `imol-spec` | Language reference and assistant message format |
| `imol-skill` | Command guide for assistants and editor connection |

Sample programs are in `examples/`, including deliberately broken ones in `bad/`.
