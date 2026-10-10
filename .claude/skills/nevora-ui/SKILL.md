---
name: nevora-ui
description: Build, change or review any Nevora screen, component or mockup so it matches Nevora's design system — Geist type, ink-on-white Apple-like minimalism, purple (brand) for resume/setup and teal (learn) for Grow, pill buttons, big rounded cards, frosted menus, light and dark themes. Use this whenever you touch UI in the Nevora repo (src/pages, src/components, src/index.css), add a page, card, form, dialog, badge or empty state, restyle something, fix a UI bug, write UI copy, or make an HTML/slide mockup "in Nevora's style" — even if the user just says "add a section", "make it look nicer" or "build the X screen" without mentioning design.
---

# Nevora UI

Nevora is a resume tailoring app for students. Its look is calm and premium:
white space, big tight headings, one clear action per area, honest copy.
This skill keeps every new screen looking like it was always part of the app.

The source of truth is the code. Before writing UI in the repo, skim:

- `src/index.css` — colour tokens (light + dark), `.input`, `.frost`, `.frost-panel`, `.rise`, `.tight`, `.paper`
- `src/components/ui.tsx` — Button, TextField, TextArea, Chip, Segmented, Steps, ErrorBox, EmptyState, ScoreRing, StatusDot, Placeholders
- `src/components/layout.tsx` — AppHeader, SetupHeader, FlowPage, RequireSession, Toasts, ThemeToggle
- `src/components/Dropdown.tsx`, `src/components/form.tsx` — dropdowns and form fields
- `docs/DESIGN.md` — the written rules (if present)

Full token tables and rules: `references/design-tokens.md`.
Copy-paste page and component patterns: `references/patterns.md`.
Building outside the repo (HTML mockup, artifact, slides)? Use `assets/nevora-tokens.css`.

## How to work

1. **Reuse before you build.** If `ui.tsx`, `layout.tsx`, `form.tsx` or `Dropdown.tsx` has it, use it. A new one-off button style or native `<select>` makes the app feel stitched together. Only add a shared component when the pattern will repeat; put it next to its siblings.
2. **Use tokens, not hex.** Tailwind classes map to tokens: `bg-brand`, `text-muted`, `border-line`, `bg-surface`, `bg-learn-soft`, `text-ok`… Tokens flip for dark mode automatically; a raw hex only works in one theme. The few hard-coded greys in older code are patched in `index.css` — don't add more.
3. **Pick the right colour family.**
   - Purple (`brand`) = setup, profile, job, match, resume, primary actions.
   - Teal (`learn`) = anything about learning: Grow page, skill gaps, plans, courses, "See what to learn next".
   - Status: `ok` / `warn` / `bad` with their `-soft` backgrounds and `-dot` dots. Always pair colour with a word ("Strong", "Missing").
   - Text on a soft fill uses the matching ink: `bg-brand-soft text-brand-ink`, `bg-learn-soft text-learn-ink`.
4. **Follow the type scale** (Geist; headings `font-semibold`):
   page title `text-[40px] md:text-5xl tight` · section `text-[28px] tracking-[-0.02em]` · card title `text-[22px] tracking-[-0.02em]` · lead `text-[17px] text-muted` · body `text-[15px]` · caption `text-[13px] text-muted` · eyebrow `text-[15px] font-medium text-brand` (or `text-learn` on Grow).
5. **Shape:** buttons, chips, badges, segmented controls are pills (`rounded-full`). Inputs 14px (`.input`). Rows and small panels `rounded-2xl`/`rounded-[18px]`. Cards `rounded-[22px]`–`rounded-[26px]`. Big panels and dialogs `rounded-[28px]`–`rounded-[30px]`. Prefer `border border-line` to shadows; reserve shadows for floating things.
6. **Layout:** page `mx-auto max-w-[…] px-6 pb-24 pt-16` (widths: 1248 flow/home, 1080 profile, 1000 grow, 760–920 setup). Stack with flex/grid `gap`, not margins. One column on phones; nothing scrolls sideways at 390px.
7. **Floating UI** (menus, dropdown lists, pickers, dialogs) uses `.frost-panel` (+ `rise-fast` for menus, `rise` for dialogs) over a `bg-black/25 backdrop-blur-md` scrim. Dialogs: `role="dialog" aria-modal="true"`, focus the panel, close on Escape and backdrop click.
8. **Both themes.** Check that every surface you add uses `bg-card`/`bg-surface`/`bg-white` (remapped in dark) and token text colours. Anything inside the resume preview lives in `.paper` and stays a white page.
9. **Copy** is plain, short and written to the student. Buttons say what happens ("Upload LinkedIn PDF", "Add 3 to my profile"). Errors say what went wrong and what to do. Never promise what the app doesn't do; when AI is off, say so and say what still works. Highlight missing facts as `[placeholders]` with `<Placeholders>` rather than inventing them.
10. **Accessibility:** real `<button>`/`<a>`/`<label>`; `aria-label` on icon-only buttons; `role="alert"` for errors, `role="status"` for progress; switches use `role="switch" aria-checked`; checkboxes built from buttons use `role="checkbox" aria-checked`. Touch targets ≥ 36px.

## Before you finish

- `npx tsc -p tsconfig.json` passes and the screen uses existing components where they exist.
- No raw hex colours added outside `index.css` (except deliberate brand marks like LinkedIn `#0a66c2`).
- Looks right at 390px and 1440px, in light and dark.
- One primary (purple, or teal on Grow) button per area; others secondary or ghost.
- Copy reads like the rest of the app.

If you can run the app (`npm run dev`), look at the screen in both themes before calling it done.
