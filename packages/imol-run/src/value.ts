export type Value =
    | { kind: "unit" }
    | { kind: "bool"; value: boolean }
    | { kind: "int"; value: number }
    | { kind: "text"; value: string }
    | { kind: "record"; fields: Map<string, Value> }
    | { kind: "variant"; name: string; payload?: Value };

export function valueToString(v: Value): string {
    switch (v.kind) {
        case "unit":
            return "()";
        case "bool":
            return v.value ? "true" : "false";
        case "int":
            return String(v.value);
        case "text":
            return v.value;
        case "record":
            return `{${[...v.fields.entries()].map(([k, val]) => `${k}:${valueToString(val)}`).join(",")}}`;
        case "variant":
            return v.payload ? `${v.name}(${valueToString(v.payload)})` : `${v.name}()`;
    }
}
