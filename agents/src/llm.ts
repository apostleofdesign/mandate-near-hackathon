// Thin wrapper around the Gemini API's OpenAI-compatible endpoint
// (ai.google.dev/gemini-api/docs/openai — base URL
// generativelanguage.googleapis.com/v1beta/openai/, bearer auth, same
// `openai` SDK as any OpenAI-compatible provider). Falls back to a
// deterministic stub when GEMINI_API_KEY isn't set, so the bid/assign/
// deliver/settle loop in worker.ts stays demoable even without a key.
import OpenAI from "openai";

const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ baseURL: GEMINI_BASE_URL, apiKey });
  return client;
}

// Gemini returns real, structured 503s ("currently experiencing high demand")
// under normal load — not a sign the key or integration is broken, just that
// the free tier gets deprioritized under load. A couple of short retries
// absorbs that; if it's still down, fall back to the stub rather than crash
// the whole worker process over one flaky inference call.
async function withRetries<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function runInference(prompt: string): Promise<string> {
  const openai = getClient();
  if (!openai) {
    return `stub result (set GEMINI_API_KEY for a real Gemini call): ${prompt}`;
  }
  try {
    const completion = await withRetries(() =>
      openai.chat.completions.create({
        model: GEMINI_MODEL,
        messages: [{ role: "user", content: prompt }],
      })
    );
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Gemini returned no content");
    return content;
  } catch (err) {
    console.warn(`[llm] Gemini call failed after retries, falling back to stub: ${err instanceof Error ? err.message : String(err)}`);
    return `stub result (Gemini unavailable right now): ${prompt}`;
  }
}
