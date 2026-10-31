# Five-minute demonstration

Record a terminal cast from a clean clone after `npm install && npm run build`.

## 1. Check

```bash
npm run imol -- agent check examples/dogfood/catalog.imol
```

Expect JSON on stdout: `ok`, `has_holes`, `diagnostics`, `entry`, `spec_version: "0.4"`.

## 2. Format gate

```bash
npm run imol -- agent fmt-check examples/dogfood/catalog.imol
```

Shows whether canonical fmt would change the file.

## 3. Patch (dry)

```bash
npm run imol -- agent patch examples/dogfood/catalog.imol /path/to/patches.json
```

Patches apply in memory; response includes nested `check` without writing disk.

## 4. Workshop plan

```bash
npm run imol -- agent workshop-plan examples/dogfood/catalog.imol
```

Dry-run plan invokes; inspect `trace` and `trace_path` for intended side effects before `--approve`.

## 5. Full gate

```bash
npm run check
```

Build, unit tests, and conformance scripts—use this before tagging a release.
