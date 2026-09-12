export type ExternEffect = "io" | "unsafe";

export type ExternMeta = {
    key: string;
    effect: ExternEffect;
    binds: string[];
};

export const EXTERN_CATALOG: ExternMeta[] = [
    { key: "std.fs.read", effect: "io", binds: ["std.fs", "tools.filesystem"] },
    { key: "std.fs.list", effect: "io", binds: ["std.fs"] },
    { key: "std.fs.write", effect: "unsafe", binds: ["std.fs"] },
    { key: "tools.filesystem.read", effect: "io", binds: ["tools.filesystem", "std.fs"] },
];

/** Workshop bind required for tools generated via `imol tools import` (`from mcp.*`). */
export const MCP_EXTERN_BIND = "tools.mcp";

export const KNOWN_EXTERN_KEYS = new Set(EXTERN_CATALOG.map((e) => e.key));

export function isMcpExternKey(key: string): boolean {
    return key.startsWith("mcp.");
}

export function isKnownExternKey(key: string): boolean {
    return KNOWN_EXTERN_KEYS.has(key) || isMcpExternKey(key);
}

export function allowedExternKeys(binds: string[], allowWrite: boolean): Set<string> {
    const allowed = new Set<string>();
    if (binds.length === 0) {
        for (const e of EXTERN_CATALOG) {
            if (e.key === "std.fs.write" && !allowWrite) continue;
            allowed.add(e.key);
        }
        return allowed;
    }
    for (const bind of binds) {
        for (const e of EXTERN_CATALOG) {
            if (e.binds.includes(bind)) {
                if (e.key === "std.fs.write" && !allowWrite) continue;
                allowed.add(e.key);
            }
        }
    }
    return allowed;
}

export function isExternAllowed(
    key: string,
    workshop: { binds: string[]; allowWrite: boolean } | undefined,
): boolean {
    if (!isKnownExternKey(key)) {
        return false;
    }
    if (isMcpExternKey(key)) {
        if (!workshop) {
            return true;
        }
        return workshop.binds.includes(MCP_EXTERN_BIND) || workshop.binds.includes("mcp");
    }
    if (!workshop) {
        return true;
    }
    return allowedExternKeys(workshop.binds, workshop.allowWrite).has(key);
}
