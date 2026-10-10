# Nevora design system

How Nevora looks and why. Everything here comes from the code: tokens live in
`src/index.css`, shared components in `src/components/`. If this file and the
code disagree, the code wins — update this file.

## 1. Principles

- **Minimal and calm.** Apple-like: lots of white space, big bold headings, one clear action per area.
- **Honest.** Copy never promises what the app doesn't do. Placeholders like `[add metric]` are highlighted, never hidden.
- **Two colours, two jobs.** Purple = build and verify your resume. Teal = learn and grow. Never swap them.
- **Works everywhere.** Phone width (about 390px) up, light and dark themes, keyboard and screen readers.

## 2. Colour

Use the token names (Tailwind classes such as `bg-brand`, `text-muted`), never raw hex in components.

### Neutrals

| Token | Light | Dark | Use |
|---|---|---|---|
| `ink` | `#1d1d1f` | `#f5f5f7` | Main text, dark buttons |
| `muted` | `#6e6e73` | `#a1a1a6` | Secondary text, captions |
| `hair` | `#d2d2d7` | `#48484a` | Button and control borders |
| `line` | `#e8e8ed` | `#2c2c2e` | Card borders, dividers |
| `surface` | `#f5f5f7` | `#1c1c1e` | Grey panels, inputs, chips |
| `card` | `#ffffff` | `#151517` | Cards, menus, dialogs |
| `page` | `#ffffff` | `#0b0b0c` | Page background |

### Brand (purple) — resume, setup, primary actions

| Token | Light | Dark | Use |
|---|---|---|---|
| `brand` | `#673cea` | `#7c5cf5` | Primary buttons, links, focus ring |
| `brand-hover` | `#5429d6` | `#8f74f7` | Primary button hover |
| `brand-ink` | `#4a22c7` | `#c4b5fd` | Text on `brand-soft` |
| `brand-soft` | `#f3effe` | `#241d3d` | Tinted panels, badges, selection |

### Learn (teal) — Grow page only: skill gaps, plans, courses

| Token | Light | Dark | Use |
|---|---|---|---|
| `learn` | `#0a7a8a` | `#1595a8` | Grow buttons, progress, active Grow step |
| `learn-hover` | `#075f6b` | `#19a9be` | Hover |
| `learn-ink` | `#0a6b78` | `#7dd3df` | Text on `learn-soft` |
| `learn-soft` | `#e6f5f7` | `#10292d` | Tinted panels |

### Status

| Token | Light | Dark | Use |
|---|---|---|---|
| `ok` / `ok-soft` / `ok-dot` | `#1e7b34` / `#e9f7ee` / `#34c759` | `#4ade80` / `#10261a` | Verified, strong match, success |
| `warn` / `warn-soft` / `warn-dot` | `#8a4b00` / `#fff6e8` / `#ff9f0a` | `#fbbf24` / `#2b2110` | Partial match, needs attention |
| `bad` / `bad-soft` / `bad-dot` | `#c4001a` / `#ffecee` / `#ff3b30` | `#ff6b6b` / `#2e1416` | Missing, errors, delete |
| `metric` | `#fff3b0` | `#5c4a00` | Highlight behind `[placeholders]` |

Rules:
- Status is never shown by colour alone: always add the word ("Strong", "Partial", "Missing").
- Text on a soft background uses the matching `-ink` colour (`brand-ink` on `brand-soft`).
- Placeholder input text is `#8e8e93`.

## 3. Typography

- **Font:** [Geist](https://fonts.google.com/specimen/Geist) (400, 500, 600, 700), fallback `-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`.
- **Big headings** use the `.tight` class (letter-spacing `-0.035em`) and `font-semibold`.

| Role | Size | Weight | Example |
|---|---|---|---|
| Landing hero | 56 → 80 → 104px (by screen) | 600 | "One profile. Every job." |
| Page title | 40px, 48px on desktop | 600, tight | "Good morning, Arun." |
| Section title | 28px | 600, `-0.02em` | "Skill gaps", "My resumes" |
| Card title | 22px | 600, `-0.02em` | "Is this your LinkedIn?" |
| Lead text | 17px | 400, `muted` | Text under a page title |
| Body | 15px | 400 | Most UI text |
| Small / caption | 13px | 400, `muted` | Hints, timestamps |
| Eyebrow | 12–15px | 500–600, brand colour | "Your profile", "NEXT BEST STEP" (12px caps, `0.08em` spacing) |

Numbers that line up (scores, counts) use tabular figures where possible.

## 4. Spacing and layout

- **Gutter:** 24px on the sides (`px-6`), 48px on large screens for headers (`md:px-12`).
- **Page padding:** 64px top (`pt-16`), 96px bottom (`pb-24`).
- **Max widths:** header 1344px · Home, Job, Match 1248px · Profile 1080px · Grow 1000px · Setup pages 760–920px · resume page 1440px.
- **Gaps:** use flex/grid `gap`, mostly 8 · 12 · 16 · 20 · 24 · 36 · 56px.
- **Card padding:** 24–40px (`p-6` to `p-10`), smaller cards 16–20px.
- Grids collapse to one column on phones; nothing scrolls sideways.

## 5. Shape

| Radius | Where |
|---|---|
| 9999px (pill) | Buttons, chips, badges, segmented controls, avatar |
| 14px | Text inputs and dropdowns |
| 16–18px | Small panels, list rows, error boxes |
| 22–26px | Cards and sections |
| 28–30px | Large feature panels, dialogs |

Shadows are soft and rare: `0 8px 30px rgba(0,0,0,0.08)` for floating cards. Use borders (`line`) for most cards instead of shadows.

## 6. Frosted glass

For anything that floats above the page (dropdown lists, account menu, template picker, dialogs):

- `.frost` — light glass for cards on a backdrop: card colour at 62%, blur 18px.
- `.frost-panel` — stronger glass for menus and dialogs: card colour at 84%, blur 28px, shadow `0 24px 80px rgba(0,0,0,0.18)`.

Dialogs sit on a `black/25–30` backdrop with a light blur.

## 7. Motion

- `.rise` — content fades up 12px over 0.6s when it appears. `.rise-fast` (0.18s) for menus.
- `.pulse-dot` — the live-AI status dot in the header (green = live AI on, amber = basic mode).
- Score rings count up over 0.9s.
- Everything respects `prefers-reduced-motion` (animations turn off).

## 8. Components (`src/components/`)

**Button** (`ui.tsx`) — always pill-shaped.

| Variant | Look | Use |
|---|---|---|
| `primary` | Purple, white text | The main action on a screen (one per area) |
| `secondary` | White, `hair` border | Other actions |
| `dark` | Ink, white text | Strong neutral action ("Regenerate", "Back to my resume") |
| `learn` | Teal | Actions on the Grow page |
| `ghost` | Grey `surface` | Quiet actions ("Back", "Not now", "Skip") |

Sizes: `sm` 36px · `md` 44px · `lg` 52px tall. Loading shows a spinner and disables the button.

**Inputs** — `.input`: 52px tall, `surface` fill, 14px radius, 17px text; on focus a 2px purple border and white fill. Labels sit above (14px, 500). Errors show as red text under the field with `role="alert"`.

**Dropdown** (`Dropdown.tsx`) — replaces native selects: a pill-ish input that opens a frosted list, keyboard friendly, with a search box for long lists (more than 10 options).

**Form fields** (`form.tsx`) — `SelectField` (with "Other…" to type your own), `YearField`, `MonthYearField` (with "Present"), `SkillPicker` (type-ahead).

**Chip** — pill, 14px text. Tones: `soft` (grey), `solid` (ink), `brand`, `learn`, `warn`, optional remove ×.

**Segmented** — grey pill track, white pill for the selected option. Used for filters and tabs.

**Status** — `StatusDot` (dot + word: Strong / Partial / Missing). `ScoreRing` (purple ring, big number, "out of 100").

**Feedback** — `Steps` (animated checklist while AI works), `ErrorBox` (red soft box + "Try again"), `EmptyState` (grey panel, title, one action), toasts (dark pill at the bottom, optional Undo).

**Layout** (`layout.tsx`) — `AppHeader` (sticky, white with 80% opacity + blur, logo, nav, status dot, theme toggle, "New resume", avatar menu), `SetupHeader` ("Step N of 4" + purple progress bar), the 4-step flow bar (Job → Match → Resume → Grow; the Grow step turns teal).

**Badges** — small pills, 12–13px, soft background + matching ink (e.g. "Auto-detected" in `brand-soft`/`brand-ink`, "Verified" in `ok-soft`/`ok`, "Optional" in `surface`/`muted`).

## 9. Themes

- Light is the default and comes back on every sign-in. The sun/moon button switches it (saved in the browser).
- Dark mode flips the tokens; never hard-code a colour that only works in one theme.
- The resume preview (`.paper`) and template thumbnails always stay a white page with dark text in both themes.

## 10. Resume templates (`src/lib/templates.ts`)

All six are one column, real text and standard section names so applicant tracking systems can read them.

| Template | Photo | Font | Accent | Notes |
|---|---|---|---|---|
| Classic | — | Sans | `#1d1d1f` | Black and white, grey rule under headings |
| Modern | — | Sans | `#1f3a5f` navy | Coloured headings and accent line |
| Traditional | — | Serif | `#1d1d1f` | Centered, compact |
| Professional | Left, rounded | Sans | `#1f3a5f` navy | |
| Corporate | Right, circle | Sans | `#0a5e6b` teal | Light band `#eef4f5` behind the header |
| Centered | Top center, circle | Sans | `#1d1d1f` | |

## 11. Logo

Files in `public/`: `nevora-mark.png` (the purple N with a spark), `nevora-wordmark.png` (NEVORA), `nevora-logo.png` (both). The wordmark is inverted automatically in dark mode. Use the files as they are; don't recolour or redraw them.

## 12. Writing (microcopy)

- Plain and short, written to the student: "Add your LinkedIn.", "Couldn't verify that certificate."
- Buttons say exactly what happens: "Upload LinkedIn PDF", "Add 3 to my profile", "Download PDF".
- Errors say what went wrong and what to do next. No blame, no jargon.
- Never claim something we didn't do; say when AI is off and what still works.

## 13. Accessibility checklist

- Real `<button>`, `<a>`, `<label>` and `<input>` elements; icon-only buttons get an `aria-label`.
- Visible focus ring: 2px purple outline, 2px offset.
- Text contrast at least 4.5:1 in both themes.
- Touch targets at least 36px (buttons `sm`), 44px for main actions.
- Live updates (`Steps`, toasts) use `role="status"`; errors use `role="alert"`.
