import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { GoogleIcon } from "../components/icons";
import { Logo, ThemeToggle } from "../components/layout";
import { Button, TextField } from "../components/ui";
import { firebaseConfigured } from "../lib/firebase";
import { authCode, authMessage, redirectError, resetPassword, signInEmail, signInGoogle, signUpEmail } from "../lib/session";
import { useApp } from "../store/app";

type View = "in" | "up" | "reset";

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = useApp((s) => s.mode);
  const profile = useApp((s) => s.profile);
  const loadError = useApp((s) => s.loadError);
  const [view, setView] = useState<View>(params.get("new") ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"" | "email" | "google">("");
  const [showPassword, setShowPassword] = useState(false);
  // After Google fails because this site isn't allowed, point people to email instead.
  const [googleBlocked, setGoogleBlocked] = useState(false);

  useEffect(() => {
    void redirectError().then((err) => {
      if (!err) return;
      setError(authMessage(err));
      if (authCode(err) === "auth/unauthorized-domain") setGoogleBlocked(true);
    });
  }, []);

  // Once Firebase reports the session and the data has loaded, move on.
  useEffect(() => {
    if (mode === "cloud") navigate(loadError || profile ? "/home" : "/setup/details", { replace: true });
  }, [mode, profile, loadError, navigate]);

  const run = async (kind: "email" | "google", work: () => Promise<void>) => {
    setBusy(kind);
    setError("");
    try {
      await work();
    } catch (err) {
      setError(authMessage(err));
      if (kind === "google" && authCode(err) === "auth/unauthorized-domain") setGoogleBlocked(true);
      setBusy("");
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setNotice("");
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError("Enter a valid email address.");
    if (view === "reset") {
      return run("email", async () => {
        await resetPassword(address);
        setNotice("If there's an account for that email, a reset link is on its way.");
        setBusy("");
      });
    }
    if (!password) return setError("Enter your password.");
    if (view === "up" && password.length < 6) return setError("Use at least 6 characters for your password.");
    run("email", () => (view === "in" ? signInEmail(address, password) : signUpEmail(address, password)));
  };

  const switchView = (next: View) => {
    setView(next);
    setError("");
    setNotice("");
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col px-6 py-12 md:px-16 lg:w-1/2">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <form onSubmit={submit} noValidate className="mx-auto my-auto flex w-full max-w-[400px] flex-col gap-3.5 py-12">
          <h1 className="text-[40px] font-semibold tight">
            {view === "in" ? "Sign in to Nevora" : view === "up" ? "Create your account" : "Reset your password"}
          </h1>
          <p className="mb-4 text-[17px] text-muted">
            {view === "reset" ? "We’ll email you a link to choose a new one." : "Your career profile, ready for every job."}
          </p>
          {!firebaseConfigured && (
            <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
              Sign-in isn’t available right now. Please try again later.
            </p>
          )}
          {view !== "reset" && (
            <>
              <Button
                variant="secondary"
                size="lg"
                className="w-full rounded-[14px]"
                loading={busy === "google"}
                disabled={!firebaseConfigured || Boolean(busy)}
                onClick={() => run("google", signInGoogle)}
              >
                {busy !== "google" && <GoogleIcon />}
                Continue with Google
              </Button>
              {googleBlocked && <p className="text-center text-[13px] text-muted">Google sign-in isn’t available on this website yet — use your email below.</p>}
              <div className="my-2 flex items-center gap-3.5 text-[13px] text-muted">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
          />
          {view !== "reset" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="f-password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="f-password"
                  className="input pr-20"
                  type={showPassword ? "text" : "password"}
                  autoComplete={view === "in" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-controls="f-password"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm text-muted hover:text-ink"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {view === "up" && <p className="text-[13px] text-muted">At least 6 characters.</p>}
            </div>
          )}
          {view === "in" && (
            <button type="button" className="self-end text-sm text-brand hover:text-brand-hover" onClick={() => switchView("reset")}>
              Forgot password?
            </button>
          )}
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-ok">
              {notice}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-2 w-full" loading={busy === "email"} disabled={!firebaseConfigured || Boolean(busy)}>
            {view === "in" ? "Continue" : view === "up" ? "Create account" : "Send reset link"}
          </Button>
          <p className="mt-1.5 text-center text-[15px] text-muted">
            {view === "in" ? "New to Nevora? " : view === "up" ? "Already have an account? " : "Remembered it? "}
            <button type="button" className="text-brand hover:text-brand-hover" onClick={() => switchView(view === "in" ? "up" : "in")}>
              {view === "in" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
      <div className="hidden w-1/2 flex-col justify-center gap-12 bg-surface px-22 py-24 lg:flex" aria-hidden="true">
        <h2 className="text-[52px] font-semibold leading-[1.05] tracking-[-0.04em]">
          Set up once.
          <br />
          Tailor for every job.
        </h2>
        <div className="flex w-[440px] flex-col gap-3.5">
          {(
            [
              ["Frontend Intern – Acme Labs", "Edited today", 76, 0],
              ["Data Analyst – Northwind", "3 days ago", 64, 32],
              ["SDE Intern – Globex", "Last week", 71, 64],
            ] as const
          ).map(([name, when, score, indent]) => (
            <div
              key={name}
              style={{ marginLeft: indent }}
              className="flex items-center justify-between rounded-[20px] bg-white px-6 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.05)]"
            >
              <div>
                <div className="font-semibold">{name}</div>
                <div className="mt-0.5 text-[13px] text-muted">{when}</div>
              </div>
              <div className="text-[26px] font-semibold tracking-[-0.02em]">{score}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
