import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { Account, CareerStatus } from "../../shared/types";
import { RequireSession, SetupHeader } from "../components/layout";
import { Button, TextField } from "../components/ui";
import { useApp } from "../store/app";

const STATUSES: { id: CareerStatus; title: string; detail: string }[] = [
  { id: "student", title: "Student", detail: "Currently in college" },
  { id: "grad", title: "Recent graduate", detail: "Graduated in the last year" },
  { id: "early", title: "Early career", detail: "1–3 years of work" },
  { id: "switch", title: "Switching fields", detail: "Moving into a new area" },
];
const INTERESTS = ["Frontend", "Full stack", "Backend", "Data analyst", "UI/UX", "Mobile", "ML / AI"];

function Details() {
  const navigate = useNavigate();
  const account = useApp((s) => s.account);
  const setAccount = useApp((s) => s.setAccount);
  const [form, setForm] = useState<Account>({ name: "", email: "", phone: "", city: "", status: "student", gradYear: "", interests: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    if (account) setForm((f) => ({ ...f, ...account }));
  }, [account]);

  const patch = (p: Partial<Account>) => {
    setForm((f) => ({ ...f, ...p }));
    setError("");
  };
  const next = () => {
    if (!form.name.trim()) return setError("Add your full name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError("Add a valid email address.");
    if (!form.phone.trim()) return setError("Add a phone number recruiters can reach you on.");
    if (form.status === "student" && !form.gradYear.trim()) return setError("Add your graduation year.");
    setAccount({ ...form, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), city: form.city.trim() });
    navigate("/setup/upload");
  };

  return (
    <main className="mx-auto flex max-w-[620px] flex-col gap-3 px-6 pb-24 pt-20">
      <p className="text-[15px] font-medium text-brand">Your details</p>
      <h1 className="text-[40px] font-semibold tight md:text-5xl">Tell us about you.</h1>
      <p className="text-[17px] text-muted">This helps Nevora give advice that fits where you are.</p>
      <div className="mt-8 grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <TextField label="Full name" autoComplete="name" value={form.name} onChange={(e) => patch({ name: e.target.value })} />
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} />
        <TextField label="Phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
        <TextField label="City" optional autoComplete="address-level2" value={form.city} onChange={(e) => patch({ city: e.target.value })} />
      </div>
      <h2 className="mt-10 text-xl font-semibold">Where are you right now?</h2>
      <div className="mt-1 grid gap-3 sm:grid-cols-2">
        {STATUSES.map((s) => {
          const on = form.status === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => patch({ status: s.id })}
              className={`rounded-[18px] border-2 px-5 py-5 text-left transition ${on ? "border-brand bg-brand-soft" : "border-transparent bg-surface hover:bg-line"}`}
            >
              <div className="text-[17px] font-semibold">{s.title}</div>
              <div className="mt-1 text-sm text-muted">{s.detail}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-[200px_1fr]">
        <TextField
          label="Graduation year"
          inputMode="numeric"
          value={form.gradYear}
          onChange={(e) => patch({ gradYear: e.target.value })}
          optional={form.status !== "student"}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            Roles you’re interested in <span className="font-normal text-muted">(optional)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((r) => {
              const on = form.interests.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => patch({ interests: on ? form.interests.filter((x) => x !== r) : [...form.interests, r] })}
                  className={`h-10 rounded-full px-4 text-[15px] transition ${on ? "bg-ink text-white" : "bg-surface hover:bg-line"}`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-6 text-[15px] text-bad">
          {error}
        </p>
      )}
      <div className="mt-12 flex items-center justify-between">
        <Button variant="ghost" href="/">
          Back
        </Button>
        <Button size="lg" onClick={next}>
          Continue
        </Button>
      </div>
    </main>
  );
}

export default function SetupDetails() {
  return (
    <RequireSession needProfile={false}>
      <SetupHeader step={1} />
      <Details />
    </RequireSession>
  );
}
