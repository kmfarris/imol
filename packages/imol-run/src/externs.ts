import { allowedExternKeys } from "@imol/syntax";
import type { Capabilities } from "./capabilities.js";
import type { Value } from "./value.js";

export type ExternHandler = (args: Value[]) => Promise<Value> | Value;

export type ExternRegistry = Map<string, ExternHandler>;

function errText(msg: string): Value {
    return { kind: "variant", name: "Err", payload: { kind: "text", value: msg } };
}

function okText(value: string): Value {
    return { kind: "variant", name: "Ok", payload: { kind: "text", value } };
}

function pathFromArgs(args: Value[]): string | undefined {
    const pathVal = args[0];
    if (!pathVal || pathVal.kind !== "record") return undefined;
    const path = pathVal.fields.get("path");
    if (!path || path.kind !== "text") return undefined;
    return path.value;
}

export function createExternRegistry(
    caps: Capabilities,
    binds: string[] = [],
): ExternRegistry {
    const reg: ExternRegistry = new Map();
    const allowed = allowedExternKeys(binds, caps.write);

    const readHandler: ExternHandler = async (args) => {
        const p = pathFromArgs(args);
        if (!p) return errText("missing path");
        const { readFile } = await import("node:fs/promises");
        try {
            return okText(await readFile(p, "utf8"));
        } catch (e) {
            return errText(e instanceof Error ? e.message : String(e));
        }
    };

    const listHandler: ExternHandler = async (args) => {
        const p = pathFromArgs(args);
        if (!p) return errText("missing path");
        const { readdir } = await import("node:fs/promises");
        try {
            const names = await readdir(p);
            return okText(names.join("\n"));
        } catch (e) {
            return errText(e instanceof Error ? e.message : String(e));
        }
    };

    const writeHandler: ExternHandler = async (args) => {
        if (!caps.write) return errText("write not allowed");
        const pathVal = args[0];
        if (!pathVal || pathVal.kind !== "record") return errText("bad args");
        const path = pathVal.fields.get("path");
        const content = pathVal.fields.get("content");
        if (!path || path.kind !== "text" || !content || content.kind !== "text") {
            return errText("path and content required");
        }
        const { writeFile } = await import("node:fs/promises");
        try {
            await writeFile(path.value, content.value, "utf8");
            return { kind: "variant", name: "Ok", payload: { kind: "unit" } };
        } catch (e) {
            return errText(e instanceof Error ? e.message : String(e));
        }
    };

    if (allowed.has("std.fs.read") || allowed.has("tools.filesystem.read")) {
        reg.set("std.fs.read", readHandler);
        reg.set("tools.filesystem.read", readHandler);
    }
    if (allowed.has("std.fs.list")) {
        reg.set("std.fs.list", listHandler);
    }
    if (allowed.has("std.fs.write")) {
        reg.set("std.fs.write", writeHandler);
    }

    return reg;
}

export function createDefaultExterns(): ExternRegistry {
    return createExternRegistry({ io: true, net: false, unsafe: false, write: false });
}
