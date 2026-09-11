import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["packages/**/test/**/*.test.ts", "test/**/*.test.ts"],
        pool: "vmThreads",
        poolOptions: {
            vmThreads: { maxThreads: 1, minThreads: 1 },
        },
    },
});
