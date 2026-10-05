# Nevora

**One profile. Every job.** Nevora tailors a student's resume to each job description, checks
that every line is backed by their profile, and shows what to learn next.

Built with React 19, TypeScript, Tailwind CSS 4, Firebase (Auth + Firestore) and an
authenticated serverless endpoint that calls OpenRouter. See [docs/FEATURES.md](docs/FEATURES.md)
for what is in scope and what was cut.

## How it works

```
Browser (React)                                   Vercel function /api/ai
 ├─ Profile, resumes  ── Firestore (owner-only) ─┐   ├─ verifies Firebase ID token
 ├─ Deterministic engine (scoring, fact check,   │   ├─ fixed task list, prompts live here
 │  basic-mode fallbacks)                        │   ├─ input caps + per-user rate limit
 ├─ pdf.js / mammoth text extraction             │   └─ OpenRouter (JSON mode, 1 retry)
 └─ jsPDF text-based export                      │
```

- **Truthfulness is enforced twice.** The AI fact-checker reviews every tailored line, and a
  deterministic check rejects any number or technology that isn't in the line's source. Download
  stays locked until every line passes.
- **Basic mode.** If AI isn't configured or is unavailable, every step still works using the
  deterministic engine. It reuses the student's own words and never invents content.
- **Demo account.** "Explore the demo" loads a sample student in the browser only.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:5173 (the /api/ai endpoint runs in the dev server)
```

Without any keys the demo account and basic mode still work.

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | Browser | Firebase web app config (public identifiers) |
| `OPENROUTER_API_KEY` | Server only | AI calls. Set a credit limit on the key |
| `OPENROUTER_MODEL`, `OPENROUTER_MODEL_QUICK`, `OPENROUTER_FALLBACK_MODELS` | Server | Optional model overrides |
| `FIREBASE_PROJECT_ID` | Server | Token verification (defaults to the `VITE_` value) |
| `APP_URL`, `AI_REQUESTS_PER_HOUR` | Server | Attribution and per-user limit |

### Firebase setup

1. Create a project at <https://console.firebase.google.com> and add a **Web app**; copy its config
   into the `VITE_FIREBASE_*` variables.
2. **Authentication → Sign-in method:** enable *Email/Password* and *Google*. Under
   *Settings → Authorized domains* add your production domain.
3. **Firestore Database:** create it in production mode, then deploy the rules:
   `npx firebase-tools deploy --only firestore:rules --project <project-id>`.

### Deploy to Vercel

1. Import the repository in Vercel (framework preset: Vite).
2. Add all variables from `.env.example` under *Project → Settings → Environment Variables*.
3. Deploy. `vercel.json` routes the SPA and gives `/api/ai` up to 60 seconds.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with the API |
| `npm run build` | Typecheck and production build |
| `npm test` | Unit tests (scoring, fact check, normalizers, API handler) |

## Project layout

```
api/ai.ts              Vercel function entry
api/_lib/              Auth, prompts, OpenRouter client, rate limit, request handler
shared/types.ts        Data model shared by client and server
src/lib/               AI client, engine, normalizers, Firestore sync, PDF, file text extraction
src/pages/             Landing, Login, Setup, Home, Profile, Job → Match → Resume → Grow
firestore.rules        Owner-only access
```
