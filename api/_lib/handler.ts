import { FIREBASE_WEB_CONFIG } from "../../shared/firebaseConfig.js";
import type { AiTask } from "../../shared/types.js";
import { HttpError, verifyFirebaseToken } from "./auth.js";
import { chatJson, type ChatContent } from "./openrouter.js";
import { MAX_TOKENS, PROMPTS, QUICK_TASKS, TEMPERATURE } from "./prompts.js";
import { takeToken } from "./rateLimit.js";

export type Env = {
  OPENROUTER_API_KEY?: string;
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

const MAX_INPUT_CHARS = 60_000;
const MAX_IMAGE_CHARS = 4_000_000;
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
export const DEFAULT_QUICK_MODEL = "anthropic/claude-haiku-4.5";

const isTask = (t: unknown): t is AiTask => typeof t === "string" && Object.hasOwn(PROMPTS, t);

export async function handleAi(req: AiRequest, env: Env, fetchImpl?: typeof fetch): Promise<AiResponse> {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const projectId = (env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || FIREBASE_WEB_CONFIG.projectId).trim();

  // The app asks this once to decide between "Live AI" and basic mode.
  if (req.method === "GET") return { status: 200, body: { ai: Boolean(apiKey && projectId) } };
  if (req.method !== "POST") return { status: 405, body: { error: { code: "method_not_allowed", message: "Use POST." } } };

  try {
    if (!apiKey || !projectId) throw new HttpError(503, "ai_unavailable", "AI isn't configured on this server.");
    const uid = await verifyFirebaseToken(req.authorization, projectId);

    const { task, input, image } = (req.body ?? {}) as { task?: unknown; input?: unknown; image?: unknown };
    if (!isTask(task)) throw new HttpError(400, "bad_request", "Unknown task.");

    const serialized = typeof input === "string" ? input : JSON.stringify(input ?? null);
    if (serialized.length > MAX_INPUT_CHARS) throw new HttpError(413, "prompt_too_large", "That's too much text at once. Try a shorter version.");

    let user: ChatContent = `INPUT:\n${serialized}`;
    if (image !== undefined) {
      if (task !== "parseCertificate" || typeof image !== "string" || image.length > MAX_IMAGE_CHARS || !IMAGE_DATA_URL.test(image)) {
        throw new HttpError(400, "image_rejected", "That file couldn't be read. Try a different image.");
      }
      user = [
        { type: "text", text: "The certificate is attached as an image." },
        { type: "image_url", image_url: { url: image } },
      ];
    }

    const perHour = Number(env.AI_REQUESTS_PER_HOUR) || 80;
    if (!takeToken(uid, perHour)) throw new HttpError(429, "rate_limited", "You've made a lot of requests. Wait a few minutes, then try again.");

    const primary = QUICK_TASKS.has(task) ? env.OPENROUTER_MODEL_QUICK || DEFAULT_QUICK_MODEL : env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const fallbacks = (env.OPENROUTER_FALLBACK_MODELS ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m && m !== primary);

    const data = await chatJson({
      apiKey,
      models: [primary, ...fallbacks].slice(0, 3),
      system: PROMPTS[task],
      user,
      temperature: TEMPERATURE[task] ?? 0.1,
      maxTokens: MAX_TOKENS[task] ?? 2000,
      appUrl: env.APP_URL,
      fetchImpl,
    });
    return { status: 200, body: { data } };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: { code: err.code, message: err.message } } };
    console.error("[ai] unexpected error", err);
    return { status: 500, body: { error: { code: "server_error", message: "Something went wrong. Try again." } } };
  }
}
