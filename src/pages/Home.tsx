import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Application } from "../../shared/types";
import { AppHeader, RequireSession } from "../components/layout";
import { Button, EmptyState, ScoreRing, scoreDot } from "../components/ui";
import { aiOffMessage, insights as fetchInsights } from "../lib/ai";
import { profileStrength } from "../lib/engine";
import { useApp } from "../store/app";
import { toast } from "../store/toast";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

function edited(ts: number) {
  const days = Math.floor((Date.now() - ts) / 864e5);
  if (days <= 0) return "Edited today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const stepFor = (a: Application) => (a.resume ? "/new/resume" : a.match ? "/new/match" : "/new/jd");

function NextStep() {
  const navigate = useNavigate();
  const profile = useApp((s) => s.profile);
  const applications = useApp((s) => s.applications);
  const setActive = useApp((s) => s.setActive);
  const newApplication = useApp((s) => s.newApplication);
  const open = (id: string, to: string) => {
    setActive(id);
    navigate(to);
  };
  const flagged = applications.find((a) => a.resume && a.verifications?.some((v) => !v.supported));
  const inPlan = applications.find(
    (a) => a.plan?.length && a.plan.reduce((n, g) => n + g.steps.length, 0) > Object.values(a.planDone).filter(Boolean).length,
  );
  const tip = profileStrength(profile).tips[0];

  let title: string, body: string, label: string, run: () => void;
  if (!applications.length) {
    title = "Tailor your first resume";
    body = "Paste any job description. It takes about a minute.";
    label = "Start";
    run = () => {
      newApplication();
      navigate("/new/jd");
    };
  } else if (flagged) {
    const n = flagged.verifications!.filter((v) => !v.supported).length;
    title = `Fix ${n} flagged line${n > 1 ? "s" : ""} in “${flagged.name}”`;
    body = "Download stays locked until every line is backed by your profile.";
    label = "Review";
    run = () => open(flagged.id, "/new/resume");
  } else if (inPlan) {
    const gi = inPlan.plan!.findIndex((g, i) => g.steps.some((_, j) => !inPlan.planDone[`${i}-${j}`]));
    const gap = inPlan.plan![gi];
    const done = gap.steps.filter((_, j) => inPlan.planDone[`${gi}-${j}`]).length;
    title = `Keep going with ${gap.skill}`;
    body = `${done} of ${gap.steps.length} steps done for “${inPlan.name}”.`;
    label = "Continue";
    run = () => open(inPlan.id, "/new/grow");
  } else if (tip) {
    title = tip;
    body = "Small fixes to your profile improve every resume you make.";
    label = "Fix it";
    run = () => navigate("/profile");
  } else return null;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-brand-soft px-6 py-5">
      <div>
        <p className="text-xs font-semibold tracking-[0.08em] text-brand-ink">NEXT BEST STEP</p>
        <p className="mt-1 text-[17px] font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-brand-ink">{body}</p>
      </div>
      <Button onClick={run}>{label}</Button>
    </div>
  );
}

function ResumeCard({ app }: { app: Application }) {
  const navigate = useNavigate();
  const setActive = useApp((s) => s.setActive);
  const updateApplication = useApp((s) => s.updateApplication);
  const duplicateApplication = useApp((s) => s.duplicateApplication);
  const deleteApplication = useApp((s) => s.deleteApplication);
  const restoreApplication = useApp((s) => s.restoreApplication);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState(app.name);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const open = () => {
    setActive(app.id);
    navigate(stepFor(app));
  };
  const commit = () => {
    const next = name.trim() || app.name;
    if (next !== app.name) {
      updateApplication(app.id, { name: next });
      toast("Renamed");
    }
    setRenaming(false);
  };

  return (
    <div className="relative flex flex-col gap-5 rounded-[24px] border border-line p-6 transition hover:border-hair">
      <div className="flex items-start justify-between gap-3">
        {renaming ? (
          <div className="flex-1">
            <label htmlFor={`rn-${app.id}`} className="sr-only">
              Resume name
            </label>
            <input
              id={`rn-${app.id}`}
              autoFocus
              className="input h-11 text-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setRenaming(false);
              }}
            />
          </div>
        ) : (
          <button type="button" onClick={open} className="min-w-0 text-left">
            <div className="text-lg font-semibold tracking-[-0.01em]">{app.name}</div>
            <div className="mt-1 text-sm text-muted">{app.jd?.title ?? "Job not added yet"}</div>
          </button>
        )}
        <div ref={ref} className="relative">
          <button
            type="button"
            aria-label={`More options for ${app.name}`}
            aria-expanded={menu}
            onClick={() => {
              setMenu(!menu);
              setConfirm(false);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface hover:bg-line"
          >
            …
          </button>
          {menu && (
            <div className="absolute right-0 top-10 z-20 w-44 rounded-2xl border border-line bg-white p-1.5 text-sm shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
              {(
                [
                  ["Open", open],
                  [
                    "Rename",
                    () => {
                      setName(app.name);
                      setRenaming(true);
                      setMenu(false);
                    },
                  ],
                  [
                    "Duplicate",
                    () => {
                      duplicateApplication(app.id);
                      setMenu(false);
                      toast(`Duplicated “${app.name}”`);
                    },
                  ],
                ] as const
              ).map(([label, run]) => (
                <button key={label} type="button" onClick={run} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-surface">
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-bad hover:bg-bad-soft"
                onClick={() => {
                  if (!confirm) return setConfirm(true);
                  const copy = structuredClone(app);
                  deleteApplication(app.id);
                  toast(`Deleted “${app.name}”`, { label: "Undo", run: () => restoreApplication(copy) });
                }}
              >
                {confirm ? "Tap again to delete" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[13px] text-muted">{edited(app.updatedAt)}</span>
        {app.match ? (
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${scoreDot(app.match.score)}`} aria-hidden="true" />
            Match {app.match.score}
          </span>
        ) : (
          <span className="text-muted">Draft</span>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const account = useApp((s) => s.account);
  const profile = useApp((s) => s.profile);
  const insights = useApp((s) => s.insights);
  const setInsights = useApp((s) => s.setInsights);
  const applications = useApp((s) => s.applications);
  const newApplication = useApp((s) => s.newApplication);
  const [search, setSearch] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const strength = profileStrength(profile);
  const firstName = (account?.name || profile?.basics.name || "there").split(" ")[0];
  const list = useMemo(
    () => applications.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt),
    [applications, search],
  );

  const startNew = () => {
    newApplication();
    navigate("/new/jd");
  };
  const analyze = async () => {
    if (!profile) return;
    setAnalyzing(true);
    try {
      const result = await fetchInsights(profile, account?.interests);
      if (result) setInsights(result);
      else toast(`${aiOffMessage()}, so strengths can’t be analyzed yet.`);
    } catch (err) {
      toast((err as Error).message);
    }
    setAnalyzing(false);
  };

  return (
    <main className="mx-auto max-w-[1248px] px-6 pb-24 pt-16">
      <h1 className="text-[40px] font-semibold tight md:text-5xl">
        {greeting()}, {firstName}.
      </h1>
      <p className="mt-2.5 text-[17px] text-muted">
        Your profile is {strength.score}% strong.
        {strength.tips.length ? ` ${strength.tips.length === 1 ? "One quick fix" : `${strength.tips.length} quick fixes`} would make it stronger.` : ""}
      </p>
      <NextStep />
      <section className="mt-5 flex flex-col items-start justify-between gap-8 rounded-[30px] bg-surface px-8 py-12 md:flex-row md:items-center md:px-14">
        <div className="max-w-[560px]">
          <h2 className="text-[34px] font-semibold leading-tight tracking-[-0.03em]">Tailor your resume for a new job.</h2>
          <p className="mb-7 mt-2.5 text-[17px] leading-relaxed text-muted">Paste a job description. Nevora matches your profile to it and builds a resume you can trust.</p>
          <Button size="lg" onClick={startNew}>
            New tailored resume
          </Button>
        </div>
        <div className="relative hidden h-[200px] w-[300px] md:block" aria-hidden="true">
          <div className="absolute left-[60px] top-0 h-[190px] w-[200px] rotate-6 rounded-[14px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]" />
          <div className="absolute left-[30px] top-2.5 flex h-[190px] w-[200px] flex-col gap-2.5 rounded-[14px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            <div className="h-2.5 w-3/5 rounded bg-ink" />
            <div className="h-1.5 w-4/5 rounded bg-[#E5E5EA]" />
            <div className="mt-2 h-1.5 w-2/5 rounded bg-[#D9CCFB]" />
            <div className="h-1.5 w-[90%] rounded bg-[#E5E5EA]" />
            <div className="h-1.5 w-[85%] rounded bg-[#E5E5EA]" />
            <div className="mt-2 h-1.5 w-2/5 rounded bg-[#D9CCFB]" />
            <div className="h-1.5 w-[70%] rounded bg-[#E5E5EA]" />
          </div>
        </div>
      </section>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="flex flex-col gap-4 rounded-[26px] border border-line p-7">
          <h2 className="text-[15px] font-semibold">Profile strength</h2>
          <div className="flex items-center gap-5">
            <ScoreRing score={strength.score} size={88} stroke={8} />
            <p className="text-[15px] leading-snug text-muted">
              {strength.score >= 80 ? "Recruiter-ready. Keep adding impact." : strength.score >= 60 ? "Solid start. A few fixes will help." : "Let’s build this up."}
            </p>
          </div>
          <div className="flex flex-col gap-2.5 text-sm">
            {strength.tips.map((t) => (
              <Link key={t} to="/profile" className="flex justify-between hover:text-brand">
                <span>{t}</span>
                <span className="text-brand">›</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-5 rounded-[26px] border border-line p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Your strengths</h2>
            {!insights && (
              <Button variant="ghost" size="sm" loading={analyzing} onClick={analyze}>
                Analyze
              </Button>
            )}
          </div>
          {insights?.strengths.length ? (
            insights.strengths.map((s) => (
              <div key={s.area}>
                <div className="flex justify-between text-sm">
                  <span>{s.area}</span>
                  <span className="text-muted">{s.level}</span>
                </div>
                <div className="mt-2 h-1.5 rounded bg-[#F2F2F5]">
                  <div className="h-1.5 rounded bg-ink" style={{ width: `${s.score}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">See which areas your projects prove best.</p>
          )}
        </section>
        <section className="flex flex-col gap-3.5 rounded-[26px] border border-line p-7">
          <h2 className="text-[15px] font-semibold">Roles you already fit</h2>
          {insights?.roles.length ? (
            insights.roles.map((r) => (
              <div key={r.title} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3.5 text-[15px]">
                <span>{r.title}</span>
                <span className="font-semibold">{r.fit}%</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">Analyze your profile to see suggested roles.</p>
          )}
        </section>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4">
        {(
          [
            ["Projects", profile?.projects.length],
            ["Skills", profile?.skills.length],
            ["Certifications", profile?.certifications.length],
            ["Internships", profile?.experience.length],
          ] as const
        ).map(([label, n]) => (
          <Link key={label} to="/profile" className="rounded-[22px] bg-surface px-6 py-6 hover:bg-line">
            <div className="text-[34px] font-semibold tracking-[-0.03em]">{n ?? 0}</div>
            <div className="mt-0.5 text-sm text-muted">{label}</div>
          </Link>
        ))}
      </div>
      <section id="resumes" className="mt-16 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[28px] font-semibold tracking-[-0.02em]">My resumes</h2>
          {applications.length > 3 && (
            <div>
              <label htmlFor="search" className="sr-only">
                Search resumes
              </label>
              <input id="search" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="input h-10 w-64 rounded-full text-[15px]" />
            </div>
          )}
        </div>
        <div className="mt-5">
          {list.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((a) => (
                <ResumeCard key={a.id} app={a} />
              ))}
            </div>
          ) : applications.length ? (
            <p className="text-muted">No resumes match “{search}”.</p>
          ) : (
            <EmptyState title="No tailored resumes yet" body="Paste a job description and Nevora will build your first one." action={<Button onClick={startNew}>New tailored resume</Button>} />
          )}
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <RequireSession>
      <AppHeader />
      <Dashboard />
    </RequireSession>
  );
}
