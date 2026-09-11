export type Capabilities = {
    io: boolean;
    net: boolean;
    unsafe: boolean;
    write: boolean;
};

export const defaultCapabilities: Capabilities = {
    io: true,
    net: false,
    unsafe: false,
    write: false,
};

export function capabilitiesFromWorkshop(
    workshop?: { allowNet: boolean; allowWrite: boolean },
    overrides?: Partial<Capabilities>,
): Capabilities {
    return {
        io: overrides?.io ?? true,
        net: overrides?.net ?? workshop?.allowNet ?? false,
        unsafe: overrides?.unsafe ?? false,
        write: overrides?.write ?? workshop?.allowWrite ?? false,
    };
}
