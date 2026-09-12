#!/usr/bin/env node
/**
 * afterFileEdit: grammar v2 post-pass — sanitize + canonical fmt on *.imol agent edits.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const input = JSON.parse(readFileSync(0, "utf8"));
const filePath = input.file_path ?? "";
if (!filePath.endsWith(".imol")) {
    process.stdout.write("{}");
    process.exit(0);
}

const { sanitizeAndFormat } = await import(
    join(repoRoot, "packages/imol-fmt/dist/agent-sanitize.js")
);
const source = readFileSync(filePath, "utf8");
const result = sanitizeAndFormat(source);
if (result.ok && result.output !== source) {
    writeFileSync(filePath, result.output, "utf8");
}
process.stdout.write("{}");
