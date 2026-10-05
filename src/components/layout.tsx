import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { Application } from "../../shared/types";
import { useAiMode } from "../lib/ai";
import { retryLoad, signOut } from "../lib/session";
import { isSignedIn, useActiveApplication, useApp } from "../store/app";
import { useTheme } from "../store/theme";
import { useToasts, type Toast } from "../store/toast";
import { Spinner } from "./icons";
import { Button } from "./ui";

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Nevora home">
      <img src="/nevora-mark.png" alt="" width={30} height={27} decoding="async" />
      <img src="/nevora-wordmark.png" alt="Nevora" width={96} height={13} decoding="async" className="wordmark h-[13px] w-auto" />
    </Link>
  );
}

export function Mark({ size = 84 }: { size?: number }) {
  return <img src="/nevora-mark.png" alt="" width={size} height={Math.round(size * 0.91)} decoding="async" />;
}

const AI_STATUS = {
  live: { label: "Live AI is on", dot: "bg-ok-dot" },
  basic: { label: "Live AI is off — everything still works with simpler answers", dot: "bg-warn-dot" },
};

/** A small pulsing dot instead of a text badge; hover or focus explains it. */
export function StatusDot({ mode }: { mode: keyof typeof AI_STATUS }) {
  const s = AI_STATUS[mode];
  return (
    <span tabIndex={0} title={s.label} className="flex h-6 w-6 items-center justify-center rounded-full outline-none" role="img" aria-label={s.label}>
      <span className={`pulse-dot h-2 w-2 rounded-full ${s.dot}`} />
    </span>
  );
}

export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/** Top bar for signed-in pages. `center` replaces the nav (used by the 4-step flow). */
export function AppHeader({ center }: { center?: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const account = useApp((s) => s.account);
  const newApplication = useApp((s) => s.newApplication);
  const mode = useAiMode();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = (account?.name || account?.email || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const startNew = () => {
    newApplication();
    navigate("/new/jd");
  };
  const links = [
    { to: "/home", label: "Home" },
    { to: "/home#resumes", label: "My resumes" },
    { to: "/profile", label: "Profile" },
  ];

  const sync = useApp((s) => s.sync);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur-xl">
      {sync === "device" && (
        <div className="flex items-center justify-center gap-3 bg-warn-soft px-4 py-2 text-center text-[13px] text-warn" role="status">
          <span>Cloud sync is unavailable right now. Your work is saved on this device and will sync later.</span>
          <button type="button" onClick={retryLoad} className="font-semibold underline-offset-2 hover:underline">
            Retry
          </button>
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-[1344px] items-center justify-between gap-6 px-6 md:px-12">
        <div className="flex items-center gap-11">
          <Logo to="/home" />
          {!center && (
            <nav className="hidden gap-7 text-sm md:flex">
              {links.map((l) => (
                <Link key={l.label} to={l.to} className={pathname === l.to ? "font-semibold text-ink" : "text-muted hover:text-ink"}>
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        {center}
        <div ref={menu} className="relative flex items-center gap-3 md:gap-4">
          {mode && <StatusDot mode={mode} />}
          <ThemeToggle />
          {!center && (
            <Button size="sm" onClick={startNew} className="hidden sm:inline-flex">
              New resume
            </Button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Account menu"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-ink"
          >
            {initials}
          </button>
          {open && (
            <div className="frost-panel rise-fast absolute right-0 top-12 w-64 rounded-2xl p-2">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-ink">{initials}</span>
                <div className="min-w-0 text-sm">
                  <div className="truncate font-medium">{account?.name || "Your account"}</div>
                  <div className="truncate text-muted">{account?.email}</div>
                </div>
              </div>
              <div className="my-1 h-px bg-line" />
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    startNew();
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-brand hover:bg-surface"
                >
                  New resume
                </button>
                {links.map((l) => (
                  <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-surface">
                    {l.label}
                  </Link>
                ))}
                <div className="my-1 h-px bg-line" />
              </div>
              <Link to="/profile" onClick={() => setOpen(false)} className="hidden rounded-xl px-3 py-2 text-sm hover:bg-surface md:block">
                Edit profile
              </Link>

              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await signOut();
                  navigate("/");
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-surface"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export type FlowStep = "jd" | "match" | "resume" | "grow";
const FLOW: { key: FlowStep; label: string; to: string }[] = [
  { key: "jd", label: "Job", to: "/new/jd" },
  { key: "match", label: "Match", to: "/new/match" },
  { key: "resume", label: "Resume", to: "/new/resume" },
  { key: "grow", label: "Grow", to: "/new/grow" },
];

function FlowSteps({ current, reached }: { current: FlowStep; reached: number }) {
  const index = FLOW.findIndex((s) => s.key === current);
  return (
    <>
      <span className="whitespace-nowrap text-sm text-muted md:hidden">
        Step {index + 1}/4 · <span className="font-medium text-ink">{FLOW[index].label}</span>
      </span>
      <nav aria-label="Progress" className="hidden items-center gap-1.5 text-sm md:flex">
        {FLOW.map((s, i) => {
          const isCurrent = i === index;
          const done = i < index || (i !== index && i < reached);
          const cls = isCurrent
            ? `flex h-8 items-center rounded-full px-3.5 text-white ${current === "grow" ? "bg-learn" : "bg-ink"}`
            : `flex h-8 items-center px-3 ${done ? "text-ink hover:text-brand" : "text-muted"}`;
          const text = `${done && !isCurrent ? "✓" : i + 1} ${s.label}`;
          return done || isCurrent ? (
            <Link key={s.key} to={s.to} className={cls} aria-current={isCurrent ? "step" : undefined}>
              {text}
            </Link>
          ) : (
            <span key={s.key} className={cls}>
              {text}
            </span>
          );
        })}
      </nav>
    </>
  );
}

export function SetupHeader({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <>
      <header className="mx-auto flex h-16 max-w-[1344px] items-center justify-between px-6 md:px-12">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Step {step} of 4</span>
          <ThemeToggle />
        </div>
      </header>
      <div className="h-[3px] bg-[#F2F2F5]" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={4} aria-label="Setup progress">
        <div className="h-[3px] bg-brand transition-all" style={{ width: `${(step / 4) * 100}%` }} />
      </div>
    </>
  );
}

function ToastView({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.action ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [t, dismiss]);
  return (
    <div className="rise flex items-center gap-4 rounded-2xl bg-ink px-5 py-3.5 text-[15px] text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
      <span>{t.message}</span>
      {t.action && (
        <button
          type="button"
          className="font-semibold text-[#C9B8FF] hover:text-white"
          onClick={() => {
            t.action!.run();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      className="no-print pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+24px)] z-50 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastView t={t} />
        </div>
      ))}
    </div>
  );
}

/** Shown while the session or profile loads; the spinner appears only if it takes a moment. */
function Blank() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true">
      {show && (
        <div role="status" className="flex items-center gap-3 text-[15px] text-muted">
          <span className="text-brand">
            <Spinner size={18} />
          </span>
          Loading your profile…
        </div>
      )}
    </div>
  );
}

function LoadFailed({ message }: { message: string }) {
  const navigate = useNavigate();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      <h1 className="mt-6 text-3xl font-semibold tight">Something’s not right.</h1>
      <p className="text-muted">{message}</p>
      <div className="mt-2 flex gap-3">
        <Button onClick={retryLoad}>Try again</Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}

/** Signed-in pages. Without a profile, people are sent to setup first. */
export function RequireSession({ needProfile = true, children }: { needProfile?: boolean; children: ReactNode }) {
  const mode = useApp((s) => s.mode);
  const profile = useApp((s) => s.profile);
  const loadError = useApp((s) => s.loadError);
  const navigate = useNavigate();
  const blocked = !isSignedIn(mode) || (needProfile && !profile);
  useEffect(() => {
    if (mode === "loading" || loadError) return;
    if (!isSignedIn(mode)) navigate("/login", { replace: true });
    else if (needProfile && !profile) navigate("/setup/details", { replace: true });
  }, [mode, profile, needProfile, navigate, loadError]);
  if (loadError) return <LoadFailed message={loadError} />;
  return blocked ? <Blank /> : <>{children}</>;
}

const FLOW_READY: Record<FlowStep, (a: Application) => boolean> = {
  jd: () => true,
  match: (a) => Boolean(a.jd && a.match),
  resume: (a) => Boolean(a.jd && a.match),
  grow: (a) => Boolean(a.match),
};
const reachedStep = (a: Application) => (a.plan ? 4 : a.resume ? 3 : a.match ? 2 : 1);

/** The Job → Match → Resume → Grow flow, always for the active resume. */
export function FlowPage({ step, children }: { step: FlowStep; children: (app: Application) => ReactNode }) {
  return (
    <RequireSession>
      <FlowInner step={step}>{children}</FlowInner>
    </RequireSession>
  );
}

function FlowInner({ step, children }: { step: FlowStep; children: (app: Application) => ReactNode }) {
  const app = useActiveApplication();
  const newApplication = useApp((s) => s.newApplication);
  const navigate = useNavigate();
  useEffect(() => {
    if (app) {
      if (!FLOW_READY[step](app)) navigate("/new/jd", { replace: true });
    } else if (step === "jd") newApplication();
    else navigate("/home", { replace: true });
  }, [app, step, newApplication, navigate]);
  if (!app || !FLOW_READY[step](app)) return <Blank />;
  return (
    <>
      <AppHeader center={<FlowSteps current={step} reached={reachedStep(app)} />} />
      {children(app)}
    </>
  );
}
