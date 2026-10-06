// Finds and validates a LinkedIn profile URL. Format checks only: nothing here
// contacts LinkedIn, and only personal profile links (/in/<handle>) count.

const CANONICAL = "https://www.linkedin.com/in/";

/** LinkedIn handles: 3–100 letters, digits, hyphens or underscores (some older ones have %-escapes). */
const HANDLE = /^[A-Za-z0-9_-](?:[A-Za-z0-9_%-]{1,98})[A-Za-z0-9_-]$/;

/**
 * linkedin.com/in/<handle>, with optional scheme, www. or a country subdomain (in., uk., …),
 * a trailing slash, query or fragment. The host must start the match, or follow a
 * non-host character, so "evil.com/linkedin.com/in/x" and "linkedin.com.evil.com" don't match.
 */
const FIND = /(?:^|[^A-Za-z0-9.\-/@])((?:https?:\/\/)?(?:(?:www|[a-z]{2})\.)?linkedin\.com\/in\/[^\s/?#"'<>)\]]+\/?(?:[?#][^\s"'<>)\]]*)?)/gi;
const EXACT = /^(?:https?:\/\/)?(?:(?:www|[a-z]{2})\.)?linkedin\.com\/in\/([^\s/?#]+)\/?(?:[?#]\S*)?$/i;

/** Returns https://www.linkedin.com/in/<handle>, or null when the input isn't a profile URL. */
export function normalizeLinkedInUrl(input: string): string | null {
  const match = EXACT.exec(input.trim());
  if (!match) return null;
  const handle = match[1].replace(/[.,;:]+$/, "");
  if (!HANDLE.test(handle)) return null;
  return `${CANONICAL}${handle}`;
}

/**
 * The first valid LinkedIn profile URL in the given sources, in order: plain resume text
 * first, then hyperlink targets. Company, school and job links are ignored.
 */
export function findLinkedInUrl(sources: string[]): string | null {
  for (const source of sources) {
    if (!source) continue;
    for (const m of source.matchAll(FIND)) {
      const url = normalizeLinkedInUrl(m[1].replace(/[.,;:]+$/, ""));
      if (url) return url;
    }
  }
  return null;
}

export const isLinkedInLink = (link: string) => /(^|[./])linkedin\.com(\/|$)/i.test(link);

export const LINKEDIN_URL_ERROR = "Enter a LinkedIn profile link like linkedin.com/in/your-name.";
