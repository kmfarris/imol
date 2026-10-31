import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkModule } from "@kmfarris/imol-check";
import { formatModule } from "@kmfarris/imol-fmt";
import { createExternRegistry, runCapabilities, runModule } from "@kmfarris/imol-run";
import { parse } from "@kmfarris/imol-syntax";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "packages/imol-cli/dist/cli.js");

function writeProgram(target: string): string {
    return `module write_t @id("write-t")

workshop
  allow_net false
  allow_write true
  bind std.fs
end

import std.io as io

type Result = Ok Text | Err Text

tool write_file from std.fs.write @io
  { path: Text, content: Text } -> Result

@io
function main() -> Unit
  match invoke write_file { path: "${target}", content: "hi" }
    Ok _ -> io.println("wrote")
    Err msg -> io.println("blocked: " ++ msg)
  end
  return ()
end
`;
}

function runCli(args: string[]) {
    return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

describe("file writes need approval", () => {
    for (const approved of [false, true]) {
        it(`approved=${approved}`, async () => {
            const dir = mkdtempSync(join(tmpdir(), "imol-write-"));
            const target = join(dir, "out.txt");
            const mod = parse(writeProgram(target));
            expect(checkModule(mod).ok).toBe(true);
            const caps = runCapabilities(mod.workshop, approved);
            const externs = createExternRegistry(caps, mod.workshop?.binds ?? [], mod.workshop?.allowWrite ?? false);
            await runModule(mod, externs, { capabilities: caps, planApproved: approved });
            expect(existsSync(target)).toBe(approved);
        });
    }

    it("imol run without --approve does not write", () => {
        const dir = mkdtempSync(join(tmpdir(), "imol-write-"));
        const target = join(dir, "out.txt");
        const file = join(dir, "w.imol");
        writeFileSync(file, writeProgram(target));
        const res = runCli(["run", file]);
        expect(res.status).toBe(0);
        expect(res.stdout).toContain("blocked:");
        expect(existsSync(target)).toBe(false);
        expect(runCli(["run", file, "--approve"]).status).toBe(0);
        expect(existsSync(target)).toBe(true);
    });
});

describe("record types", () => {
    it("parses comma-separated fields and re-parses formatter output", () => {
        const src = writeProgram("/tmp/x");
        const once = formatModule(parse(src));
        expect(formatModule(parse(once))).toBe(once);
        const tool = parse(src).tools[0]!;
        expect(tool.inputType.kind === "record" && tool.inputType.fields.map((f) => f.name)).toEqual(["path", "content"]);
    });

    it("still parses space-separated fields", () => {
        const src = writeProgram("/tmp/x").replace("{ path: Text, content: Text }", "{ path: Text content: Text }");
        expect(checkModule(parse(src)).ok).toBe(true);
    });
});

describe("imol patch --write", () => {
    const greet = readFileSync(join(root, "examples/greet.imol"), "utf8");
    const badPatch = JSON.stringify({
        patches: [{
            op: "replace_decl_by_id",
            id: "greet-fn",
            source: '@io\nfunction greet(name Text) -> Result\n  let x Int = "oops"\n  return Ok("x")\nend',
        }],
    });

    it("refuses to write a patch that fails check", () => {
        const dir = mkdtempSync(join(tmpdir(), "imol-patch-"));
        const file = join(dir, "greet.imol");
        const patch = join(dir, "bad.json");
        writeFileSync(file, greet);
        writeFileSync(patch, badPatch);
        const res = runCli(["patch", file, patch, "--write"]);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain("E_TYPE");
        expect(readFileSync(file, "utf8")).toBe(greet);
    });

    it("writes a patch that passes check", () => {
        const dir = mkdtempSync(join(tmpdir(), "imol-patch-"));
        const file = join(dir, "greet.imol");
        writeFileSync(file, greet);
        const res = runCli(["patch", file, join(root, "examples/agent/patch-greet.json"), "--write"]);
        expect(res.status).toBe(0);
        expect(readFileSync(file, "utf8")).toContain("agent-patched");
    });
});

describe("syntax errors are reported, not thrown", () => {
    const bad = join(root, "examples/bad/unclosed_function.imol");

    it("imol check", () => {
        const res = runCli(["check", bad]);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain("E_SYNTAX");
        expect(res.stderr).not.toContain("at Parser.");
    });

    it("imol agent check includes code and span", () => {
        const res = runCli(["agent", "check", bad]);
        const body = JSON.parse(res.stdout);
        expect(body.ok).toBe(false);
        expect(body.code).toBe("E_SYNTAX");
        expect(body.span.line).toBeGreaterThan(0);
    });
});
