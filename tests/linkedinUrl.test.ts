import { describe, expect, it } from "vitest";
import { findLinkedIn, findLinkedInUrl, normalizeLinkedInUrl } from "../src/lib/linkedinUrl";

const CANON = "https://www.linkedin.com/in/arun-kumar";

describe("normalizeLinkedInUrl", () => {
  it.each([
    "linkedin.com/in/arun-kumar",
    "https://linkedin.com/in/arun-kumar",
    "http://www.linkedin.com/in/arun-kumar/",
    "https://in.linkedin.com/in/arun-kumar",
    "www.LinkedIn.com/in/arun-kumar?utm_source=share",
    "  linkedin.com/in/arun-kumar#about  ",
  ])("normalizes %s", (input) => expect(normalizeLinkedInUrl(input)).toBe(CANON));

  it.each([
    "",
    "arun-kumar",
    "linkedin.com/in/",
    "linkedin.com/in/a",
    "linkedin.com/in/arun kumar",
    "linkedin.com/in/arun$kumar",
    "linkedin.com/company/acme-labs",
    "linkedin.com/school/iit-madras",
    "linkedin.com.evil.com/in/arun-kumar",
    "https://evil.com/linkedin.com/in/arun-kumar",
    "ftp://linkedin.com/in/arun-kumar",
  ])("rejects %j", (input) => expect(normalizeLinkedInUrl(input)).toBeNull());
});

describe("findLinkedInUrl", () => {
  it("finds a URL in plain resume text", () => {
    expect(findLinkedInUrl(["Arun Kumar\nChennai · arun@example.com · linkedin.com/in/arun-kumar · github.com/arunk"])).toBe(CANON);
  });

  it("finds a URL that only exists as a hyperlink target", () => {
    const text = "Arun Kumar | LinkedIn | GitHub";
    const links = ["mailto:arun@example.com", "https://github.com/arunk", "https://www.linkedin.com/in/arun-kumar/"];
    expect(findLinkedInUrl([text, ...links])).toBe(CANON);
  });

  it("ignores company and other non-profile LinkedIn links", () => {
    expect(findLinkedInUrl(["Intern at linkedin.com/company/acme-labs", "https://www.linkedin.com/jobs/view/123", "https://linkedin.com/school/x"])).toBeNull();
  });

  it("picks the first valid profile URL when there are several", () => {
    const text = "See linkedin.com/company/acme then linkedin.com/in/first-one and linkedin.com/in/second-one.";
    expect(findLinkedInUrl([text, "https://linkedin.com/in/from-link"])).toBe("https://www.linkedin.com/in/first-one");
  });

  it("strips trailing punctuation from text", () => {
    expect(findLinkedInUrl(["Profile: (linkedin.com/in/arun-kumar)."])).toBe(CANON);
  });

  it("returns null when there is no LinkedIn URL", () => {
    expect(findLinkedInUrl(["Arun Kumar\ngithub.com/arunk", ""])).toBeNull();
    expect(findLinkedInUrl([])).toBeNull();
  });

  it("does not match lookalike hosts in text", () => {
    expect(findLinkedInUrl(["visit notlinkedin.com/in/arun-kumar or evil.com/linkedin.com/in/arun-kumar"])).toBeNull();
  });
});

describe("findLinkedIn reports where the URL came from", () => {
  it("prefers the visible text", () => {
    expect(findLinkedIn(["linkedin.com/in/arun-kumar"], ["https://linkedin.com/in/other-one"])).toEqual({ url: CANON, source: "text" });
  });
  it("falls back to hidden hyperlinks", () => {
    expect(findLinkedIn(["Arun Kumar | LinkedIn"], ["https://www.linkedin.com/company/acme", "https://in.linkedin.com/in/arun-kumar/"])).toEqual({ url: CANON, source: "hyperlink" });
  });
  it("returns null when neither has one", () => {
    expect(findLinkedIn(["no links"], ["https://github.com/arunk"])).toBeNull();
  });
});
