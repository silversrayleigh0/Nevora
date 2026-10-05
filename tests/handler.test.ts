import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/_lib/auth.js", async (original) => {
  const real = await original<typeof import("../api/_lib/auth.js")>();
  return {
    ...real,
    verifyFirebaseToken: vi.fn(async (header?: string) => {
      if (header !== "Bearer good") throw new real.HttpError(401, "session_expired", "expired");
      return `user-${Math.random()}`;
    }),
  };
});

const { handleAi } = await import("../api/_lib/handler");
const { extractJson } = await import("../api/_lib/openrouter");
const { HttpError } = await import("../api/_lib/auth");

const both = { ANTHROPIC_API_KEY: "sk-ant-test", OPENROUTER_API_KEY: "sk-or-test", AI_REQUESTS_PER_HOUR: "1000" };
const orOnly = { OPENROUTER_API_KEY: "sk-or-test", AI_REQUESTS_PER_HOUR: "1000" };
const post = (body: unknown, authorization = "Bearer good") => ({ method: "POST", authorization, body });
const openrouterReply = (content: string, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status, headers: { "Content-Type": "application/json" } }));
const asFetch = (f: unknown) => f as typeof fetch;

describe("AI endpoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports which providers are configured", async () => {
    expect((await handleAi({ method: "GET", body: null }, both)).body).toEqual({ ai: true, claude: true, openrouter: true, openrouterKeys: 1 });
    expect((await handleAi({ method: "GET", body: null }, {})).body).toEqual({ ai: false, claude: false, openrouter: false, openrouterKeys: 0 });
  });

  it("refuses when no provider is configured", async () => {
    expect((await handleAi(post({ task: "analyzeJD", input: "x" }), {})).status).toBe(503);
  });

  it("requires a valid Firebase session", async () => {
    expect((await handleAi(post({ task: "analyzeJD", input: "x" }, ""), both)).status).toBe(401);
  });

  it("rejects unknown tasks so it can't be used as an open proxy", async () => {
    expect((await handleAi(post({ task: "anythingElse", input: "x" }), both)).status).toBe(400);
  });

  it("rejects oversized input and misplaced or missing images", async () => {
    expect((await handleAi(post({ task: "analyzeJD", input: "x".repeat(70_000) }), both)).status).toBe(413);
    expect((await handleAi(post({ task: "tailor", input: {}, image: "data:image/png;base64,AAAA" }), both)).status).toBe(400);
    expect((await handleAi(post({ task: "verifyDocument", input: {} }), both)).status).toBe(400);
  });

  it("uses Claude first with the server-side prompt", async () => {
    const claude = vi.fn(async () => ({ title: "Intern" }));
    const fetchImpl = openrouterReply("{}");
    const r = await handleAi(post({ task: "analyzeJD", input: "job text" }), both, { claude, fetchImpl: asFetch(fetchImpl) });
    expect(r).toEqual({ status: 200, body: { data: { title: "Intern" }, provider: "claude" } });
    expect(fetchImpl).not.toHaveBeenCalled();
    const opts = (claude.mock.calls[0] as unknown as [{ model: string; system: string; user: string; effort: string }])[0];
    expect(opts.model).toBe("claude-opus-5-5");
    expect(opts.system).toMatch(/You analyze a job description/);
    expect(opts.user).toBe("INPUT:\njob text");
    expect(opts.effort).toBe("low");
  });

  it("passes document images to Claude", async () => {
    const claude = vi.fn(async () => ({ verdict: "verified" }));
    await handleAi(post({ task: "verifyDocument", input: { kind: "certificate" }, image: "data:image/jpeg;base64,AAAA" }), both, { claude });
    const user = (claude.mock.calls[0] as unknown as [{ user: { type: string }[] }])[0].user;
    expect(user.map((p) => p.type)).toEqual(["text", "image_url"]);
  });

  it("falls back to OpenRouter when Claude fails", async () => {
    const claude = vi.fn(async () => {
      throw new HttpError(502, "upstream_error", "overloaded");
    });
    const fetchImpl = openrouterReply('```json\n{"title":"Intern"}\n```');
    const r = await handleAi(post({ task: "analyzeJD", input: "job text" }), both, { claude, fetchImpl: asFetch(fetchImpl) });
    expect(r).toEqual({ status: 200, body: { data: { title: "Intern" }, provider: "openrouter" } });
    const sent = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.messages[0].content).toMatch(/You analyze a job description/);
    expect(sent.response_format).toEqual({ type: "json_object" });
  });

  it("reports the error when every provider fails", async () => {
    const claude = vi.fn(async () => {
      throw new HttpError(502, "upstream_error", "down");
    });
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 429 }));
    const r = await handleAi(post({ task: "match", input: {} }), both, { claude, fetchImpl: asFetch(fetchImpl) });
    expect(r.status).toBe(429);
  });

  it("works with OpenRouter alone, retrying once on malformed JSON", async () => {
    const fetchImpl = openrouterReply("not json at all");
    const r = await handleAi(post({ task: "match", input: {} }), orOnly, { fetchImpl: asFetch(fetchImpl) });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(r.status).toBe(502);
  });

  it("tries each OpenRouter key in order", async () => {
    const env = { OPENROUTER_API_KEY: "k1", OPENROUTER_API_KEY_2: "k2", OPENROUTER_API_KEY_3: "k3", AI_REQUESTS_PER_HOUR: "1000" };
    const used: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const key = String((init.headers as Record<string, string>).Authorization).replace("Bearer ", "");
      used.push(key);
      if (key !== "k3") return new Response("{}", { status: 402 });
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 });
    });
    const r = await handleAi(post({ task: "analyzeJD", input: "x" }), env, { fetchImpl: asFetch(fetchImpl) });
    expect(used).toEqual(["k1", "k2", "k3"]);
    expect(r).toEqual({ status: 200, body: { data: { ok: true }, provider: "openrouter-3" } });
  });

  it("limits requests per user", async () => {
    const { verifyFirebaseToken } = await import("../api/_lib/auth.js");
    vi.mocked(verifyFirebaseToken).mockResolvedValue("same-user");
    const claude = vi.fn(async () => ({}));
    const limited = { ...both, AI_REQUESTS_PER_HOUR: "2" };
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await handleAi(post({ task: "coachBullet", input: "x" }), limited, { claude })).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe("extractJson", () => {
  it("finds the object inside chatter", () => {
    expect(extractJson('Sure! {"a":1} Hope that helps')).toEqual({ a: 1 });
  });
});
