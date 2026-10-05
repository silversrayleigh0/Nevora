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
const { compareWithProfile, applySuggestions, hasSkill } = await import("../src/lib/linkedin");
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
    certifications: [{ id: "c1", name: "AWS Cloud Practitioner", issuer: "", date: "", credential: "" }],
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
    expect(s.map((x) => x.key)).toEqual(["skill:docker", "experience:sample institute:teaching assistant", "certification:aws cloud practitioner"]);
    expect(compareWithProfile(current, imported, ["skill:docker"]).map((x) => x.key)).not.toContain("skill:docker");
  });

  it("adds chosen items with fresh ids", () => {
    const next = applySuggestions(current, compareWithProfile(current, imported));
    expect(hasSkill(next, "Docker")).toBe(true);
    expect(next.experience).toHaveLength(2);
    expect(next.experience[1].id).not.toBe("x4");
    expect(next.certifications[0].proof).toBeUndefined();
  });


});
