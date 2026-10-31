# Five-minute demonstration

From a clone, after `npm install && npm run build`.

## 1. Check

```bash
npm run imol -- agent check examples/dogfood/catalog.imol
```

JSON on stdout includes `ok`, `has_holes`, `diagnostics`, `entry`, and `spec_version: "0.4"`.

## 2. Format gate

```bash
npm run imol -- agent fmt-check examples/dogfood/catalog.imol
```

Reports whether saving canonical format would change the file.

## 3. Patch (memory only)

```bash
npm run imol -- agent patch examples/dogfood/catalog.imol /path/to/patches.json
```

Applies patches in memory. The response includes a nested `check`. Disk is unchanged.

## 4. Workshop plan

```bash
npm run imol -- agent workshop-plan examples/dogfood/catalog.imol
```

Dry-runs plan invokes. Read `trace` / `trace_path` before using `--approve`.

## 5. Full bar

```bash
npm run check
```

Build, tests, and conformance—the command used before tagging a release.
