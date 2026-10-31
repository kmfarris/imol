#!/usr/bin/env node
import { checkModule } from "@kmfarris/imol-check";
import { parse } from "@kmfarris/imol-syntax";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
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
        query: "Fix E_EXTERN on mcp tool missing bind tools.mcp",
        codewords: ["extern.mcp_bind", "extern.catalog", "mcp.tools_import"],
        mutate: (src) =>
            src.includes("from mcp.")
                ? src.replace(/bind tools\.mcp\n/, "")
                : `module x\n\ntool t from mcp.search @io\n  { query: Text } -> Result\n\ntype Result = Ok Text | Err Text\n`,
    },
    {
        query: "Import tools.fs and invoke read_file",
        codewords: ["syntax.import", "import.merge", "import.collision"],
    },
    {
        query: "Use imol agent check json before edit",
        codewords: ["agent.loop.v04", "agent.check", "agent.spec_version"],
    },
    {
        query: "Sanitize LLM markdown fences before check",
        codewords: ["grammar.sanitize", "fmt.canonical", "agent.check"],
    },
    {
        query: "Dogfood catalog plan and workshop dry run",
        codewords: ["syntax.plan", "agent.workshop_plan", "agent.loop.v04"],
    },
    {
        query: "Format check canonical IR",
        codewords: ["fmt.canonical", "agent.fmt_check"],
    },
    {
        query: "Configure imol lsp for editor diagnostics",
        codewords: ["lsp.diagnostics", "check.diagnostics"],
    },
];

async function collectExampleSources(): Promise<string[]> {
    const paths: string[] = [];
    const roots = [
        join(repoRoot, "examples"),
        join(repoRoot, "examples/golden"),
        join(repoRoot, "examples/bad"),
        join(repoRoot, "examples/dogfood"),
    ];
    for (const root of roots) {
        await walkImol(root, paths);
    }
    return paths;
}

async function walkImol(dir: string, out: string[]): Promise<void> {
    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch {
        return;
    }
    for (const name of entries) {
        const full = join(dir, name);
        const st = await stat(full);
        if (st.isDirectory()) {
            await walkImol(full, out);
        } else if (name.endsWith(".imol")) {
            out.push(full);
        }
    }
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
                query: `${tpl.query} (context: ${relative(repoRoot, path)})`,
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
