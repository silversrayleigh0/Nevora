import { HttpError } from "./auth.js";

export type ChatContent = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

type CallOptions = {
  apiKey: string;
  models: string[];
  system: string;
  user: ChatContent;
  temperature: number;
  maxTokens: number;
  appUrl?: string;
  fetchImpl?: typeof fetch;
};

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** Models sometimes wrap JSON in fences or add a sentence; take the outermost object. */
export function extractJson(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object");
    return JSON.parse(text.slice(start, end + 1));
  }
}

async function once(opts: CallOptions): Promise<unknown> {
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  let res: Response;
  try {
    res = await doFetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        ...(opts.appUrl ? { "HTTP-Referer": opts.appUrl } : {}),
        "X-Title": "Nevora",
      },
      body: JSON.stringify({
        ...(opts.models.length > 1 ? { models: opts.models } : { model: opts.models[0] }),
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    throw new HttpError(504, "upstream_timeout", (err as Error).name === "AbortError" ? "The AI took too long. Try again." : "Couldn't reach the AI service. Try again.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new HttpError(429, "rate_limited", "The AI is busy right now. Wait a moment, then try again.");
  if (res.status === 402) throw new HttpError(503, "ai_unavailable", "AI credits have run out. Basic mode is still available.");
  if (res.status === 401 || res.status === 403) throw new HttpError(503, "ai_unavailable", "The AI service isn't configured correctly.");
  if (!res.ok) throw new HttpError(502, "upstream_error", "The AI service returned an error. Try again.");

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, "invalid_json", "The AI's answer came back empty. Try again.");
  return extractJson(content);
}

/** One retry covers the occasional malformed or truncated JSON answer. */
export async function chatJson(opts: CallOptions): Promise<unknown> {
  try {
    return await once(opts);
  } catch (err) {
    if (err instanceof HttpError && err.code !== "upstream_error" && err.code !== "invalid_json") throw err;
    try {
      return await once(opts);
    } catch (second) {
      if (second instanceof HttpError) throw second;
      throw new HttpError(502, "invalid_json", "The AI's answer came back incomplete. Try again.");
    }
  }
}
