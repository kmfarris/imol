export type Value = {
    kind: "unit";
} | {
    kind: "bool";
    value: boolean;
} | {
    kind: "int";
    value: number;
} | {
    kind: "text";
    value: string;
} | {
    kind: "record";
    fields: Map<string, Value>;
} | {
    kind: "variant";
    name: string;
    payload?: Value;
};
export declare function valueToString(v: Value): string;
//# sourceMappingURL=value.d.ts.map