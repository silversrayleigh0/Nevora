import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckIcon, InfoIcon } from "../../components/icons";
import { AppHeader, RequireSession, SetupHeader } from "../../components/layout";
import LinkedInImport from "../../components/LinkedInImport";
import { Button, ErrorBox } from "../../components/ui";
import { insights } from "../../lib/ai";
import { useApp } from "../../store/app";
import ProfileEditor, { PROFILE_SECTIONS, sectionStatus } from "./ProfileEditor";

function ProfileBody({ setup }: { setup: boolean }) {
  const navigate = useNavigate();
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const account = useApp((s) => s.account);
  const setInsights = useApp((s) => s.setInsights);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!profile) return null;

  const attention = PROFILE_SECTIONS.filter(([key]) => sectionStatus(profile, key) === "attention").length;
  const projects = profile.projects.length;

  const finish = async () => {
    if (!profile.basics.name.trim() || !profile.basics.email.trim()) return setError("Add your name and email in Basics.");
    if (!profile.projects.length && !profile.experience.length) return setError("Add at least one project or experience.");
    if (profile.skills.length < 3) return setError("Add at least 3 skills.");
    setBusy(true);
    setError("");
    try {
      const result = await insights(profile, account?.interests);
      if (result) setInsights(result);
    } catch {
      /* insights are optional; the home page offers to try again */
    }
    setBusy(false);
    navigate("/home");
  };

  return (
    <main className="mx-auto max-w-[1080px] px-6 pb-24 pt-16 md:pt-[72px]">
      <p className="text-[15px] font-medium text-brand">{setup ? "Review" : "Your profile"}</p>
      <h1 className="mt-3 text-[40px] font-semibold tight md:text-5xl">{setup ? "Here’s what we found." : "Everything Nevora knows about you."}</h1>
      <p className="mt-3 text-[17px] text-muted">
        {setup ? "Tap anything to edit. Add what’s missing, then finish setup." : "Changes save automatically and apply to your next tailored resume."}
      </p>
      <div className="mt-6 flex items-center gap-3 rounded-2xl bg-brand-soft px-5 py-4 text-[15px] text-brand-ink">
        <InfoIcon />
        <span>
          {projects} project{projects === 1 ? "" : "s"}, {profile.skills.length} skills and {profile.certifications.length} certification
          {profile.certifications.length === 1 ? "" : "s"}.
          {attention ? ` ${attention} section${attention > 1 ? "s need" : " needs"} your attention.` : " Looking complete."}
        </span>
      </div>
      {!setup && (
        <div className="mt-6">
          <LinkedInImport returnTo="/profile" />
        </div>
      )}
      <div className="mt-9 flex items-start gap-12">
        <nav aria-label="Profile sections" className="sticky top-24 hidden w-[220px] shrink-0 flex-col gap-1 text-[15px] lg:flex">
          {PROFILE_SECTIONS.map(([key, label]) => {
            const status = sectionStatus(profile, key);
            return (
              <a key={key} href={`#${key}`} className="flex items-center justify-between rounded-xl px-3.5 py-2.5 hover:bg-surface">
                <span>{label}</span>
                {status === "done" ? (
                  <CheckIcon className="text-ok" />
                ) : status === "attention" ? (
                  <span className="h-2 w-2 rounded-full bg-warn-dot" aria-label="Needs attention" />
                ) : (
                  <span className="text-muted">—</span>
                )}
              </a>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1">
          <ProfileEditor profile={profile} onChange={setProfile} />
          {error && (
            <div className="mt-6">
              <ErrorBox message={error} />
            </div>
          )}
          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" href={setup ? "/setup/upload" : "/home"}>
              {setup ? "Back" : "Done"}
            </Button>
            <Button size="lg" loading={busy} onClick={finish}>
              {setup ? "Finish setup" : "Save and refresh insights"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function SetupReview() {
  return (
    <RequireSession>
      <SetupHeader step={3} />
      <ProfileBody setup />
    </RequireSession>
  );
}

export function ProfilePage() {
  return (
    <RequireSession>
      <AppHeader />
      <ProfileBody setup={false} />
    </RequireSession>
  );
}
