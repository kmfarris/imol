# IMOL onboarding (~5 minutes)

## 1. Clone and build

```bash
git clone git@github.com:kmfarris/imol.git
cd imol
npm install
npm run build
```

## 2. Verify CLI

```bash
npm run imol -- check examples/greet.imol
npm run imol -- agent check examples/dogfood/catalog.imol
```

## 3. Cursor MCP

1. Open this repo as the workspace folder.
2. Confirm [`.cursor/mcp.json`](../.cursor/mcp.json) points at `scripts/imol-mcp.mjs` and sets `IMOL_WORKSPACE_ROOT` to `${workspaceFolder}`.
3. Reload MCP in Cursor; the **imol** server should show green.
4. Call **`imol_skill_prepare`** with task `"check greet module"` and file `examples/greet.imol`.

Full loop: [HAPPY_PATH.md](HAPPY_PATH.md).

## 4. Cursor hooks (optional)

Project [`.cursor/hooks.json`](../.cursor/hooks.json):

- **sessionStart** — sets `IMOL_WORKSPACE_ROOT` and IMOL MCP loop reminder (`additional_context` may be unreliable on some Cursor versions; rules + MCP still apply).
- **afterFileEdit** — runs grammar sanitize/fmt on agent `Write` of `*.imol`.

Enable hooks in Cursor Settings → Hooks.

## 5. Language server (optional)

Add to Cursor/VS Code (example):

```json
{
  "imol.languageServerPath": "${workspaceFolder}/packages/imol-cli/dist/cli.js",
  "imol.languageServerArgs": ["lsp"]
}
```

Or run manually: `npm run imol -- lsp` (stdio LSP; diagnostics on open/save for `*.imol`).

## 6. Local install (`npm link`)

From the repo root after `npm run build`:

```bash
npm link
imol check examples/greet.imol
```

For MCP without Cursor project config:

```bash
npm link -w @imol/skill
imol-mcp
# or: imol skill mcp
```

## 7. MCP config (one server)

Use project [`.cursor/mcp.json`](../.cursor/mcp.json) only. Remove duplicate **imol** / **user-imol** entries from global `~/.cursor/mcp.json` if Cursor lists two servers.

## 8. Publish (future)

Packages are workspace-local today (`private: true` root). To publish:

1. Bump versions in `packages/imol-cli`, `@imol/skill`, and dependencies together.
2. `npm publish -w @imol/cli --access public` (after removing `private` on the package).
3. Document `imol-mcp` bin from `@imol/skill` and the stable launcher pattern in `scripts/imol-mcp.mjs`.

CI runs tests, conformance, and `node scripts/mcp-smoke.mjs` after build.

## Security

- MCP tools do not expose `run --approve`.
- Paths are sandboxed to `IMOL_WORKSPACE_ROOT` ([`paths.ts`](../packages/imol-skill/src/mcp/paths.ts)).
