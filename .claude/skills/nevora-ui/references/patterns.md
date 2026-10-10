# Nevora UI patterns

Real snippets from the app (React 19 + Tailwind 4). Copy, then adapt.

## Contents
1. Signed-in page
2. Flow page (Job → Match → Resume → Grow)
3. Setup step page
4. Section card with title and action
5. Tinted info / next-step banner
6. Form fields
7. Buttons and links
8. Badges, chips, status
9. List row with actions
10. Dialog
11. Loading, error, empty
12. Toast

---

## 1. Signed-in page

```tsx
import { AppHeader, RequireSession } from "../components/layout";

export default function Thing() {
  return (
    <RequireSession>
      <AppHeader />
      <main className="mx-auto max-w-[1248px] px-6 pb-24 pt-16">
        <p className="text-[15px] font-medium text-brand">Eyebrow</p>
        <h1 className="mt-3 text-[40px] font-semibold tight md:text-5xl">Page title.</h1>
        <p className="mt-3 text-[17px] text-muted">One sentence that says what this page is for.</p>
        <div className="mt-9 flex flex-col gap-5">{/* sections */}</div>
      </main>
    </RequireSession>
  );
}
```

## 2. Flow page

```tsx
import { FlowPage } from "../components/layout";
export default function Step() {
  return <FlowPage step="match">{(app) => <StepBody key={app.id} app={app} />}</FlowPage>;
}
```
Grow pages use teal: eyebrow `text-learn`, primary button `variant="learn"`, panels `bg-learn-soft`.

## 3. Setup step page

```tsx
<RequireSession>
  <SetupHeader step={4} />
  <main className="mx-auto max-w-[760px] px-6 pb-24 pt-16 md:pt-[72px]">
    <p className="text-[15px] font-medium text-brand">Last step · optional</p>
    <h1 className="mt-3 text-[40px] font-semibold tight md:text-5xl">Add your LinkedIn.</h1>
    <p className="mt-3 max-w-2xl text-[17px] text-muted">Why this step helps.</p>
    <div className="mt-9">{/* card */}</div>
    <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
      <Button variant="ghost" size="lg" href="/setup/review">Back</Button>
      <Button size="lg" onClick={next}>Continue</Button>
    </div>
  </main>
</RequireSession>
```

## 4. Section card

```tsx
<section id="certifications" className="scroll-mt-24 rounded-[22px] border border-line p-7">
  <div className="mb-5 flex items-start justify-between gap-4">
    <div>
      <h2 className="text-xl font-semibold tracking-[-0.01em]">Certifications</h2>
      <p className="mt-1 text-[15px] text-muted">Short helpful subtitle.</p>
    </div>
    <button type="button" className="shrink-0 text-[15px] text-brand hover:text-brand-hover">+ Add</button>
  </div>
  <div className="flex flex-col gap-5">{children}</div>
</section>
```
Bigger feature cards: `rounded-[26px] border border-line p-6 md:p-8`, title `text-[22px] font-semibold tracking-[-0.02em]`.
Grey panel instead of border: `rounded-[30px] bg-surface p-7 md:p-10`.

## 5. Tinted banner

```tsx
<div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-brand-soft px-6 py-5">
  <div>
    <p className="text-xs font-semibold tracking-[0.08em] text-brand-ink">NEXT BEST STEP</p>
    <p className="mt-1 text-[17px] font-semibold">Tailor your first resume</p>
    <p className="mt-0.5 text-sm text-brand-ink">Paste any job description. It takes about a minute.</p>
  </div>
  <Button onClick={start}>Start</Button>
</div>
```
Info line: `flex items-center gap-3 rounded-2xl bg-brand-soft px-5 py-4 text-[15px] text-brand-ink` with `<InfoIcon />`.
Warning: `rounded-2xl bg-warn-soft px-5 py-4 text-[15px] text-warn`.

## 6. Form fields

```tsx
import { TextField } from "../components/ui";
import { SelectField, MonthYearField, YearField, SkillPicker } from "../components/form";
import { Dropdown } from "../components/Dropdown";

<TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
<SelectField label="Degree" value={degree} options={DEGREES} onChange={setDegree} />
<MonthYearField label="End" value={end} onChange={setEnd} allowPresent />
```
Raw input with inline error:
```tsx
<label htmlFor={id} className="block text-sm font-medium">LinkedIn profile URL</label>
<input id={id} className={`input mt-2 ${error ? "border-bad" : ""}`} aria-invalid={!!error} aria-describedby={error ? errId : undefined} />
{error && <p id={errId} role="alert" className="mt-2 text-sm text-bad">{error}</p>}
```
Never use a native `<select>`; use `Dropdown` / `SelectField`.

## 7. Buttons and links

```tsx
<Button>Primary</Button>                       // one per area
<Button variant="secondary">Other action</Button>
<Button variant="ghost">Back</Button>
<Button variant="dark">Strong neutral</Button>
<Button variant="learn">Find courses</Button>  // Grow only
<Button size="sm" loading={busy}>Save</Button> // sizes sm 36 / md 44 / lg 52
<Button href="/home">Home</Button>             // renders a router Link
```
Text link: `text-sm font-medium text-brand hover:underline`. Quiet action: `text-sm font-medium text-muted hover:text-ink`.
Icon button: `flex h-9 w-9 items-center justify-center rounded-full bg-surface hover:bg-line` + `aria-label`.

## 8. Badges, chips, status

```tsx
<span className="rounded-full bg-ok-soft px-2 py-0.5 text-[12px] font-medium text-ok">Verified</span>
<span className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-medium text-muted">Optional</span>
<span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[13px] font-semibold text-brand-ink">
  <SparkleIcon size={13} className="text-brand" /> Auto-detected
</span>
<Chip tone="learn">Docker</Chip>
<StatusDot status="partial" />   // dot + word
<ScoreRing score={60} />
```

## 9. List row with actions

```tsx
<li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3.5">
  <div className="min-w-0 flex-1">
    <p className="text-[15px] font-medium leading-snug">Title</p>
    <p className="mt-0.5 text-[13px] text-muted">Meta · meta</p>
  </div>
  <div className="flex shrink-0 gap-2">
    <a className="inline-flex h-9 items-center rounded-full border border-hair bg-white px-4 text-sm font-medium hover:bg-surface" href={url} target="_blank" rel="noopener noreferrer">Open ↗</a>
    <button type="button" className="inline-flex h-9 items-center rounded-full bg-learn-soft px-4 text-sm font-medium text-learn-ink">Save</button>
  </div>
</li>
```

## 10. Dialog

```tsx
<div className="no-print fixed inset-0 z-40 flex items-end justify-center bg-black/25 p-0 backdrop-blur-md sm:items-center sm:p-6"
     onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
  <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dlg-title"
       className="frost-panel rise flex max-h-[92vh] w-full max-w-[720px] flex-col gap-6 overflow-y-auto rounded-t-[28px] p-6 outline-none sm:rounded-[28px] sm:p-8">
    <div className="flex items-start justify-between gap-4">
      <h2 id="dlg-title" className="text-[28px] font-semibold tight">Title</h2>
      <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface hover:bg-line"><CloseIcon /></button>
    </div>
    {/* body */}
  </div>
</div>
```
Focus the panel on open; close on Escape (document keydown listener).

## 11. Loading, error, empty

```tsx
{busy && <Steps steps={["Reading the job", "Matching your profile", "Writing your resume"]} />}
{error && <ErrorBox message={error} onRetry={retry} />}
<EmptyState title="No tailored resumes yet" body="Paste a job description and Nevora will build your first one." action={<Button onClick={start}>New tailored resume</Button>} />
```

## 12. Toast

```tsx
import { toast } from "../store/toast";
toast("Course saved");
toast(`Deleted “${name}”`, { label: "Undo", run: restore });
```
