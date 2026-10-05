import { useNavigate } from "react-router";
import LinkedInImport from "../components/LinkedInImport";
import { RequireSession, SetupHeader } from "../components/layout";
import { Button } from "../components/ui";
import { useApp } from "../store/app";

/** Last setup step: optionally fill gaps in the profile from the LinkedIn PDF export. */
export default function SetupLinkedIn() {
  const navigate = useNavigate();
  const imported = useApp((s) => Boolean(s.account?.linkedin?.imported));
  return (
    <RequireSession>
      <SetupHeader step={4} />
      <main className="mx-auto max-w-[920px] px-6 pb-24 pt-16 md:pt-[72px]">
        <p className="text-[15px] font-medium text-brand">Last step · optional</p>
        <h1 className="mt-3 text-[40px] font-semibold tight md:text-5xl">Anything on LinkedIn we missed?</h1>
        <p className="mt-3 max-w-2xl text-[17px] text-muted">
          Your LinkedIn often lists skills, roles and certifications that never made it onto your resume. Upload your LinkedIn PDF and add them in one tap.
        </p>
        <div className="mt-9">
          <LinkedInImport showGuide />
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
          <Button variant="ghost" size="lg" href="/setup/review">
            Back
          </Button>
          <Button size="lg" onClick={() => navigate("/home")}>
            {imported ? "Finish setup" : "Skip and finish"}
          </Button>
        </div>
      </main>
    </RequireSession>
  );
}
