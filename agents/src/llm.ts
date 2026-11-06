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

export async function runInference(prompt: string): Promise<string> {
  const openai = getClient();
  if (!openai) {
    return `stub result (set GEMINI_API_KEY for a real Gemini call): ${prompt}`;
  }
  const completion = await openai.chat.completions.create({
    model: GEMINI_MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Gemini returned no content");
  return content;
}
