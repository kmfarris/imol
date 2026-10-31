# Local verification (no GitHub Actions)

This repo does not use GitHub Actions. Run these before push or merge.

## Standard gate

```bash
npm ci
npm run check
npm run mcp:smoke
```

## CSD dataset (when inventory or examples change)

```bash
npm run skill:dataset
git diff --exit-code packages/imol-skill/data/
```

Commit `packages/imol-skill/data/oracle-trajectories.jsonl` if the diff is intentional.

## Agent loop (dogfood)

```bash
npm run imol -- agent loop --dry-llm --task "dogfood oracle loop" examples/dogfood/catalog.imol
```

## Router train (optional)

```bash
npm run skill:train
```

Output: `packages/imol-skill/codebook/router-weights.json`.

## Release dry-run (before tagging)

```bash
npm run build
npm pack -w @kmfarris/imol-cli --dry-run
npm pack -w @kmfarris/imol-skill --dry-run
```
