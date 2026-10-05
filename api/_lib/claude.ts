import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "./auth.js";
import { extractJson, type ChatContent } from "./openrouter.js";

type ClaudeOptions = {
  apiKey: string;
  model: string;
  system: string;
  user: ChatContent;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  /** Let Claude search the web; the result then carries `sources`, the URLs it actually saw. */
  webSearch?: boolean;
};

/** A web-search answer: the JSON plus every result URL the search returned. */
export type WebAnswer = { data: unknown; sources: string[] };

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

/** Converts our provider-neutral content into Claude content blocks. */
function toClaudeContent(user: ChatContent): Anthropic.Beta.BetaContentBlockParam[] {
  if (typeof user === "string") return [{ type: "text", text: user }];
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const part of user) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text });
      continue;
    }
    const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(part.image_url.url);
    const mediaType = match?.[1] === "image/jpg" ? "image/jpeg" : match?.[1];
    if (!match || !IMAGE_TYPES.includes(mediaType as ImageType)) throw new HttpError(400, "image_rejected", "That file couldn't be read. Try a different image.");
    // Images go before the text that refers to them.
    blocks.unshift({ type: "image", source: { type: "base64", media_type: mediaType as ImageType, data: match[2] } });
  }
  return blocks;
}

export async function claudeJson(opts: ClaudeOptions): Promise<unknown> {
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: 120_000, maxRetries: 1 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: toClaudeContent(opts.user) }];
  const sources = new Set<string>();
  let response: Anthropic.Beta.BetaMessage;
  // A web search can pause a long turn; send it back to let Claude carry on (a few times at most).
  for (let round = 0; ; round++) {
    try {
      response = await client.beta.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        output_config: { effort: opts.effort },
        // If a safety classifier declines, the API re-runs the request on a suitable model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        ...(opts.webSearch ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }] } : {}),
        messages,
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, "rate_limited", "The AI is busy right now. Wait a moment, then try again.");
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw new HttpError(503, "ai_unavailable", "The Claude API key isn't valid.");
      }
      if (err instanceof Anthropic.BadRequestError) throw new HttpError(502, "upstream_error", `Claude rejected the request: ${err.message}`);
      if (err instanceof Anthropic.APIError) throw new HttpError(502, "upstream_error", "Claude returned an error. Try again.");
      throw new HttpError(504, "upstream_timeout", "Couldn't reach Claude. Try again.");
    }
    for (const block of response.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) for (const r of block.content) sources.add(r.url);
    }
    if (response.stop_reason !== "pause_turn" || round >= 3) break;
    messages.push({ role: "assistant", content: response.content });
  }

  if (response.stop_reason === "refusal") throw new HttpError(502, "refused", "The AI couldn't help with that input. Try editing it.");
  if (response.stop_reason === "max_tokens") throw new HttpError(502, "invalid_json", "The AI's answer was cut off. Try a shorter input.");
  // With web search the answer follows the search results, so read only the text after the last tool result.
  let lastTool = -1;
  response.content.forEach((b, i) => {
    if (b.type === "web_search_tool_result" || b.type === "server_tool_use") lastTool = i;
  });
  const text = response.content
    .slice(lastTool + 1)
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let data: unknown;
  try {
    data = extractJson(text);
  } catch {
    throw new HttpError(502, "invalid_json", "The AI's answer came back incomplete. Try again.");
  }
  return opts.webSearch ? ({ data, sources: [...sources] } satisfies WebAnswer) : data;
}
