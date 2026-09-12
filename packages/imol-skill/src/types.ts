export type Codeword = {
    id: string;
    spec_version: string;
    tags: string[];
    keywords: string[];
    embedding?: number[];
    expansion: string;
    tool_policy: string[];
    examples_ref?: string[];
    diagnostic_codes?: string[];
};

export type Codebook = {
    spec_version: string;
    codebook_id: string;
    embedding_dim: number;
    codewords: Codeword[];
};

export type RouteInput = {
    task: string;
    file_snippet?: string;
    last_oracle_json?: string;
    k?: number;
};

export type RouteResult = {
    spec_version: string;
    codewords: { id: string; score: number }[];
    packet: string;
    token_estimate: number;
    tool_policy: string[];
};

export type TrajectoryStep = {
    query: string;
    codeword_ids: string[];
    ok: boolean;
    diagnostics: string[];
};
