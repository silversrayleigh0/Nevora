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
};

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
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      output_config: { effort: opts.effort },
      // If a safety classifier declines, the API re-runs the request on a suitable model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: toClaudeContent(opts.user) }],
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

  if (response.stop_reason === "refusal") throw new HttpError(502, "refused", "The AI couldn't help with that input. Try editing it.");
  if (response.stop_reason === "max_tokens") throw new HttpError(502, "invalid_json", "The AI's answer was cut off. Try a shorter input.");
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return extractJson(text);
  } catch {
    throw new HttpError(502, "invalid_json", "The AI's answer came back incomplete. Try again.");
  }
}
