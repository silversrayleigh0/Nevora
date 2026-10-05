# Nevora

**One profile. Every job.** Nevora tailors a student's resume to each job description, checks
that every line is backed by their profile, and shows what to learn next.

Built with React 19, TypeScript, Tailwind CSS 4, Firebase (Auth + Firestore) and an
authenticated serverless endpoint that calls Claude (with OpenRouter as a fallback). See [docs/FEATURES.md](docs/FEATURES.md)
for what is in scope and what was cut.

## How it works

```
Browser (React)                                   Vercel function /api/ai
 ├─ Profile, resumes  ── Firestore (owner-only) ─┐   ├─ verifies Firebase ID token
 ├─ Deterministic engine (scoring, fact check,   │   ├─ fixed task list, prompts live here
 │  basic-mode fallbacks)                        │   ├─ input caps + per-user rate limit
 ├─ pdf.js / mammoth text extraction             │   └─ Claude first, OpenRouter if Claude fails
 └─ jsPDF text-based export                      │
```

- **Truthfulness is enforced twice.** The AI fact-checker reviews every tailored line, and a
  deterministic check rejects any number or technology that isn't in the line's source. Download
  stays locked until every line passes.
- **Basic mode.** If AI isn't configured or is unavailable, every step still works using the
  deterministic engine. It reuses the student's own words and never invents content.
- **Proof, not claims.** Certificates are added by uploading the certificate image; the AI reads it
  and checks it is issued to the student. Experience entries ask for an offer or experience letter
  and show whether it checked out. Only verified certificates appear on resumes. (The image check
  catches mismatched names, wrong organisations and visible edits; it can't prove a document is
  genuine the way the issuer can.)
- **Sign-in.** Email/password or Google (Firebase Auth) are the only ways in. If a profile can't
  be loaded, saving is blocked so an empty profile never overwrites real data.

## Run locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY and/or OPENROUTER_API_KEY for Live AI
npm run dev                  # http://localhost:5173 (the /api/ai endpoint runs in the dev server)
```

Sign-in works out of the box against the `nevora-f6289` Firebase project. Without an AI key the app runs in basic mode (resume reading, matching and tailoring still work; document verification needs AI).

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_FIREBASE_*` | Browser | Optional. Overrides the Firebase web config in `shared/firebaseConfig.ts` (project `nevora-f6289`) |
| `ANTHROPIC_API_KEY` | Server only | Primary AI: Claude (`claude-opus-5-5` by default, override with `ANTHROPIC_MODEL`) |
| `OPENROUTER_API_KEY` | Server only | Fallback AI, used when Claude fails or isn't configured. Set a credit limit on the key |
| `OPENROUTER_MODEL`, `OPENROUTER_MODEL_QUICK`, `OPENROUTER_FALLBACK_MODELS` | Server | Optional model overrides |
| `FIREBASE_PROJECT_ID` | Server | Token verification (defaults to `nevora-f6289`) |
| `APP_URL`, `AI_REQUESTS_PER_HOUR` | Server | Attribution and per-user limit |

### Firebase setup

1. The web config for project `nevora-f6289` is in `shared/firebaseConfig.ts` (public identifiers).
2. **Authentication → Sign-in method:** enable *Email/Password* and *Google*. Under
   *Settings → Authorized domains* add your production domain.
3. **Firestore Database:** create it in production mode, then deploy the rules:
   `npx firebase-tools deploy --only firestore:rules --project nevora-f6289`.

### Deploy to Vercel

1. Import the repository in Vercel (framework preset: Vite).
2. Add `ANTHROPIC_API_KEY` and `OPENROUTER_API_KEY` (and any optional variables from `.env.example`) under *Project → Settings → Environment Variables*.
3. Deploy. `vercel.json` routes the SPA and gives `/api/ai` up to 300 seconds.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with the API |
| `npm run build` | Typecheck and production build |
| `npm test` | Unit tests (scoring, fact check, normalizers, API handler) |

## Project layout

```
api/ai.ts              Vercel function entry
api/_lib/              Auth, prompts, Claude and OpenRouter clients, rate limit, request handler
shared/types.ts        Data model shared by client and server
src/lib/               AI client, engine, normalizers, Firestore sync, PDF, file text extraction
src/pages/             Landing, Login, Setup, Home, Profile, Job → Match → Resume → Grow
firestore.rules        Owner-only access
```
