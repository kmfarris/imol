#!/usr/bin/env node
import { checkModule } from "@imol/check";
import { parse } from "@imol/syntax";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { codewordsForDiagnostics } from "../router/route.js";
import type { TrajectoryStep } from "../types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const QUERY_TEMPLATES: { query: string; codewords: string[]; mutate?: (src: string) => string }[] = [
    {
        query: "Add a new IMOL module with main that prints hello",
        codewords: ["syntax.module_layout", "syntax.function", "syntax.std_io", "agent.check"],
    },
    {
        query: "Patch the greet function by id without rewriting the whole file",
        codewords: ["patch.by_id", "patch.replace_decl_by_id", "agent.patch", "agent.check"],
    },
    {
        query: "Read a file with std.fs.read tool and workshop bind",
        codewords: ["extern.std_fs_read", "syntax.workshop", "syntax.tool_decl", "agent.workshop_plan"],
    },
    {
        query: "Run plan demo without approve first",
        codewords: ["workshop.plan_first", "workshop.approve_gate", "agent.no_approve_default"],
    },
    {
        query: "Fix E_EXTERN unknown tool from key",
        codewords: ["extern.catalog", "check.diagnostics"],
        mutate: (src) => src.replace("std.fs.read", "bogus.key"),
    },
    {
        query: "Import tools.fs and invoke read_file",
        codewords: ["syntax.import", "import.merge", "import.collision"],
    },
    {
        query: "Use imol agent check json before edit",
        codewords: ["agent.loop.v03", "agent.check", "agent.spec_version"],
    },
    {
        query: "Format check canonical IR",
        codewords: ["fmt.canonical", "agent.fmt_check"],
    },
];

async function collectExampleSources(): Promise<string[]> {
    const paths: string[] = [];
    for (const dir of ["examples", "examples/golden"]) {
        const full = join(repoRoot, dir);
        for (const name of await readdir(full).catch(() => [])) {
            if (name.endsWith(".imol")) {
                paths.push(join(full, name));
            }
        }
    }
    return paths;
}

async function main(): Promise<void> {
    const steps: TrajectoryStep[] = [];
    const sources = await collectExampleSources();

    for (const tpl of QUERY_TEMPLATES) {
        for (const path of sources) {
            let src = await readFile(path, "utf8");
            if (tpl.mutate) {
                src = tpl.mutate(src);
            }
            let ok = false;
            const diagnostics: string[] = [];
            try {
                const mod = parse(src);
                const result = checkModule(mod);
                ok = result.ok;
                for (const d of result.diagnostics) {
                    diagnostics.push(d.code);
                }
            } catch {
                ok = false;
                diagnostics.push("E_SYNTAX");
            }
            const fromDiag = codewordsForDiagnostics(diagnostics);
            const codeword_ids = [...new Set([...tpl.codewords, ...fromDiag])];
            steps.push({
                query: `${tpl.query} (context: ${path})`,
                codeword_ids,
                ok,
                diagnostics,
            });
        }
    }

    await mkdir(join(pkgRoot, "data"), { recursive: true });
    const out = steps.map((s) => JSON.stringify(s)).join("\n") + "\n";
    await writeFile(join(pkgRoot, "data/oracle-trajectories.jsonl"), out, "utf8");
    console.log(`dataset: wrote ${steps.length} oracle trajectory steps`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
