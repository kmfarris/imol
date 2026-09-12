export type Capabilities = {
    io: boolean;
    net: boolean;
    unsafe: boolean;
    write: boolean;
    shell: boolean;
};

export const defaultCapabilities: Capabilities = {
    io: true,
    net: false,
    unsafe: false,
    write: false,
    shell: false,
};

export function capabilitiesFromWorkshop(
    workshop?: { allowNet: boolean; allowWrite: boolean; allowShell?: boolean },
    overrides?: Partial<Capabilities>,
): Capabilities {
    return {
        io: overrides?.io ?? true,
        net: overrides?.net ?? workshop?.allowNet ?? false,
        unsafe: overrides?.unsafe ?? false,
        write: overrides?.write ?? workshop?.allowWrite ?? false,
        shell: overrides?.shell ?? workshop?.allowShell ?? false,
    };
}

export function runCapabilities(
    workshop?: { allowNet: boolean; allowWrite: boolean; allowShell?: boolean },
    approved?: boolean,
): Capabilities {
    const base = capabilitiesFromWorkshop(workshop);
    if (!approved) {
        return base;
    }
    return capabilitiesFromWorkshop(workshop, {
        write: workshop?.allowWrite ?? false,
        unsafe: workshop?.allowShell ? true : base.unsafe,
        shell: workshop?.allowShell ?? false,
    });
}
