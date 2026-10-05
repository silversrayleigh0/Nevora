import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/_lib/auth.js", async (original) => {
  const real = await original<typeof import("../api/_lib/auth.js")>();
  return {
    ...real,
    verifyFirebaseToken: vi.fn(async (header?: string) => {
      if (header !== "Bearer good") throw new real.HttpError(401, "session_expired", "expired");
      return "user-1";
    }),
  };
});

const { handleAi } = await import("../api/_lib/handler");
const { extractJson } = await import("../api/_lib/openrouter");

const env = { OPENROUTER_API_KEY: "sk-test", FIREBASE_PROJECT_ID: "nevora-test", AI_REQUESTS_PER_HOUR: "1000" };
const reply = (content: string, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status, headers: { "Content-Type": "application/json" } }));

describe("AI endpoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports whether AI is configured", async () => {
    expect((await handleAi({ method: "GET", body: null }, env)).body).toEqual({ ai: true });
    expect((await handleAi({ method: "GET", body: null }, {})).body).toEqual({ ai: false });
  });

  it("refuses when not configured", async () => {
    const r = await handleAi({ method: "POST", authorization: "Bearer good", body: { task: "analyzeJD", input: "x" } }, {});
    expect(r.status).toBe(503);
  });

  it("requires a valid Firebase session", async () => {
    const r = await handleAi({ method: "POST", body: { task: "analyzeJD", input: "x" } }, env);
    expect(r.status).toBe(401);
  });

  it("rejects unknown tasks so it can't be used as an open proxy", async () => {
    const r = await handleAi({ method: "POST", authorization: "Bearer good", body: { task: "anythingElse", input: "x" } }, env);
    expect(r.status).toBe(400);
  });

  it("rejects oversized input and images on the wrong task", async () => {
    const big = await handleAi({ method: "POST", authorization: "Bearer good", body: { task: "analyzeJD", input: "x".repeat(70_000) } }, env);
    expect(big.status).toBe(413);
    const img = await handleAi({ method: "POST", authorization: "Bearer good", body: { task: "tailor", input: {}, image: "data:image/png;base64,AAAA" } }, env);
    expect(img.status).toBe(400);
  });

  it("sends the server-side prompt and returns parsed JSON", async () => {
    const fetchMock = reply('```json\n{"title":"Intern"}\n```');
    const r = await handleAi({ method: "POST", authorization: "Bearer good", body: { task: "analyzeJD", input: "job text" } }, env, fetchMock as unknown as typeof fetch);
    expect(r).toEqual({ status: 200, body: { data: { title: "Intern" } } });
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.messages[0].content).toMatch(/You analyze a job description/);
    expect(sent.messages[1].content).toBe("INPUT:\njob text");
    expect(sent.response_format).toEqual({ type: "json_object" });
  });

  it("retries once on malformed JSON, then reports it", async () => {
    const fetchMock = reply("not json at all");
    const r = await handleAi({ method: "POST", authorization: "Bearer good", body: { task: "match", input: {} } }, env, fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.status).toBe(502);
  });

  it("maps upstream rate limits", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 429 }));
    const r = await handleAi({ method: "POST", authorization: "Bearer good", body: { task: "match", input: {} } }, env, fetchMock as unknown as typeof fetch);
    expect(r.status).toBe(429);
  });

  it("limits requests per user", async () => {
    const fetchMock = reply("{}");
    const limited = { ...env, AI_REQUESTS_PER_HOUR: "2" };
    const call = () => handleAi({ method: "POST", authorization: "Bearer good", body: { task: "coachBullet", input: "x" } }, limited, fetchMock as unknown as typeof fetch);
    // The window is shared with earlier tests for user-1, so the limit is hit right away.
    const statuses = [(await call()).status, (await call()).status, (await call()).status];
    expect(statuses).toContain(429);
  });
});

describe("extractJson", () => {
  it("finds the object inside chatter", () => {
    expect(extractJson('Sure! {"a":1} Hope that helps')).toEqual({ a: 1 });
  });
});
