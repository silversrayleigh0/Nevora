import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import type { Application, BulletCoaching, Course, CourseSearch, Gap } from "../../shared/types";
import { CheckIcon } from "../components/icons";
import { FlowPage } from "../components/layout";
import { Button, ErrorBox, Placeholders, Steps } from "../components/ui";
import { coachBullet, findCourses, interviewPrep, learningPlan } from "../lib/ai";
import { pointsFor, potentialScore, sourceLabel } from "../lib/engine";
import { useApp } from "../store/app";
import { toast } from "../store/toast";

const PRIORITY = { high: "High priority", medium: "Medium", low: "Low" };

function GapCard({
  gap,
  index,
  open,
  done,
  gain,
  onToggleOpen,
  onToggleStep,
  children,
}: {
  gap: Gap;
  index: number;
  open: boolean;
  done: Record<string, boolean>;
  gain?: number;
  onToggleOpen: () => void;
  onToggleStep: (key: string) => void;
  children?: ReactNode;
}) {
  const finished = gap.steps.filter((_, i) => done[`${index}-${i}`]).length;
  return (
    <section className="overflow-hidden rounded-[26px] border border-line">
      <button type="button" onClick={onToggleOpen} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-6 py-6 text-left md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[22px] font-semibold tracking-[-0.02em]">{gap.skill}</span>
          <span className={`rounded-full px-3 py-1 text-[13px] ${gap.priority === "high" ? "bg-learn text-white" : "bg-learn-soft text-learn-ink"}`}>{PRIORITY[gap.priority]}</span>
          {gain ? <span className="rounded-full bg-surface px-3 py-1 text-[13px] font-medium">+{gain} match points</span> : null}
          {finished === gap.steps.length && <span className="rounded-full bg-ok-soft px-3 py-1 text-[13px] text-ok">Done</span>}
        </div>
        <div className="flex items-center gap-5 text-sm text-muted">
          <span className="hidden sm:inline">{gap.timeEstimate}</span>
          <span>
            {finished} of {gap.steps.length} done
          </span>
          <span className="text-lg text-ink" aria-hidden="true">
            {open ? "−" : "+"}
          </span>
        </div>
      </button>
      {open && (
        <div className="grid gap-7 px-6 pb-7 md:grid-cols-[1.3fr_1fr] md:px-8">
          <div className="flex flex-col gap-3.5">
            <p className="text-[15px] leading-relaxed text-muted">{gap.why}</p>
            {gap.steps.map((step, i) => {
              const key = `${index}-${i}`;
              const checked = Boolean(done[key]);
              return (
                <button key={key} type="button" role="checkbox" aria-checked={checked} onClick={() => onToggleStep(key)} className="flex items-center gap-3 text-left text-base">
                  <span
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-learn ${checked ? "bg-learn text-white" : "bg-white"}`}
                  >
                    {checked && <CheckIcon size={12} />}
                  </span>
                  <span className={checked ? "text-muted line-through" : ""}>{step}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-[18px] bg-surface p-5">
              <p className="text-[13px] text-muted">Free resources</p>
              <ul className="mt-1.5 flex flex-col gap-1 text-[15px]">
                {gap.resources.map((r) => (
                  <li key={r.title}>{r.title}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-[18px] bg-learn-soft p-5">
              <p className="text-[13px] text-learn-ink">Prove it with a mini-project</p>
              <p className="mt-1.5 text-[15px] font-medium leading-normal">{gap.miniProject}</p>
            </div>
          </div>
          {children && <div className="md:col-span-2">{children}</div>}
        </div>
      )}
    </section>
  );
}

const courseKey = (skill: string) => skill.trim().toLowerCase();

function CourseRow({ course }: { course: Course }) {
  const account = useApp((s) => s.account);
  const setAccount = useApp((s) => s.setAccount);
  const saved = Boolean(account?.savedCourses?.some((c) => c.url === course.url));
  const toggle = () => {
    if (!account) return;
    const list = account.savedCourses ?? [];
    setAccount({ ...account, savedCourses: saved ? list.filter((c) => c.url !== course.url) : [course, ...list].slice(0, 50) });
    toast(saved ? "Removed from saved courses" : "Course saved");
  };
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug">{course.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
          <span>{course.provider || new URL(course.url).hostname.replace(/^www\./, "")}</span>
          {course.free === true && <span className="rounded-full bg-ok-soft px-2 text-[12px] text-ok">Free</span>}
          {course.free === false && <span>Paid</span>}
          {course.level && <span className="capitalize">· {course.level}</span>}
          {course.duration && <span>· {course.duration}</span>}
        </p>
        {course.why && <p className="mt-1 text-[13px] leading-snug text-muted">{course.why}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <a
          href={course.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-full border border-hair bg-white px-4 text-sm font-medium hover:bg-surface"
          aria-label={`Open ${course.title} (opens in a new tab)`}
        >
          Open ↗
        </a>
        <button
          type="button"
          aria-pressed={saved}
          onClick={toggle}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium ${saved ? "bg-learn text-white" : "bg-learn-soft text-learn-ink hover:bg-line"}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${course.title}`}
        >
          {saved && <CheckIcon size={12} />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </li>
  );
}

function Courses({ found, skill, busy, error, onSearch }: { found?: CourseSearch; skill: string; busy: boolean; error: string; onSearch: () => void }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold">Courses to learn {skill}</p>
          <p className="text-[13px] text-muted">
            {found?.source === "web"
              ? `Found on the web ${new Date(found.searchedAt).toLocaleDateString()}. Check the price and dates on each site.`
              : found?.source === "search"
                ? "Live course search isn’t available right now, so here are searches on major course sites."
                : "Current courses that teach this skill."}
          </p>
        </div>
        {!busy && (
          <Button variant={found ? "ghost" : "learn"} size="sm" onClick={onSearch}>
            {found ? "Search again" : "Find courses"}
          </Button>
        )}
      </div>
      {busy && <Steps steps={["Searching course sites", "Checking level and price", "Keeping only real course pages"]} />}
      {error && !busy && <ErrorBox message={error} onRetry={onSearch} />}
      {found && !busy && (
        <ul className="flex flex-col gap-2">
          {found.courses.map((c) => (
            <CourseRow key={c.id} course={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SavedCourses() {
  const saved = useApp((s) => s.account?.savedCourses);
  if (!saved?.length) return null;
  return (
    <section className="rounded-[30px] border border-line p-7 md:p-10">
      <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Saved courses</h2>
      <p className="mt-1 text-[15px] text-muted">Kept on your account, across every resume.</p>
      <ul className="mt-5 flex flex-col gap-2">
        {saved.map((c) => (
          <CourseRow key={c.url} course={c} />
        ))}
      </ul>
    </section>
  );
}

const STAR = [
  ["situation", "Situation"],
  ["task", "Task"],
  ["action", "Action"],
  ["result", "Result"],
] as const;

function InterviewPrep({ app }: { app: Application }) {
  const profile = useApp((s) => s.profile);
  const updateApplication = useApp((s) => s.updateApplication);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(0);
  const questions = app.interview ?? null;

  const prepare = async () => {
    if (!profile || !app.jd) return;
    setBusy(true);
    setError("");
    try {
      updateApplication(app.id, { interview: await interviewPrep(profile, app.jd, app.match, app.plan) });
      setOpen(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[30px] border border-line p-7 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Interview prep</h2>
          <p className="mt-1 max-w-xl text-[15px] text-muted">Five questions this interviewer is likely to ask, each with a STAR answer built from your own projects.</p>
        </div>
        <Button variant={questions ? "secondary" : "learn"} loading={busy} onClick={prepare}>
          {questions ? "New questions" : "Prepare me"}
        </Button>
      </div>
      {busy && (
        <div className="mt-6">
          <Steps steps={["Reading what the role tests", "Matching questions to your projects", "Outlining your answers"]} />
        </div>
      )}
      {error && (
        <div className="mt-6">
          <ErrorBox message={error} onRetry={prepare} />
        </div>
      )}
      {questions && !busy && (
        <ol className="mt-6 flex flex-col gap-2.5">
          {questions.map((q, i) => (
            <li key={q.question} className="overflow-hidden rounded-2xl bg-surface">
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left">
                <span className="flex gap-3">
                  <span className="text-muted">{i + 1}.</span>
                  <span className="font-medium">{q.question}</span>
                </span>
                <span className="text-lg" aria-hidden="true">
                  {open === i ? "−" : "+"}
                </span>
              </button>
              {open === i && (
                <div className="flex flex-col gap-4 px-5 pb-5">
                  <p className="text-sm text-muted">
                    <b className="font-medium text-ink">What they’re checking:</b> {q.why}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {STAR.map(([key, label]) => (
                      <div key={key} className="rounded-xl bg-white p-4">
                        <p className="text-xs font-semibold tracking-[0.06em] text-learn-ink">{label.toUpperCase()}</p>
                        <p className="mt-1 text-[15px] leading-normal">
                          <Placeholders text={q.story[key]} />
                        </p>
                      </div>
                    ))}
                  </div>
                  {q.sourceIds.length > 0 && <p className="text-xs text-muted">Built from: {[...new Set(q.sourceIds.map((id) => sourceLabel(profile, id)))].join(", ")}</p>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function BulletCoach() {
  const [line, setLine] = useState("Worked on the frontend of a web app.");
  const [result, setResult] = useState<BulletCoaching | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const coach = async () => {
    if (!line.trim()) return setError("Paste a line from your resume first.");
    setBusy(true);
    setError("");
    try {
      setResult(await coachBullet(line));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="grid gap-7 rounded-[30px] bg-surface p-7 md:grid-cols-2 md:p-10">
      <div className="flex flex-col gap-3">
        <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Bullet coach</h2>
        <p className="text-[15px] text-muted">Paste a line from your resume. Learn how to make it stronger.</p>
        <label htmlFor="coach-line" className="mt-2 text-sm font-medium">
          Your line
        </label>
        <textarea id="coach-line" rows={4} maxLength={600} value={line} onChange={(e) => setLine(e.target.value)} className="input bg-white" />
        <Button variant="learn" className="self-start" loading={busy} onClick={coach}>
          Coach me
        </Button>
        {error && <ErrorBox message={error} />}
      </div>
      <div className="flex flex-col gap-3.5 rounded-[22px] bg-white p-6" aria-live="polite">
        {result ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold">Strength</span>
              <span className="flex gap-1.5" role="img" aria-label={`${result.score} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`h-1.5 w-[22px] rounded ${n <= result.score ? "bg-learn" : "bg-[#E5E5EA]"}`} />
                ))}
              </span>
            </div>
            {result.missing.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.missing.map((m) => (
                  <span key={m} className="rounded-full bg-warn-soft px-3 py-1 text-[13px] text-warn">
                    Missing {m.toLowerCase()}
                  </span>
                ))}
              </div>
            )}
            <div>
              <p className="text-[13px] text-muted">A stronger version</p>
              <p className="mt-1 text-base font-medium leading-normal">
                <Placeholders text={result.improved} />
              </p>
            </div>
            <p className="rounded-[14px] bg-learn-soft p-4 text-sm leading-normal text-learn-hover">
              <b>Tip:</b> {result.tip}
            </p>
          </>
        ) : (
          <p className="m-auto max-w-xs text-center text-[15px] text-muted">Your feedback appears here: a strength score, what’s missing and a stronger version.</p>
        )}
      </div>
    </section>
  );
}

function GrowStep({ app }: { app: Application }) {
  const profile = useApp((s) => s.profile);
  const updateApplication = useApp((s) => s.updateApplication);
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  const build = useCallback(async () => {
    if (!profile || !app.jd) return;
    const gaps = (app.match?.requirements ?? []).filter((r) => r.status !== "strong" && r.type !== "education" && r.type !== "soft");
    setBusy(true);
    setError("");
    try {
      updateApplication(app.id, { plan: await learningPlan(profile, app.jd, gaps) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [app.id, app.jd, app.match, profile, updateApplication]);

  useEffect(() => {
    if (started.current || app.plan) return;
    started.current = true;
    void build();
  }, [app.plan, build]);

  const plan = app.plan ?? [];
  const totalSteps = plan.reduce((n, g) => n + g.steps.length, 0);
  const doneSteps = Object.values(app.planDone).filter(Boolean).length;
  const requirements = app.match?.requirements ?? [];
  const current = app.match?.score ?? 0;
  const forecast = requirements.length && plan.length ? potentialScore(requirements, plan.map((g) => g.skill)) : current;
  // Courses for every gap come from ONE web-search call, made once per resume and cached.
  const [coursesBusy, setCoursesBusy] = useState<string[]>([]);
  const [coursesError, setCoursesError] = useState("");
  const loadCourses = useCallback(
    async (skills: string[]) => {
      if (!skills.length) return;
      setCoursesBusy(skills.map(courseKey));
      setCoursesError("");
      try {
        const result = await findCourses(skills, app.jd?.title ?? "");
        const latest = useApp.getState().applications.find((a) => a.id === app.id);
        updateApplication(app.id, { courses: { ...(latest?.courses ?? {}), ...result } });
      } catch (err) {
        setCoursesError((err as Error).message);
      } finally {
        setCoursesBusy([]);
      }
    },
    [app.id, app.jd?.title, updateApplication],
  );
  const coursesStarted = useRef(false);
  useEffect(() => {
    if (coursesStarted.current || !app.plan?.length) return;
    const missing = app.plan.map((g) => g.skill).filter((skill) => !app.courses?.[courseKey(skill)]);
    coursesStarted.current = true;
    void loadCourses(missing);
  }, [app.plan, app.courses, loadCourses]);


  return (
    <main className="mx-auto max-w-[1000px] px-6 pb-24 pt-16">
      <p className="text-[15px] font-medium text-learn">Your growth plan</p>
      <h1 className="mt-2.5 text-[38px] font-semibold tight md:text-5xl">Close the gaps for {app.jd?.title ?? "this role"}.</h1>
      <p className="mt-2.5 text-[17px] text-muted">
        {plan.length
          ? `${plan.length} skill${plan.length > 1 ? "s" : ""} would make you a stronger fit. Start with the highest priority.`
          : busy
            ? "Building a plan from your gaps…"
            : "You already cover what this job asks for."}
      </p>
      {forecast > current && (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[22px] bg-learn-soft px-6 py-5">
          <div className="flex items-baseline gap-2">
            <span className="text-[34px] font-semibold tracking-[-0.03em]">{current}</span>
            <span className="text-xl text-learn-ink">→</span>
            <span className="text-[34px] font-semibold tracking-[-0.03em] text-learn">{forecast}</span>
          </div>
          <p className="text-[15px] text-learn-ink">Your match score if you finish this plan and add the new work to your profile.</p>
        </div>
      )}
      {totalSteps > 0 && (
        <div className="mt-5 flex items-center gap-4">
          <div className="h-2 flex-1 rounded bg-learn-soft" role="progressbar" aria-valuenow={doneSteps} aria-valuemin={0} aria-valuemax={totalSteps} aria-label="Plan progress">
            <div className="h-2 rounded bg-learn transition-[width]" style={{ width: `${Math.round((doneSteps / totalSteps) * 100)}%` }} />
          </div>
          <span className="text-sm font-medium text-learn-ink">
            {doneSteps} of {totalSteps} steps done
          </span>
        </div>
      )}
      <h2 className="mt-12 text-[28px] font-semibold tracking-[-0.02em]">Skill gaps</h2>
      <div className="mt-4 flex flex-col gap-3.5">
        {busy && (
          <div className="rounded-[26px] border border-line p-8">
            <Steps steps={["Looking at your gaps", "Finding free resources", "Designing mini-projects"]} />
          </div>
        )}
        {error && <ErrorBox message={error} onRetry={build} />}
        {plan.map((gap, i) => (
          <GapCard
            key={gap.skill}
            gap={gap}
            index={i}
            open={Boolean(open[i])}
            done={app.planDone}
            gain={requirements.length ? pointsFor(requirements, gap.skill) : undefined}
            onToggleOpen={() => setOpen({ ...open, [i]: !open[i] })}
            onToggleStep={(key) => updateApplication(app.id, { planDone: { ...app.planDone, [key]: !app.planDone[key] } })}
          >
            <Courses
              skill={gap.skill}
              found={app.courses?.[courseKey(gap.skill)]}
              busy={coursesBusy.includes(courseKey(gap.skill))}
              error={coursesError}
              onSearch={() => void loadCourses([gap.skill])}
            />
          </GapCard>
        ))}
      </div>
      <div className="mt-6">
        <SavedCourses />
      </div>
      <div className="mt-12">
        <InterviewPrep app={app} />
      </div>
      <div className="mt-6">
        <BulletCoach />
      </div>
      <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
        <Link to="/profile" className="text-base text-learn hover:text-learn-hover">
          Learned something new? Update your profile ›
        </Link>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" size="lg" href="/home">
            Home
          </Button>
          <Button variant="dark" size="lg" href={app.resume ? "/new/resume" : "/new/match"}>
            {app.resume ? "Back to my resume" : "Back to my match"}
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function Grow() {
  return <FlowPage step="grow">{(app) => <GrowStep key={app.id} app={app} />}</FlowPage>;
}
