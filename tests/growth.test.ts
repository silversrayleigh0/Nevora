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

const { handleAi } = await import("../api/_lib/handler");
const { keepCitedCourses } = await import("../api/_lib/prompts");
const { normalizeCourses } = await import("../src/lib/normalize");

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
      data: {
        courses: [
          { skill: "Docker", title: "Docker for beginners", url: "https://docs.docker.com/get-started/" },
          { skill: "SQL", title: "SQL basics", url: "https://www.khanacademy.org/computing/computer-programming/sql" },
          { skill: "SQL", title: "Fake", url: "https://fake.dev/x" },
        ],
      },
      sources: ["https://docs.docker.com/get-started/", "https://www.khanacademy.org/computing/computer-programming/sql"],
    }));
    const r = await handleAi(post({ task: "findCourses", input: { skills: ["Docker", "SQL"], role: "Backend intern" } }), env, { claude });
    expect(r.status).toBe(200);
    expect((r.body as { data: { courses: unknown[] } }).data.courses).toHaveLength(2);
    expect(claude).toHaveBeenCalledTimes(1);
    expect((claude.mock.calls[0] as unknown as [{ webSearch: boolean; system: string }])[0].webSearch).toBe(true);
  });

  it("never sends web-search tasks to OpenRouter", async () => {
    const fetchImpl = vi.fn();
    const r = await handleAi(post({ task: "findCourses", input: { skill: "Docker" } }), { OPENROUTER_API_KEY: "sk-or", AI_REQUESTS_PER_HOUR: "1000" }, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.status).toBe(503);
    expect((r.body as { error: { code: string } }).error.code).toBe("search_unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("groups courses by gap skill and drops duplicates and unknown skills", () => {
    const by = normalizeCourses(
      { courses: [{ skill: "docker", title: "A", url: "https://a.dev/1", free: true }, { skill: "Docker", title: "A again", url: "https://a.dev/1" }, { skill: "Go", title: "B", url: "https://b.dev" }] },
      ["Docker", "SQL"],
    );
    expect(Object.keys(by)).toEqual(["docker"]);
    expect(by.docker[0]).toMatchObject({ skill: "Docker", free: true, source: "web" });
  });
});
