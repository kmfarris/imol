import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCodebookFromInventory } from "../dist/inventory/build.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const book = buildCodebookFromInventory();
await writeFile(join(root, "codebook/v0.3.json"), `${JSON.stringify(book, null, 2)}\n`, "utf8");
console.log(`codebook: wrote ${book.codewords.length} codewords to codebook/v0.3.json`);
