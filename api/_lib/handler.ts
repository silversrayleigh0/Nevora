import { FIREBASE_WEB_CONFIG } from "../../shared/firebaseConfig.js";
import type { AiTask } from "../../shared/types.js";
import { HttpError, verifyFirebaseToken } from "./auth.js";
import { claudeJson, type WebAnswer } from "./claude.js";
import { chatJson, type ChatContent } from "./openrouter.js";
import { IMAGE_TASKS, keepCitedCourses, MAX_TOKENS, PROMPTS, QUICK_TASKS, TEMPERATURE, WEB_TASKS } from "./prompts.js";
import { takeToken } from "./rateLimit.js";

export type Env = {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_API_KEY_2?: string;
  OPENROUTER_API_KEY_3?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_MODEL_QUICK?: string;
  OPENROUTER_FALLBACK_MODELS?: string;
  FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  APP_URL?: string;
  AI_REQUESTS_PER_HOUR?: string;
};

export type AiRequest = { method: string; authorization?: string; body: unknown };
export type AiResponse = { status: number; body: unknown };

export type Providers = {
  claude?: (opts: Parameters<typeof claudeJson>[0]) => Promise<unknown>;
  fetchImpl?: typeof fetch;
};

const MAX_INPUT_CHARS = 60_000;
const MAX_IMAGE_CHARS = 6_000_000;
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";
export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
export const DEFAULT_QUICK_MODEL = "anthropic/claude-haiku-4.5";

const isTask = (t: unknown): t is AiTask => typeof t === "string" && Object.hasOwn(PROMPTS, t);

/** Claude handles the hard reasoning tasks with more effort; extraction stays fast. */
const EFFORT: Partial<Record<AiTask, "low" | "medium" | "high">> = { tailor: "medium", match: "medium", verify: "medium", verifyDocument: "medium" };

export async function handleAi(req: AiRequest, env: Env, providers: Providers = {}): Promise<AiResponse> {
  const claudeKey = env.ANTHROPIC_API_KEY?.trim();
  // Primary key first, then the backups; each is tried in turn if the one before fails.
  const openrouterKeys = [env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEY_2, env.OPENROUTER_API_KEY_3]
    .map((k) => k?.trim())
    .filter((k): k is string => Boolean(k));
  const openrouterKey = openrouterKeys[0];
  const projectId = (env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || FIREBASE_WEB_CONFIG.projectId).trim();

  // The app asks this once to decide between "Live AI" and basic mode.
  if (req.method === "GET") {
    return { status: 200, body: { ai: Boolean(claudeKey || openrouterKey), claude: Boolean(claudeKey), openrouter: Boolean(openrouterKey), openrouterKeys: openrouterKeys.length } };
  }
  if (req.method !== "POST") return { status: 405, body: { error: { code: "method_not_allowed", message: "Use POST." } } };

  try {
    if (!claudeKey && !openrouterKey) throw new HttpError(503, "ai_unavailable", "AI isn't configured on this server.");
    const uid = await verifyFirebaseToken(req.authorization, projectId);

    const { task, input, image } = (req.body ?? {}) as { task?: unknown; input?: unknown; image?: unknown };
    if (!isTask(task)) throw new HttpError(400, "bad_request", "Unknown task.");

    const serialized = typeof input === "string" ? input : JSON.stringify(input ?? null);
    if (serialized.length > MAX_INPUT_CHARS) throw new HttpError(413, "prompt_too_large", "That's too much text at once. Try a shorter version.");

    let user: ChatContent = `INPUT:\n${serialized}`;
    if (image !== undefined || IMAGE_TASKS.has(task)) {
      if (!IMAGE_TASKS.has(task) || typeof image !== "string" || image.length > MAX_IMAGE_CHARS || !IMAGE_DATA_URL.test(image)) {
        throw new HttpError(400, "image_rejected", "That file couldn't be read. Try a different image.");
      }
      user = [
        { type: "text", text: `The document image is attached.\n\nINPUT:\n${serialized}` },
        { type: "image_url", image_url: { url: image } },
      ];
    }

    const perHour = Number(env.AI_REQUESTS_PER_HOUR) || 80;
    if (!takeToken(uid, perHour)) throw new HttpError(429, "rate_limited", "You've made a lot of requests. Wait a few minutes, then try again.");

    const maxTokens = MAX_TOKENS[task] ?? 2000;
    const web = WEB_TASKS.has(task);
    if (web && !claudeKey) throw new HttpError(503, "search_unavailable", "Web search needs the Claude API, which isn't set up on this server.");
    let lastError: HttpError | null = null;

    // 1. Claude (primary)
    if (claudeKey) {
      try {
        const data = await (providers.claude ?? claudeJson)({
          apiKey: claudeKey,
          model: env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL,
          system: PROMPTS[task],
          user,
          effort: QUICK_TASKS.has(task) ? "low" : (EFFORT[task] ?? "low"),
          // Thinking is always on for this model, so leave room above the answer itself.
          maxTokens: Math.max(16_000, maxTokens * 2),
          webSearch: web,
        });
        if (web) {
          const answer = data as WebAnswer;
          return { status: 200, body: { data: keepCitedCourses(answer.data, answer.sources), provider: "claude" } };
        }
        return { status: 200, body: { data, provider: "claude" } };
      } catch (err) {
        lastError = err instanceof HttpError ? err : new HttpError(502, "upstream_error", "Claude returned an error.");
        console.warn(`[ai] claude failed for ${task}: ${lastError.code} ${lastError.message}`);
      }
    }

    // Only Claude can search the web; don't let another model make up course links.
    if (web) throw new HttpError(503, "search_unavailable", lastError?.message ?? "Web search isn't available right now.");

    // 2. OpenRouter, trying each configured key in order
    for (const [index, apiKey] of openrouterKeys.entries()) {
      const primary = QUICK_TASKS.has(task) ? env.OPENROUTER_MODEL_QUICK || DEFAULT_QUICK_MODEL : env.OPENROUTER_MODEL || DEFAULT_MODEL;
      const fallbacks = (env.OPENROUTER_FALLBACK_MODELS ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m && m !== primary);
      try {
        const data = await chatJson({
          apiKey,
          models: [primary, ...fallbacks].slice(0, 3),
          system: PROMPTS[task],
          user,
          temperature: TEMPERATURE[task] ?? 0.1,
          maxTokens,
          appUrl: env.APP_URL,
          fetchImpl: providers.fetchImpl,
        });
        return { status: 200, body: { data, provider: index ? `openrouter-${index + 1}` : "openrouter" } };
      } catch (err) {
        lastError = err instanceof HttpError ? err : new HttpError(502, "upstream_error", "The AI service returned an error.");
        console.warn(`[ai] openrouter key ${index + 1} failed for ${task}: ${lastError.code} ${lastError.message}`);
      }
    }
    throw lastError ?? new HttpError(503, "ai_unavailable", "AI isn't configured on this server.");
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: { code: err.code, message: err.message } } };
    console.error("[ai] unexpected error", err);
    return { status: 500, body: { error: { code: "server_error", message: "Something went wrong. Try again." } } };
  }
}
