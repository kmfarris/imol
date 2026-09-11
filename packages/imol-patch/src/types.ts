export type PatchOp =
    | { op: "replace_decl_by_id"; id: string; source: string }
    | { op: "insert_after_id"; id: string; source: string }
    | { op: "delete_decl_by_id"; id: string };

export type PatchFile = {
    patches: PatchOp[];
};
