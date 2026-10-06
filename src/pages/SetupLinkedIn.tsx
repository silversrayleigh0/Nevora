import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { CheckIcon, SparkleIcon } from "../components/icons";
import { RequireSession, SetupHeader } from "../components/layout";
import { Button } from "../components/ui";
import { isLinkedInLink, LINKEDIN_URL_ERROR, normalizeLinkedInUrl, type LinkedInSource } from "../lib/linkedinUrl";
import { useApp } from "../store/app";
import { useSetup } from "../store/setup";

/** The "we did this for you" marker on an auto-detected link. */
const AutoBadge = ({ children = "Auto-detected" }: { children?: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[13px] font-semibold text-brand-ink">
    <SparkleIcon size={13} className="text-brand" />
    {children}
  </span>
);

const SOURCE_NOTE: Record<LinkedInSource, string> = {
  text: "Spotted in your resume text, so you don’t have to copy and paste it.",
  hyperlink: "Found behind the “LinkedIn” link in your resume, even though the URL wasn’t written out.",
};

/**
 * Last setup step: confirm the LinkedIn profile URL found in the resume (text or hidden
 * hyperlink), or type one in. Nothing is saved to the profile until the user confirms.
 * Format checks only; LinkedIn is never contacted.
 */
function LinkedInUrlCard() {
  const inputId = useId();
  const errorId = useId();
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const found = useSetup((s) => s.foundLinkedIn);
  const setFound = useSetup((s) => s.setFoundLinkedIn);
  const savedLink = profile?.basics.links.find(isLinkedInLink) ?? "";
  const saved = savedLink ? (normalizeLinkedInUrl(savedLink) ?? savedLink) : "";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [savedFrom, setSavedFrom] = useState<LinkedInSource | null>(null);
  if (!profile) return null;

  const save = (url: string, from: LinkedInSource | null = null) => {
    setSavedFrom(from);
    setProfile({ ...profile, basics: { ...profile.basics, links: [...profile.basics.links.filter((l) => !isLinkedInLink(l)), url] } });
    setFound(null);
    setEditing(false);
    setError("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const url = normalizeLinkedInUrl(value);
    if (!url) return setError(LINKEDIN_URL_ERROR);
    save(url);
  };

  const startEdit = (initial: string) => {
    setValue(initial);
    setError("");
    setEditing(true);
  };

  const mode = editing ? "edit" : saved ? "saved" : found ? "confirm" : "enter";

  return (
    <section id="linkedin" className="rounded-[26px] border border-line p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0a66c2] text-[17px] font-bold text-white" aria-hidden="true">
          in
        </span>
        <div className="min-w-0 flex-1">
          {mode === "confirm" && found && (
            <>
              <AutoBadge />
              <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">Is this your LinkedIn?</h2>
              <p className="mt-1 text-[15px] text-muted">We found this LinkedIn profile in your resume:</p>
              <a
                href={found.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block max-w-full break-all rounded-xl border border-brand/25 bg-brand-soft/60 px-4 py-2.5 text-[15px] font-medium text-brand hover:underline"
              >
                {found.url}
              </a>
              <p className="mt-2 flex items-start gap-1.5 text-[13px] text-muted">
                <SparkleIcon size={12} className="mt-[3px] shrink-0 text-brand" />
                {SOURCE_NOTE[found.source]}
              </p>
              <p className="mt-4 text-[15px]">Is this correct?</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button onClick={() => save(found.url, found.source)}>Confirm</Button>
                <Button variant="secondary" onClick={() => startEdit(found.url)}>
                  Edit
                </Button>
              </div>
            </>
          )}

          {mode === "saved" && (
            <>
              {savedFrom && <AutoBadge>Auto-detected from your resume</AutoBadge>}
              <h2 className={`${savedFrom ? "mt-3 " : ""}text-[22px] font-semibold tracking-[-0.02em]`}>LinkedIn added</h2>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[15px]">
                <CheckIcon className="text-ok" />
                <span className="break-all font-medium">{saved}</span>
              </p>
              <button type="button" className="mt-3 text-sm font-medium text-brand hover:underline" onClick={() => startEdit(saved)}>
                Change
              </button>
            </>
          )}

          {(mode === "edit" || mode === "enter") && (
            <form onSubmit={submit} noValidate>
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{mode === "enter" ? "What’s your LinkedIn profile?" : "Edit your LinkedIn profile"}</h2>
              <p className="mt-1 text-[15px] text-muted">
                {mode === "enter" ? "We didn’t find a LinkedIn link in your resume. Add it so recruiters can find you." : "Paste the link to your own profile."}
              </p>
              {mode === "enter" && (
                <p className="mt-2 flex items-start gap-1.5 text-[13px] text-muted">
                  <SparkleIcon size={12} className="mt-[3px] shrink-0 text-brand" />
                  Nevora looks for your LinkedIn automatically when you upload a resume, even when it’s hidden behind a link.
                </p>
              )}
              <label htmlFor={inputId} className="mt-4 block text-sm font-medium">
                LinkedIn profile URL
              </label>
              <input
                id={inputId}
                className={`input mt-2 ${error ? "border-bad" : ""}`}
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="linkedin.com/in/your-name"
                value={value}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                autoFocus={mode === "edit"}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError("");
                }}
              />
              {error && (
                <p id={errorId} role="alert" className="mt-2 text-sm text-bad">
                  {error}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="submit">Save</Button>
                {mode === "edit" && (
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default function SetupLinkedIn() {
  const navigate = useNavigate();
  const hasLinkedIn = useApp((s) => Boolean(s.profile?.basics.links.some(isLinkedInLink)));
  const setFound = useSetup((s) => s.setFoundLinkedIn);
  const finish = () => {
    setFound(null);
    navigate("/home");
  };
  return (
    <RequireSession>
      <SetupHeader step={4} />
      <main className="mx-auto max-w-[760px] px-6 pb-24 pt-16 md:pt-[72px]">
        <p className="text-[15px] font-medium text-brand">Last step · optional</p>
        <h1 className="mt-3 text-[40px] font-semibold tight md:text-5xl">Add your LinkedIn.</h1>
        <p className="mt-3 max-w-2xl text-[17px] text-muted">It goes in your resume’s contact line, so recruiters can find your profile in one click.</p>
        <div className="mt-9">
          <LinkedInUrlCard />
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
          <Button variant="ghost" size="lg" href="/setup/review">
            Back
          </Button>
          <Button size="lg" variant={hasLinkedIn ? "primary" : "secondary"} onClick={finish}>
            {hasLinkedIn ? "Finish setup" : "Skip"}
          </Button>
        </div>
      </main>
    </RequireSession>
  );
}
