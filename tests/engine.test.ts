import { describe, expect, it } from "vitest";
import type { Requirement, TailoredResume } from "../shared/types";
import { localAnalyzeJD, localMatch, localTailor, localVerify, mentions, mergeVerifications, potentialScore, profileStrength, scoreMatch } from "../src/lib/engine";
import { normalizeProfile, normalizeRequirements, normalizeResume } from "../src/lib/normalize";
import { stripPlaceholders } from "../src/lib/pdf";
import { SAMPLE_JD_TEXT } from "../src/lib/sample";
import { demoState } from "./fixtures";

const { profile } = demoState();
const req = (requirement: string, type: Requirement["type"], status: Requirement["status"]): Requirement => ({ requirement, type, status, evidenceIds: [], note: "" });

describe("mentions", () => {
  it("matches whole words and aliases", () => {
    expect(mentions("Built REST APIs in Express", "REST APIs")).toBe(true);
    expect(mentions("Wrote backend APIs", "REST APIs")).toBe(true);
    expect(mentions("Used Java", "JavaScript")).toBe(false);
    expect(mentions("JavaScript developer", "Java")).toBe(false);
    expect(mentions("C++ and Go", "C++")).toBe(true);
  });
});

describe("scoreMatch", () => {
  it("weights groups and shares the weight of missing groups", () => {
    const m = scoreMatch([req("React", "must", "strong"), req("Git", "must", "partial"), req("Jest", "nice", "missing")]);
    expect(m.breakdown.must).toBe(75);
    expect(m.breakdown.nice).toBe(0);
    // (75 * 0.6 + 0 * 0.2) / 0.8
    expect(m.score).toBe(56);
  });
  it("forecasts the score when gaps are closed", () => {
    const reqs = [req("React", "must", "strong"), req("Jest", "nice", "missing")];
    expect(potentialScore(reqs)).toBe(100);
    expect(potentialScore(reqs, ["jest"])).toBe(100);
    expect(potentialScore(reqs, ["Docker"])).toBe(scoreMatch(reqs).score);
  });
});

describe("basic mode", () => {
  const jd = localAnalyzeJD(SAMPLE_JD_TEXT);

  it("splits required from nice-to-have skills", () => {
    expect(jd.title).toBe("Frontend Developer Intern");
    expect(jd.company).toBe("Acme Labs");
    expect(jd.mustHave.map((s) => s.skill)).toEqual(expect.arrayContaining(["JavaScript", "React", "REST APIs", "Git"]));
    expect(jd.niceToHave.map((s) => s.skill)).toEqual(expect.arrayContaining(["TypeScript", "Jest", "Docker"]));
    expect(jd.mustHave.some((s) => s.skill === "Docker")).toBe(false);
  });

  it("only cites evidence that exists in the profile", () => {
    const reqs = localMatch(profile, jd);
    const docker = reqs.find((r) => r.requirement === "Docker")!;
    expect(docker.status).toBe("missing");
    expect(reqs.find((r) => r.requirement === "React")!.status).toBe("strong");
    expect(reqs.find((r) => r.requirement === "TypeScript")!.status).toBe("partial");
  });

  it("tailors without inventing anything, and every line verifies", () => {
    const resume = localTailor(profile, jd);
    const bullets = resume.sections.flatMap((s) => s.items.flatMap((i) => i.bullets));
    expect(bullets.length).toBeGreaterThan(0);
    expect(bullets.every((b) => b.sourceIds.length === 1)).toBe(true);
    expect(localVerify(profile, resume).every((v) => v.supported)).toBe(true);
  });
});

describe("localVerify", () => {
  const base = localTailor(profile, localAnalyzeJD(SAMPLE_JD_TEXT));
  const withText = (text: string, sourceIds = ["proj_1_b1"]): TailoredResume => ({
    ...base,
    sections: [{ key: "projects", items: [{ refId: "proj_1", heading: "x", bullets: [{ id: "t1", text, sourceIds, originalText: "", changeReason: "", needsMetric: false }] }] }],
  });

  it("flags numbers that aren't in the source", () => {
    expect(localVerify(profile, withText("Built a React site used by 5000 students"))[0].supported).toBe(false);
  });
  it("allows numbers that are in the source and placeholders", () => {
    expect(localVerify(profile, withText("Led a team of 4 students", ["proj_1_b3"]))[0].supported).toBe(true);
    expect(localVerify(profile, withText("Built a React site for the fest [add metric]"))[0].supported).toBe(true);
  });
  it("flags tools the source doesn't mention", () => {
    expect(localVerify(profile, withText("Built a React site with Docker"))[0].supported).toBe(false);
  });
  it("flags lines with no source", () => {
    expect(localVerify(profile, withText("Experienced with Kubernetes", []))[0].supported).toBe(false);
  });
  it("requires both checks to pass", () => {
    const local = [{ bulletId: "t1", supported: true }];
    expect(mergeVerifications(local, [{ bulletId: "t1", supported: false, issue: "x" }])[0].supported).toBe(false);
    expect(mergeVerifications(local, [])[0].supported).toBe(false);
    expect(mergeVerifications([{ bulletId: "t1", supported: false }], [{ bulletId: "t1", supported: true }])[0].supported).toBe(false);
  });
});

describe("normalizers", () => {
  it("survives garbage and dedupes IDs", () => {
    const p = normalizeProfile({ projects: [{ id: "p", bullets: ["a", { text: "b" }] }, { id: "p" }], skills: [{ name: "Go", category: "weird" }, "Rust", 42] });
    expect(p.projects.map((x) => x.id)).toEqual(["p", "px"]);
    expect(p.projects[0].bullets.map((b) => b.text)).toEqual(["a", "b"]);
    expect(p.skills.map((s) => [s.name, s.category])).toEqual([
      ["Go", "tool"],
      ["Rust", "tool"],
    ]);
    expect(normalizeProfile(null).projects).toEqual([]);
  });
  it("drops evidence IDs that don't exist, downgrading the claim", () => {
    const reqs = normalizeRequirements({ requirements: [{ requirement: "Docker", type: "nice", status: "strong", evidenceIds: ["made_up"] }] }, profile);
    expect(reqs[0].status).toBe("missing");
    expect(reqs[0].evidenceIds).toEqual([]);
  });
  it("gives every tailored bullet a unique id", () => {
    const r = normalizeResume({ sections: [{ key: "projects", items: [{ bullets: [{ id: "t1", text: "a" }, { id: "t1", text: "b" }, { text: "" }] }] }] });
    const ids = r.sections[0].items[0].bullets.map((b) => b.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("profile strength and pdf text", () => {
  it("scores the sample profile", () => {
    const s = profileStrength(profile);
    expect(s.score).toBeGreaterThan(70);
    expect(s.tips[0]).toMatch(/Add impact/);
  });
  it("removes coaching placeholders and dangling separators", () => {
    expect(stripPlaceholders("Web Development Intern — [Company name]")).toBe("Web Development Intern");
    expect(stripPlaceholders("Built an app [add metric]")).toBe("Built an app");
  });
});
