import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ImolManifest = {
    entry: string;
    spec_version?: string;
    workshop?: {
        allow_net?: boolean;
        allow_write?: boolean;
    };
    tool_paths?: string[];
};

export async function readManifest(projectRoot: string): Promise<ImolManifest | undefined> {
    const jsonPath = join(projectRoot, "imol.json");
    try {
        const raw = await readFile(jsonPath, "utf8");
        return JSON.parse(raw) as ImolManifest;
    } catch {
        return undefined;
    }
}

export async function readManifestToml(projectRoot: string): Promise<ImolManifest | undefined> {
    const tomlPath = join(projectRoot, "imol.toml");
    try {
        const raw = await readFile(tomlPath, "utf8");
        return parseSimpleToml(raw);
    } catch {
        return undefined;
    }
}

export async function loadManifest(projectRoot: string): Promise<ImolManifest | undefined> {
    return (await readManifest(projectRoot)) ?? (await readManifestToml(projectRoot));
}

/** Minimal TOML subset for imol.toml (key = "value", [workshop] table). */
function parseSimpleToml(raw: string): ImolManifest {
    const manifest: ImolManifest = { entry: "" };
    let section = "";
    for (const line of raw.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const sec = /^\[([a-zA-Z0-9_]+)\]$/.exec(t);
        if (sec) {
            section = sec[1] ?? "";
            continue;
        }
        const kv = /^([a-zA-Z0-9_]+)\s*=\s*(.+)$/.exec(t);
        if (!kv) continue;
        const key = kv[1]!;
        let val = kv[2]!.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
        }
        if (section === "workshop") {
            manifest.workshop ??= {};
            if (key === "allow_net") manifest.workshop.allow_net = val === "true";
            if (key === "allow_write") manifest.workshop.allow_write = val === "true";
        } else if (key === "entry") {
            manifest.entry = val;
        } else if (key === "spec_version") {
            manifest.spec_version = val;
        }
    }
    if (!manifest.entry) {
        throw new Error("imol.toml missing entry");
    }
    return manifest;
}
