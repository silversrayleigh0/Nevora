import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Application, Match as MatchResult, Profile, Requirement, RequirementType } from "../../shared/types";
import { FlowPage } from "../components/layout";
import { Button, ErrorBox, ScoreRing, Segmented, StatusDot } from "../components/ui";
import { match as runMatch } from "../lib/ai";
import { fitLabel, potentialScore, sourceLabel, WEIGHTS } from "../lib/engine";
import { useApp } from "../store/app";

const TYPE_LABEL: Record<RequirementType, string> = { must: "Required", nice: "Good to have", soft: "Soft skill", education: "Education" };

function Requirements({ requirements, profile }: { requirements: Requirement[]; profile: Profile | null }) {
  const [filter, setFilter] = useState<"all" | "strong" | "partial" | "missing">("all");
  const shown = requirements.filter((r) => filter === "all" || r.status === filter);
  const count = (s: string) => requirements.filter((r) => r.status === s).length;
  return (
    <section className="rounded-[30px] border border-line px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">What the job asks for</h2>
        <Segmented
          label="Filter requirements"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "strong", label: `Strong ${count("strong")}` },
            { value: "partial", label: `Partial ${count("partial")}` },
            { value: "missing", label: `Missing ${count("missing")}` },
          ]}
        />
      </div>
      <ul className="mt-5">
        {shown.map((r) => {
          const sources = [...new Set(r.evidenceIds.map((id) => sourceLabel(profile, id)))];
          return (
            <li key={r.requirement} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-t border-[#EDEDF0] py-4 md:grid-cols-[220px_130px_1fr_auto]">
              <div>
                <div className="font-medium">{r.requirement}</div>
                <div className="mt-0.5 text-[13px] text-muted">{TYPE_LABEL[r.type]}</div>
              </div>
              <StatusDot status={r.status} />
              <p className="col-span-2 text-[15px] text-muted md:col-span-1">{r.note}</p>
              <div className="col-span-2 flex flex-wrap gap-1.5 md:col-span-1 md:justify-end">
                {r.status === "missing" || !sources.length ? (
                  <Link to="/new/grow" className="rounded-full bg-learn-soft px-3 py-1.5 text-sm text-learn-ink hover:bg-[#d8eff2]">
                    Learn this
                  </Link>
                ) : (
                  sources.slice(0, 2).map((s) => (
                    <span key={s} className="rounded-full bg-surface px-3 py-1.5 text-sm">
                      {s}
                    </span>
                  ))
                )}
              </div>
            </li>
          );
        })}
        {!shown.length && <li className="border-t border-[#EDEDF0] py-6 text-muted">Nothing here.</li>}
      </ul>
    </section>
  );
}

const GROUPS: { key: RequirementType; label: string }[] = [
  { key: "must", label: "Required skills" },
  { key: "nice", label: "Good to have" },
  { key: "soft", label: "Soft skills" },
  { key: "education", label: "Education" },
];

function Breakdown({ match }: { match: MatchResult }) {
  return (
    <div className="flex flex-col gap-5 rounded-[30px] border border-line p-8 md:p-10">
      <h2 className="text-[17px] font-semibold">Score breakdown</h2>
      {GROUPS.map((g) => {
        const present = match.requirements.length === 0 || match.requirements.some((r) => r.type === g.key);
        const value = match.breakdown[g.key];
        return (
          <div key={g.key} className={present ? "" : "opacity-50"}>
            <div className="flex justify-between text-[15px]">
              <span>
                {g.label} <span className="text-muted">· {Math.round(WEIGHTS[g.key] * 100)}%</span>
              </span>
              <span className="font-semibold">{present ? value : "n/a"}</span>
            </div>
            <div className="mt-2 h-2 rounded bg-[#F2F2F5]">
              <div className="h-2 rounded bg-brand transition-[width] duration-700" style={{ width: present ? `${value}%` : 0 }} />
            </div>
          </div>
        );
      })}
      <p className="text-[13px] leading-normal text-muted">
        Strong counts fully, partial counts half, missing counts zero. Groups the job doesn’t mention are left out and their weight is shared by the rest.
      </p>
    </div>
  );
}

function MatchStep({ app }: { app: Application }) {
  const navigate = useNavigate();
  const profile = useApp((s) => s.profile);
  const updateApplication = useApp((s) => s.updateApplication);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const m = app.match!;
  const jd = app.jd!;
  const gaps = m.requirements.filter((r) => r.status !== "strong" && r.type !== "soft" && r.type !== "education");
  const metMust = m.requirements.filter((r) => r.type === "must" && r.status !== "missing").length;
  const totalMust = m.requirements.filter((r) => r.type === "must").length;
  const potential = m.requirements.length ? potentialScore(m.requirements) : m.score;

  const rematch = async () => {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      updateApplication(app.id, { match: await runMatch(profile, jd), resume: null, verifications: null, plan: null });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1248px] px-6 pb-24 pt-14">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col items-center gap-9 rounded-[30px] bg-surface p-10 text-center sm:flex-row sm:text-left">
          <ScoreRing score={m.score} />
          <div>
            <p className="text-[13px] text-muted">{[jd.title, jd.company].filter(Boolean).join(" · ")}</p>
            <h1 className="mt-2 text-[40px] font-semibold tight">{fitLabel(m.score)}</h1>
            <p className="mt-2 text-[17px] leading-relaxed text-muted">
              {totalMust ? `You meet ${metMust} of ${totalMust} required skills.` : "Here’s how your profile lines up."}
              {gaps.length ? ` ${gaps.length} skill${gaps.length > 1 ? "s" : ""} would make you stronger.` : ""}
            </p>
            {potential > m.score && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm">
                <span className="text-muted">Your potential</span>
                <span className="font-semibold">
                  {m.score} → <span className="text-learn">{potential}</span>
                </span>
              </p>
            )}
          </div>
        </section>
        <Breakdown match={m} />
      </div>
      <div className="mt-6">
        {m.requirements.length ? (
          <Requirements requirements={m.requirements} profile={profile} />
        ) : (
          <div className="flex items-center justify-between rounded-[30px] border border-line p-8">
            <p className="text-muted">Requirement details weren’t saved for this resume.</p>
            <Button variant="secondary" loading={busy} onClick={rematch}>
              Match again
            </Button>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-6">
          <ErrorBox message={error} />
        </div>
      )}
      <section className="no-print mt-6 flex flex-col items-stretch gap-6 md:flex-row md:items-center">
        {gaps.length > 0 && (
          <Link to="/new/grow" className="flex flex-1 items-center justify-between rounded-[26px] bg-learn-soft px-8 py-6 hover:bg-[#d8eff2]">
            <div>
              <div className="text-[17px] font-semibold">
                {gaps.length} skill{gaps.length > 1 ? "s" : ""} to learn for this role
              </div>
              <div className="mt-1 text-[15px] text-learn-ink">
                {gaps
                  .slice(0, 3)
                  .map((g) => g.requirement)
                  .join(", ")}
                {gaps.length > 3 ? " and more" : ""}. Closing them could lift your score to {potential}.
              </div>
            </div>
            <span className="text-[15px] font-medium text-learn-ink">See plan ›</span>
          </Link>
        )}
        <Button size="lg" className={`h-14 px-9 ${gaps.length ? "" : "md:ml-auto"}`} onClick={() => navigate("/new/resume")}>
          {app.resume ? "Open my resume" : "Create my resume"}
        </Button>
      </section>
    </main>
  );
}

export default function Match() {
  return <FlowPage step="match">{(app) => <MatchStep key={app.id} app={app} />}</FlowPage>;
}
