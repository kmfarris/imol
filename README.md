# IMOL

LLM-native language and live **Workshop** runtime: typed tools, effect checks, audit trace.

## Quick start

```bash
npm install
npm run build
npm run imol -- run examples/hello.imol
npm run imol -- check examples/greet.imol
npm run imol -- workshop examples/workshop_read.imol --dry-run
```

## Repository layout

- `packages/imol-syntax` — lexer, parser, AST
- `packages/imol-fmt` — canonical formatter (IR)
- `packages/imol-check` — type and effect checker
- `packages/imol-run` — tree-walk interpreter
- `packages/imol-workshop` — session, trace, dry-run
- `packages/imol-cli` — `imol` command
- `packages/imol-spec` — language spec
- `examples/` — sample programs

## Remote

```bash
git remote add origin git@github.com:kmfarris/imol.git
```
