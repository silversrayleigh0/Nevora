import { describe, expect, it, vi } from "vitest";

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
// The client LinkedIn helpers import the session module; keep Firebase out of unit tests.
vi.mock("../src/lib/session", () => ({ idToken: async () => null }));

const { handleAi } = await import("../api/_lib/handler");
const { keepCitedCourses } = await import("../api/_lib/prompts");
const { handleLinkedIn, makeState, readState, safeReturn } = await import("../api/_lib/linkedin");
const { compareWithProfile, applySuggestions, namesMatch, hasSkill } = await import("../src/lib/linkedin");
const { normalizeCourses, emptyProfile } = await import("../src/lib/normalize");

const env = { ANTHROPIC_API_KEY: "sk-ant-test", AI_REQUESTS_PER_HOUR: "1000" };
const post = (body: unknown) => ({ method: "POST", authorization: "Bearer good", body });

describe("course search", () => {
  it("keeps only courses whose links appeared in the search results", () => {
    const data = {
      courses: [
        { title: "Real", url: "https://www.coursera.org/learn/docker-basics/" },
        { title: "Made up", url: "https://example.com/not-searched" },
        { title: "Not https", url: "http://coursera.org/learn/docker-basics" },
      ],
    };
    const kept = keepCitedCourses(data, ["https://coursera.org/learn/docker-basics?utm=x"]);
    expect(kept.courses.map((c) => c.title)).toEqual(["Real"]);
  });

  it("runs findCourses on Claude with web search and filters the links", async () => {
    const claude = vi.fn(async () => ({
      data: { courses: [{ title: "Docker for beginners", url: "https://docs.docker.com/get-started/" }, { title: "Fake", url: "https://fake.dev/x" }] },
      sources: ["https://docs.docker.com/get-started/"],
    }));
    const r = await handleAi(post({ task: "findCourses", input: { skill: "Docker", role: "Backend intern" } }), env, { claude });
    expect(r.status).toBe(200);
    expect((r.body as { data: { courses: unknown[] } }).data.courses).toHaveLength(1);
    expect((claude.mock.calls[0] as unknown as [{ webSearch: boolean; system: string }])[0].webSearch).toBe(true);
  });

  it("never sends web-search tasks to OpenRouter", async () => {
    const fetchImpl = vi.fn();
    const r = await handleAi(post({ task: "findCourses", input: { skill: "Docker" } }), { OPENROUTER_API_KEY: "sk-or", AI_REQUESTS_PER_HOUR: "1000" }, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.status).toBe(503);
    expect((r.body as { error: { code: string } }).error.code).toBe("search_unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("normalizes courses and drops duplicates", () => {
    const list = normalizeCourses({ courses: [{ title: "A", url: "https://a.dev/1", free: true }, { title: "A again", url: "https://a.dev/1" }, { title: "", url: "https://b.dev" }] }, "Docker");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ skill: "Docker", free: true, source: "web" });
  });
});

describe("LinkedIn OAuth", () => {
  const li = { LINKEDIN_CLIENT_ID: "cid", LINKEDIN_CLIENT_SECRET: "secret", APP_URL: "https://nevora.app" };
  const base = { query: {}, origin: "https://nevora.app", body: null };

  it("signs state and rejects tampering or expiry", () => {
    const state = makeState({ uid: "u1", nonce: "n1", returnTo: "/new/grow", exp: 2000 }, "secret");
    expect(readState(state, "secret", 1000)).toMatchObject({ uid: "u1", returnTo: "/new/grow" });
    expect(readState(state, "other", 1000)).toBeNull();
    expect(readState(state, "secret", 3000)).toBeNull();
    expect(readState(state.replace(/^./, "x"), "secret", 1000)).toBeNull();
  });

  it("only redirects back to same-site paths", () => {
    expect(safeReturn("/new/grow")).toBe("/new/grow");
    expect(safeReturn("//evil.com")).toBe("/profile");
    expect(safeReturn("https://evil.com")).toBe("/profile");
  });

  it("reports whether it is configured and refuses to start without keys", async () => {
    expect((await handleLinkedIn({ ...base, method: "GET" }, {})).body).toEqual({ configured: false });
    expect((await handleLinkedIn({ ...base, method: "GET" }, li)).body).toEqual({ configured: true });
    expect((await handleLinkedIn({ ...base, method: "POST", authorization: "Bearer good" }, {})).status).toBe(503);
  });

  it("runs the authorization code flow and returns identity only", async () => {
    const verifyToken = async () => "u1";
    const start = await handleLinkedIn({ ...base, method: "POST", authorization: "Bearer good", body: { returnTo: "/new/grow" } }, li, { verifyToken, now: () => 1000 });
    const url = new URL((start.body as { url: string }).url);
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("redirect_uri")).toBe("https://nevora.app/api/linkedin");
    const nonce = /nv_li=([^;]+)/.exec(start.headers!["Set-Cookie"])![1];

    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).includes("accessToken")
        ? new Response(JSON.stringify({ access_token: "tok" }), { status: 200 })
        : new Response(JSON.stringify({ sub: "li-1", name: "Arun Kumar", email: "arun@example.com", picture: "" }), { status: 200 }),
    );
    const query = { code: "abc", state: url.searchParams.get("state")! };
    const done = await handleLinkedIn({ ...base, method: "GET", query, cookie: `nv_li=${nonce}` }, li, { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 2000 });
    expect(done.status).toBe(302);
    const location = done.headers!.Location;
    expect(location.startsWith("/new/grow#linkedin=")).toBe(true);
    const identity = JSON.parse(Buffer.from(location.split("=")[1], "base64url").toString());
    expect(identity).toEqual({ sub: "li-1", name: "Arun Kumar", email: "arun@example.com", picture: "", uid: "u1" });
    expect(JSON.stringify(identity)).not.toContain("tok");

    const stolen = await handleLinkedIn({ ...base, method: "GET", query, cookie: "nv_li=other" }, li, { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 2000 });
    expect(stolen.headers!.Location).toBe("/new/grow#linkedin_error=expired");
  });
});

describe("LinkedIn compare", () => {
  const current = {
    ...emptyProfile("Arun Kumar", "a@x.com"),
    skills: [
      { id: "s1", name: "React.js", category: "framework" as const },
      { id: "s2", name: "Git", category: "tool" as const },
    ],
    experience: [{ id: "e1", role: "Web Development Intern", org: "Sample Tech", start: "Jun 2025", end: "Jul 2025", bullets: [] }],
  };
  const imported = {
    ...emptyProfile("Arun K", ""),
    summary: "Builder of things",
    skills: [
      { id: "x1", name: "React", category: "framework" as const },
      { id: "x2", name: "Docker", category: "tool" as const },
    ],
    experience: [
      { id: "x3", role: "Web Development Intern", org: "Sample Tech Pvt Ltd", start: "", end: "", bullets: [] },
      { id: "x4", role: "Teaching Assistant", org: "Sample Institute", start: "Jan 2024", end: "May 2024", bullets: [{ id: "b", text: "Ran weekly labs" }] },
    ],
  };

  it("suggests only what the resume doesn't already have", () => {
    const s = compareWithProfile(current, imported);
    expect(s.map((x) => x.key)).toEqual(["skill:docker", "experience:sample institute:teaching assistant", "summary"]);
    expect(compareWithProfile(current, imported, ["skill:docker"]).map((x) => x.key)).not.toContain("skill:docker");
  });

  it("adds chosen items with fresh ids", () => {
    const next = applySuggestions(current, compareWithProfile(current, imported));
    expect(hasSkill(next, "Docker")).toBe(true);
    expect(next.experience).toHaveLength(2);
    expect(next.experience[1].id).not.toBe("x4");
    expect(next.summary).toBe("Builder of things");
  });

  it("matches names with initials but not different people", () => {
    expect(namesMatch("Arun K", "Arun Kumar")).toBe(true);
    expect(namesMatch("Priya Sharma", "Arun Kumar")).toBe(false);
  });
});
