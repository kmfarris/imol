# Publishing IMOL packages

Monorepo workspace packages share semver **0.1.x** today. Bump **all** `@kmfarris/imol-*` dependencies together before release.

## Publish targets

| Package | npm name | Bin |
|---------|----------|-----|
| CLI | `@kmfarris/imol-cli` | `imol` |
| Skill + MCP | `@kmfarris/imol-skill` | `imol-mcp` |

Library packages (`@kmfarris/imol-syntax`, `@kmfarris/imol-check`, `@kmfarris/imol-run`, …) are dependencies of the two publish targets and must be on npm before them. Publish in dependency order: syntax, fmt, check, load, patch, run, workshop, skill, cli.

## Before first publish

1. Keep `"private": true` on the **root** `package.json`; the root workspace is never published.
2. Ensure each publish package has `name`, `version`, `files` or default `dist/`, and `repository` if desired.
3. Run `npm run build` and `npm run check`.
4. Dry-run pack locally before tagging:

```bash
npm run build
npm pack -w @kmfarris/imol-cli --dry-run
npm pack -w @kmfarris/imol-skill --dry-run
```

## Consumer install

```bash
npx @kmfarris/imol-cli check path/to/file.imol
```

MCP without cloning the repo:

```bash
npx @kmfarris/imol-skill
# bin: imol-mcp (stdio MCP server)
```

For Cursor, prefer a small launcher that sets `IMOL_WORKSPACE_ROOT` (same pattern as [`scripts/imol-mcp.mjs`](../scripts/imol-mcp.mjs)):

```json
{
  "mcpServers": {
    "imol": {
      "command": "npx",
      "args": ["-y", "@kmfarris/imol-skill"],
      "env": { "IMOL_WORKSPACE_ROOT": "${workspaceFolder}" }
    }
  }
}
```

After publish, verify `imol-mcp` resolves to `dist/mcp/server.js` in the packed tarball.

## Before you tag

Run pack dry-run locally (see [LOCAL_VERIFY.md](LOCAL_VERIFY.md)). This repo does not run GitHub Actions on tags.

## Version coupling

- Root `package.json` `bin.imol` points at built CLI for local dev; published `@kmfarris/imol-cli` uses its own `bin` field.
- `@kmfarris/imol-cli` depends on `@kmfarris/imol-skill@0.1.0` (etc.); bump in lockstep.
- Codebook files ship inside `@kmfarris/imol-skill`; run `npm run codebook:build -w @kmfarris/imol-skill` before pack.
