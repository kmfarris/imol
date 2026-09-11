export function createDefaultExterns() {
    const reg = new Map();
    reg.set("tools.filesystem.read", async (args) => {
        const pathVal = args[0];
        if (!pathVal || pathVal.kind !== "record") {
            return { kind: "variant", name: "Err", payload: { kind: "text", value: "bad args" } };
        }
        const path = pathVal.fields.get("path");
        if (!path || path.kind !== "text") {
            return { kind: "variant", name: "Err", payload: { kind: "text", value: "missing path" } };
        }
        const { readFile } = await import("node:fs/promises");
        try {
            const content = await readFile(path.value, "utf8");
            return {
                kind: "variant",
                name: "Ok",
                payload: { kind: "text", value: content },
            };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { kind: "variant", name: "Err", payload: { kind: "text", value: msg } };
        }
    });
    return reg;
}
//# sourceMappingURL=externs.js.map