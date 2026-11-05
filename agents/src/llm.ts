// Thin wrapper around NEAR AI Cloud's OpenAI-compatible gateway
// (docs.near.ai/cloud/quickstart — base URL cloud-api.near.ai/v1, bearer auth,
// same `openai` SDK as any OpenAI-compatible provider). Falls back to a
// deterministic stub when NEAR_AI_API_KEY isn't set, so the bid/assign/
// deliver/settle loop in worker.ts stays demoable even without a key, or if
// the API — a young project with no published rate limit or SLA — has a bad day.
import OpenAI from "openai";

const NEAR_AI_BASE_URL = process.env.NEAR_AI_BASE_URL ?? "https://cloud-api.near.ai/v1";
const NEAR_AI_MODEL = process.env.NEAR_AI_MODEL ?? "zai-org/GLM-5.1-FP8";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const apiKey = process.env.NEAR_AI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ baseURL: NEAR_AI_BASE_URL, apiKey });
  return client;
}

export async function runInference(prompt: string): Promise<string> {
  const openai = getClient();
  if (!openai) {
    return `stub result (set NEAR_AI_API_KEY for a real NEAR AI Cloud call): ${prompt}`;
  }
  const completion = await openai.chat.completions.create({
    model: NEAR_AI_MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("NEAR AI Cloud returned no content");
  return content;
}
