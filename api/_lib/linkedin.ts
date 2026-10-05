import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { FIREBASE_WEB_CONFIG } from "../../shared/firebaseConfig.js";
import { HttpError, verifyFirebaseToken } from "./auth.js";

// "Sign in with LinkedIn using OpenID Connect" — the only LinkedIn API open to every app.
// It returns identity (name, email, photo). Skills and positions need partner access,
// so the app imports those from the member's own "Save to PDF" export instead.
export const LINKEDIN_AUTHORIZE = "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_USERINFO = "https://api.linkedin.com/v2/userinfo";
const SCOPE = "openid profile email";
const COOKIE = "nv_li";
const STATE_TTL_MS = 10 * 60 * 1000;

export type LinkedInEnv = {
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  LINKEDIN_REDIRECT_URI?: string;
  APP_URL?: string;
  FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
};

export type LinkedInRequest = {
  method: string;
  /** Query parameters of the request. */
  query: Record<string, string | undefined>;
  authorization?: string;
  cookie?: string;
  /** Origin the request came in on, e.g. https://nevora.app. */
  origin: string;
  body: unknown;
};

export type LinkedInResponse = { status: number; headers?: Record<string, string>; body?: unknown };

export type LinkedInDeps = { fetchImpl?: typeof fetch; verifyToken?: (auth: string | undefined, projectId: string) => Promise<string>; now?: () => number };

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function makeState(data: { uid: string; nonce: string; returnTo: string; exp: number }, secret: string): string {
  const payload = b64url(JSON.stringify(data));
  return `${payload}.${sign(payload, secret)}`;
}

export function readState(state: string, secret: string, now: number): { uid: string; nonce: string; returnTo: string; exp: number } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data?.uid !== "string" || typeof data?.nonce !== "string" || typeof data?.exp !== "number" || data.exp < now) return null;
    return { uid: data.uid, nonce: data.nonce, returnTo: safeReturn(data.returnTo), exp: data.exp };
  } catch {
    return null;
  }
}

/** Only same-site paths, so the callback can't be used as an open redirect. */
export const safeReturn = (path: unknown) => (typeof path === "string" && /^\/[A-Za-z0-9/_-]*$/.test(path) && !path.startsWith("//") ? path : "/profile");

const cookieValue = (header: string | undefined, name: string) =>
  header
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === name)?.[1];

const redirect = (location: string, extra: Record<string, string> = {}): LinkedInResponse => ({ status: 302, headers: { Location: location, "Cache-Control": "no-store", ...extra } });
const clearCookie = `${COOKIE}=; Path=/api/linkedin; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function handleLinkedIn(req: LinkedInRequest, env: LinkedInEnv, deps: LinkedInDeps = {}): Promise<LinkedInResponse> {
  const clientId = env.LINKEDIN_CLIENT_ID?.trim();
  const secret = env.LINKEDIN_CLIENT_SECRET?.trim();
  const configured = Boolean(clientId && secret);
  const redirectUri = env.LINKEDIN_REDIRECT_URI?.trim() || `${(env.APP_URL?.trim() || req.origin).replace(/\/+$/, "")}/api/linkedin`;
  const now = (deps.now ?? Date.now)();
  const fetchImpl = deps.fetchImpl ?? fetch;

  try {
    // Status check, so the app can show or hide "Connect LinkedIn".
    if (req.method === "GET" && !req.query.code && !req.query.error && !req.query.state) {
      return { status: 200, body: { configured } };
    }

    // Start: a signed-in user asks for the LinkedIn sign-in URL.
    if (req.method === "POST") {
      if (!configured) throw new HttpError(503, "linkedin_unavailable", "LinkedIn connect isn't set up on this server yet.");
      const projectId = (env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || FIREBASE_WEB_CONFIG.projectId).trim();
      const uid = await (deps.verifyToken ?? verifyFirebaseToken)(req.authorization, projectId);
      const nonce = randomBytes(16).toString("base64url");
      const returnTo = safeReturn((req.body as { returnTo?: unknown } | null)?.returnTo);
      const state = makeState({ uid, nonce, returnTo, exp: now + STATE_TTL_MS }, secret!);
      const url = `${LINKEDIN_AUTHORIZE}?${new URLSearchParams({ response_type: "code", client_id: clientId!, redirect_uri: redirectUri, state, scope: SCOPE })}`;
      return {
        status: 200,
        headers: { "Set-Cookie": `${COOKIE}=${nonce}; Path=/api/linkedin; HttpOnly; Secure; SameSite=Lax; Max-Age=600`, "Cache-Control": "no-store" },
        body: { url },
      };
    }

    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "Use GET or POST.");

    // Callback from LinkedIn.
    const state = configured && req.query.state ? readState(req.query.state, secret!, now) : null;
    const back = state?.returnTo ?? "/profile";
    const fail = (code: string) => redirect(`${back}#linkedin_error=${code}`, { "Set-Cookie": clearCookie });
    if (!state || cookieValue(req.cookie, COOKIE) !== state.nonce) return fail("expired");
    if (req.query.error) return fail(req.query.error === "user_cancelled_login" || req.query.error === "user_cancelled_authorize" ? "cancelled" : "denied");
    if (!req.query.code) return fail("denied");

    const tokenRes = await fetchImpl(LINKEDIN_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: req.query.code, redirect_uri: redirectUri, client_id: clientId!, client_secret: secret! }),
    });
    const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
    if (!tokenRes.ok || !token.access_token) {
      console.warn(`[linkedin] token exchange failed: ${tokenRes.status}`);
      return fail("token");
    }
    const infoRes = await fetchImpl(LINKEDIN_USERINFO, { headers: { Authorization: `Bearer ${token.access_token}` } });
    const info = (await infoRes.json().catch(() => ({}))) as { sub?: string; name?: string; given_name?: string; family_name?: string; email?: string; picture?: string };
    if (!infoRes.ok || !info.sub) return fail("profile");

    // Identity only — the access token is used once here and never stored.
    const identity = {
      sub: info.sub,
      name: info.name || [info.given_name, info.family_name].filter(Boolean).join(" "),
      email: info.email ?? "",
      picture: info.picture ?? "",
      uid: state.uid,
    };
    return redirect(`${back}#linkedin=${b64url(JSON.stringify(identity))}`, { "Set-Cookie": clearCookie });
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: { code: err.code, message: err.message } } };
    console.error("[linkedin] unexpected error", err);
    return { status: 500, body: { error: { code: "server_error", message: "Something went wrong. Try again." } } };
  }
}
