const DEFAULT_ALLOWLIST = ["echo", "pwd", "node"];

export function shellAllowlist(): Set<string> {
    const raw = process.env.IMOL_SHELL_ALLOWLIST;
    if (!raw?.trim()) {
        return new Set(DEFAULT_ALLOWLIST);
    }
    return new Set(
        raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
    );
}

export function parseShellCommand(command: string): { bin: string; args: string[] } | undefined {
    const trimmed = command.trim();
    if (!trimmed) {
        return undefined;
    }
    const parts = trimmed.split(/\s+/);
    const bin = parts[0];
    if (!bin) {
        return undefined;
    }
    return { bin, args: parts.slice(1) };
}
