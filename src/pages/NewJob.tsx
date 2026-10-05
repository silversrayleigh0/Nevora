import { useState } from "react";
import { useNavigate } from "react-router";
import type { Application, JDAnalysis } from "../../shared/types";
import { FlowPage } from "../components/layout";
import { Button, Chip, ErrorBox, Steps, TextField } from "../components/ui";
import { analyzeJD, match } from "../lib/ai";
import { SAMPLE_JD_TEXT } from "../lib/sample";
import { useApp } from "../store/app";


function JobStep({ app }: { app: Application }) {
  const navigate = useNavigate();
  const profile = useApp((s) => s.profile);
  const updateApplication = useApp((s) => s.updateApplication);
  const [text, setText] = useState(app.jdText);
  const [busy, setBusy] = useState<"" | "analyze" | "match">("");
  const [error, setError] = useState("");
  const jd = app.jd;
  const changed = Boolean(jd) && text.trim() !== app.jdText.trim();

  const analyze = async () => {
    setBusy("analyze");
    setError("");
    try {
      const result = await analyzeJD(text);
      const name = app.name === "Untitled resume" || !app.jd ? [result.title.trim(), result.company].filter(Boolean).join(" – ") : app.name;
      updateApplication(app.id, { jdText: text, jd: result, name, match: null, resume: null, verifications: null, plan: null, planDone: {}, coverLetter: null, interview: null });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  const seeMatch = async () => {
    if (!jd || !profile) return;
    setBusy("match");
    setError("");
    try {
      updateApplication(app.id, { match: await match(profile, jd) });
      navigate("/new/match");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  const editJD = (patch: Partial<JDAnalysis>) => jd && updateApplication(app.id, { jd: { ...jd, ...patch } });

  return (
    <main className="mx-auto max-w-[1248px] px-6 pb-24 pt-14">
      <h1 className="text-[36px] font-semibold tight md:text-[44px]">What job are you applying for?</h1>
      <p className="mt-2.5 text-[17px] text-muted">Paste the full job description. Nevora picks out what the role really asks for.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <label htmlFor="jd" className="text-sm font-medium">
            Job description
          </label>
          <textarea
            id="jd"
            value={text}
            maxLength={15000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the job description here."
            className="input min-h-[520px] rounded-[22px] p-6 text-[15px] lg:min-h-[640px]"
          />
          <div className="flex items-center justify-between text-[13px] text-muted">
            <span>{text.length.toLocaleString()} characters</span>
            <div className="flex gap-4">
              {!text && (
                <button type="button" className="text-sm text-brand" onClick={() => setText(SAMPLE_JD_TEXT)}>
                  Use a sample job
                </button>
              )}
              {text && (
                <button type="button" className="text-sm text-brand" onClick={() => setText("")}>
                  Clear
                </button>
              )}
            </div>
          </div>
          {(!jd || changed) && (
            <Button size="lg" className="mt-2 self-start" onClick={analyze} loading={busy === "analyze"} disabled={text.trim().length < 60}>
              {changed ? "Analyze again" : "Analyze job"}
            </Button>
          )}
        </div>
        <div className="self-start rounded-[26px] border border-line p-8">
          {busy === "analyze" ? (
            <Steps steps={["Reading the job description", "Separating required from nice-to-have", "Finding the key terms"]} />
          ) : jd ? (
            <div className="flex flex-col gap-6">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <TextField label="Role" value={jd.title} onChange={(e) => editJD({ title: e.target.value })} />
                <TextField label="Company" value={jd.company ?? ""} onChange={(e) => editJD({ company: e.target.value })} />
              </div>
              <div>
                <h3 className="mb-2.5 text-sm font-semibold">Required</h3>
                <div className="flex flex-wrap gap-2">
                  {jd.mustHave.length ? (
                    jd.mustHave.map((s) => (
                      <Chip key={s.skill} tone="solid">
                        {s.skill}
                      </Chip>
                    ))
                  ) : (
                    <span className="text-sm text-muted">None found</span>
                  )}
                </div>
              </div>
              {jd.niceToHave.length > 0 && (
                <div>
                  <h3 className="mb-2.5 text-sm font-semibold">Good to have</h3>
                  <div className="flex flex-wrap gap-2">
                    {jd.niceToHave.map((s) => (
                      <Chip key={s.skill}>{s.skill}</Chip>
                    ))}
                  </div>
                </div>
              )}
              {jd.softSkills.length > 0 && (
                <div>
                  <h3 className="mb-2.5 text-sm font-semibold">Soft skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {jd.softSkills.map((s) => (
                      <Chip key={s}>{s}</Chip>
                    ))}
                  </div>
                </div>
              )}
              {jd.responsibilities.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">What you’ll do</h3>
                  <ul className="flex flex-col gap-1 text-[15px]">
                    {jd.responsibilities.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="h-px bg-[#EDEDF0]" />
              <TextField label="Name this resume" value={app.name} onChange={(e) => updateApplication(app.id, { name: e.target.value })} />
              <Button size="lg" className="w-full" onClick={seeMatch} loading={busy === "match"} disabled={changed}>
                {busy === "match" ? "Matching your profile" : "See my match"}
              </Button>
            </div>
          ) : (
            <div className="py-10 text-center">
              <h2 className="text-xl font-semibold">What recruiters look for</h2>
              <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted">After you analyze the job, you’ll see its required skills, nice-to-haves and responsibilities here.</p>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-6">
          <ErrorBox message={error} onRetry={jd && !changed ? seeMatch : analyze} />
        </div>
      )}
    </main>
  );
}

export default function NewJob() {
  return <FlowPage step="jd">{(app) => <JobStep key={app.id} app={app} />}</FlowPage>;
}
