import { Link } from "react-router";
import { Chip } from "../components/ui";
import { CheckIcon, ShieldIcon } from "../components/icons";
import { Logo, Mark, ThemeToggle } from "../components/layout";
import { isSignedIn, useApp } from "../store/app";

/**
 * Survey figures for "The problem" section. Only fill these in with real survey
 * results; the row stays hidden while every value is empty.
 */
const PROBLEM_STATS: { value: string; label: string }[] = [
  { value: "", label: "of students we surveyed use one resume for every application" },
  { value: "", label: "don’t know what to change for each job" },
  { value: "", label: "have added a skill they don’t really have" },
];
const FOOTER_LEFT = "Nevora · Built at BUILDATHON – Future Forge 2026, VELS University";
const FOOTER_RIGHT = "";

function PrimaryCta() {
  const signedIn = isSignedIn(useApp((s) => s.mode));
  return (
    <Link
      to={signedIn ? "/home" : "/login?new=1"}
      className="flex h-[52px] items-center rounded-full bg-brand px-8 text-[17px] font-medium text-white hover:bg-brand-hover"
    >
      {signedIn ? "Open Nevora" : "Get started"}
    </Link>
  );
}

function LandingHeader() {
  const signedIn = isSignedIn(useApp((s) => s.mode));
  return (
    <header className="sticky top-0 z-30 border-b border-[#EDEDF0] bg-white/72 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1344px] items-center justify-between px-6 md:px-16">
        <Logo />
        <nav className="hidden gap-9 text-sm md:flex">
          <a href="#features" className="text-ink hover:text-brand">
            Features
          </a>
          <a href="#how" className="text-ink hover:text-brand">
            How it works
          </a>
          <a href="#problem" className="text-ink hover:text-brand">
            Why Nevora
          </a>
        </nav>
        <div className="flex items-center gap-5">
          <ThemeToggle />
          {signedIn ? (
            <Link to="/home" className="flex h-9 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-black">
              Open Nevora
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-ink">
                Sign in
              </Link>
              <Link to="/login?new=1" className="flex h-9 items-center rounded-full bg-ink px-[18px] text-sm font-medium text-white hover:bg-black">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const Bar = ({ w, dark }: { w: string; dark?: boolean }) => (
  <div className={`h-[7px] rounded ${dark ? "bg-[#D9D9DF]" : "bg-[#E8E8ED]"}`} style={{ width: w }} />
);
const MiniLabel = ({ children }: { children: string }) => (
  <div className="mt-3.5 text-[11px] font-semibold tracking-[0.06em] text-muted">{children}</div>
);

function HeroVisual() {
  return (
    <div
      className="mt-24 flex w-full max-w-[1200px] flex-col items-center justify-center gap-9 rounded-[36px] bg-surface p-8 md:flex-row md:p-10 lg:h-[640px]"
      aria-hidden="true"
    >
      <div className="flex w-full max-w-[460px] flex-col gap-3 rounded-[14px] bg-white p-10 text-left shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
        <div className="text-lg font-semibold">Priya Sharma</div>
        <Bar w="70%" />
        <MiniLabel>SKILLS</MiniLabel>
        <div className="flex flex-wrap gap-1.5">
          {["React", "JavaScript", "REST APIs"].map((s) => (
            <span key={s} className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] text-brand-ink">
              {s}
            </span>
          ))}
          <span className="rounded-full bg-[#F2F2F5] px-2.5 py-1 text-[11px] text-muted">Git</span>
        </div>
        <MiniLabel>PROJECTS</MiniLabel>
        <div className="text-xs font-semibold">CampusConnect</div>
        <div className="text-xs leading-normal">
          Built a responsive React web app for college fest registrations <span className="rounded bg-metric px-1">[add metric]</span>
        </div>
        <Bar w="92%" />
        <Bar w="80%" />
        <MiniLabel>EXPERIENCE</MiniLabel>
        <Bar w="60%" dark />
        <Bar w="94%" />
        <Bar w="86%" />
      </div>
      <div className="flex w-full max-w-[360px] flex-col gap-4 text-left">
        <div className="rounded-[22px] bg-white p-7 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
          <div className="text-[13px] text-muted">Match for Frontend Intern</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[64px] font-semibold tracking-[-0.04em]">76</span>
            <span className="text-muted">/ 100</span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {["88%", "17%", "100%"].map((w) => (
              <div key={w} className="h-1.5 rounded bg-[#F2F2F5]">
                <div className="h-1.5 rounded bg-brand" style={{ width: w }} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-[22px] bg-white px-7 py-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ok-soft text-ok">
            <CheckIcon size={18} />
          </span>
          <div>
            <div className="font-semibold">12 of 12 lines verified</div>
            <div className="mt-0.5 text-[13px] text-muted">Every line traced to your profile</div>
          </div>
        </div>
        <div className="rounded-[22px] bg-learn-soft px-7 py-6">
          <div className="text-[13px] font-medium text-learn-ink">Next to learn</div>
          <div className="mt-1 text-xl font-semibold">TypeScript</div>
          <div className="mt-0.5 text-[13px] text-learn-ink">About 1 week · 4 steps</div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="flex flex-col items-center px-6 pt-24 text-center md:pt-28">
      <div className="rise flex flex-col items-center gap-7">
        <Mark size={84} />
        <span className="inline-flex h-8 items-center gap-2 rounded-full bg-surface px-3.5 text-[13px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
          Built for students and fresh graduates
        </span>
        <h1 className="text-[56px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[80px] lg:text-[104px]">
          One profile.
          <br />
          Every job.
        </h1>
        <p className="max-w-[660px] text-lg leading-relaxed text-muted sm:text-[22px]">
          Nevora tailors your resume to each job description, keeps every line true to you, and shows you what to learn next.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-7">
          <PrimaryCta />
          <a href="#how" className="text-[17px] text-brand hover:text-brand-hover">
            See how it works ›
          </a>
        </div>
      </div>
      <HeroVisual />
    </section>
  );
}

function Problem() {
  const stats = PROBLEM_STATS.filter((s) => s.value);
  return (
    <section id="problem" className="flex flex-col items-center gap-5 px-6 pt-40 text-center">
      <p className="text-[15px] font-medium text-brand">The problem</p>
      <h2 className="max-w-[920px] text-4xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-[60px]">
        Most students send the same resume to every company.
      </h2>
      <p className="max-w-[640px] text-lg leading-relaxed text-muted md:text-xl">
        Recruiters scan for what the role asks for. A generic resume hides those skills, even when the student has them.
      </p>
      {stats.length > 0 && (
        <div className={`mt-14 grid w-full max-w-[1000px] gap-12 md:gap-16 ${stats.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-[56px] font-semibold tracking-[-0.04em]">{s.value}</div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FeatureCard({
  title,
  body,
  className = "",
  tone = "bg-surface",
  bodyTone = "text-muted",
  children,
}: {
  title: string;
  body: string;
  className?: string;
  tone?: string;
  bodyTone?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex min-h-[420px] flex-col justify-between gap-8 rounded-[30px] p-11 ${tone} ${className}`}>
      <div>
        <h3 className="text-[32px] font-semibold leading-tight tracking-[-0.03em]">{title}</h3>
        <p className={`mt-2.5 max-w-[520px] text-[17px] leading-relaxed ${bodyTone}`}>{body}</p>
      </div>
      {children}
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="flex flex-col items-center gap-4 px-6 pt-40">
      <p className="text-[15px] font-medium text-brand">What Nevora does</p>
      <h2 className="text-4xl font-semibold tracking-[-0.04em] md:text-[60px]">Tailor. Verify. Grow.</h2>
      <div className="mt-12 grid w-full max-w-[1200px] gap-5 lg:grid-cols-3">
        <FeatureCard
          className="lg:col-span-2"
          title="Tailored to every job."
          body="Paste a job description. Nevora finds what matters and puts your most relevant skills and projects first."
        >
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-2">
              {["React", "REST APIs", "Git", "Teamwork"].map((s) => (
                <Chip key={s} tone="white">
                  {s}
                </Chip>
              ))}
            </div>
            <div className="flex flex-col gap-2 rounded-[18px] bg-white px-6 py-5">
              <p className="text-[15px] text-muted line-through">Made a website for our college fest using React.</p>
              <p className="text-[15px] font-medium">
                Built a responsive React web app for college fest registrations{" "}
                <span className="rounded bg-metric px-1.5 font-normal">[add metric]</span>
              </p>
            </div>
          </div>
        </FeatureCard>
        <FeatureCard title="Every line, backed by you." body="A second check traces each line to your profile. Nothing is invented.">
          <div className="flex items-center gap-3.5">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ok-soft text-ok">
              <ShieldIcon size={28} />
            </span>
            <span className="text-[28px] font-semibold tracking-[-0.02em]">12 / 12</span>
          </div>
        </FeatureCard>
        <FeatureCard
          tone="bg-learn-soft"
          bodyTone="text-learn-ink"
          title="Know what to learn next."
          body="Missing a skill? Get a short plan, free resources and a project that proves it."
        >
          <ul className="flex flex-col gap-2.5 text-[15px]">
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-learn text-white">
                <CheckIcon size={12} />
              </span>
              Learn types and interfaces
            </li>
            <li className="flex items-center gap-2.5">
              <span className="h-5 w-5 rounded-md border-[1.5px] border-learn" />
              Convert one component
            </li>
            <li className="flex items-center gap-2.5">
              <span className="h-5 w-5 rounded-md border-[1.5px] border-learn" />
              Add it to your profile
            </li>
          </ul>
        </FeatureCard>
        <FeatureCard className="lg:col-span-2" title="One profile. Many resumes." body="Set up once. Tailor for every job, and keep each version named and saved.">
          <div className="grid gap-3.5 sm:grid-cols-3">
            {(
              [
                ["Frontend Intern – Acme Labs", "Today", 76],
                ["SDE Intern – Globex", "Last week", 71],
                ["Data Analyst – Northwind", "3 days ago", 64],
              ] as const
            ).map(([name, when, score]) => (
              <div key={name} className="rounded-[18px] bg-white p-5">
                <div className="text-[15px] font-semibold">{name}</div>
                <div className="mt-4 flex justify-between text-[13px] text-muted">
                  <span>{when}</span>
                  <span className="font-semibold text-ink">{score}</span>
                </div>
              </div>
            ))}
          </div>
        </FeatureCard>
      </div>
      <div className="mt-8 flex max-w-[1200px] flex-wrap items-center justify-center gap-2.5 text-[15px]">
        <span className="mr-1 text-muted">Also included</span>
        {["Truthful cover letters", "Interview prep from your projects", "Bullet coach", "Score forecast", "Profile strength"].map((f) => (
          <span key={f} className="rounded-full bg-surface px-4 py-2">
            {f}
          </span>
        ))}
      </div>
    </section>
  );
}

const HOW = [
  ["Sign in and upload", "Add your current resume. Nevora reads it for you."],
  ["Complete your profile", "Review what we found. Add certifications and more."],
  ["Paste a job", "See your match and exactly what the role asks for."],
  ["Download and grow", "Get your tailored resume and a plan for the gaps."],
];

function How() {
  return (
    <section id="how" className="flex flex-col items-center gap-4 px-6 pt-40">
      <p className="text-[15px] font-medium text-brand">How it works</p>
      <h2 className="text-center text-4xl font-semibold tracking-[-0.04em] md:text-[60px]">Four steps. A few minutes.</h2>
      <ol className="mt-14 grid w-full max-w-[1200px] gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {HOW.map(([title, body], i) => (
          <li key={title} className="border-t border-hair pt-6">
            <div className="text-sm text-muted">{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-3 text-xl font-semibold tracking-[-0.01em]">{title}</div>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Closing() {
  return (
    <>
      <section className="mx-6 mt-40 flex max-w-[1200px] flex-col items-center gap-7 rounded-[36px] bg-surface px-8 py-24 text-center lg:mx-auto">
        <Mark size={56} />
        <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.045em] md:text-[64px]">
          Your next application
          <br />
          starts here.
        </h2>
        <PrimaryCta />
      </section>
      <footer className="mx-auto mt-24 flex max-w-[1200px] flex-col justify-between gap-2 border-t border-[#EDEDF0] px-6 py-8 text-[13px] text-muted sm:flex-row lg:px-0">
        <span>{FOOTER_LEFT}</span>
        {FOOTER_RIGHT && <span>{FOOTER_RIGHT}</span>}
      </footer>
    </>
  );
}

export default function Landing() {
  return (
    <>
      <LandingHeader />
      <main>
        <Hero />
        <Problem />
        <Features />
        <How />
        <Closing />
      </main>
    </>
  );
}
