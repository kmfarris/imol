export async function callChatModel(system: string, user: string): Promise<string> {
    const apiKey = process.env.IMOL_AGENTBENCH_API_KEY ?? process.env.OPENAI_API_KEY;
    const base = process.env.IMOL_AGENTBENCH_BASE_URL ?? "https://api.openai.com/v1";
    const model = process.env.IMOL_AGENTBENCH_MODEL ?? "gpt-4o-mini";
    if (!apiKey) {
        throw new Error("no_api_key");
    }
    const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            temperature: 0,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
}
