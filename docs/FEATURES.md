# Nevora feature checklist

The problem statement asks for five things: understand the job description, understand the
candidate, measure the fit **without inventing anything**, generate a tailored and
recruiter-friendly resume, and cut the manual effort. Every feature below was kept only if it
serves one of those goals and fits the minimal design.

## Kept (built)

| Area | Feature | Why it stays |
| --- | --- | --- |
| Account | Email/password and Google sign-in (Firebase Auth), password reset | One profile per person, synced across devices |
| Account | Demo account ("Explore the demo") | Lets judges and new users see the full flow without signing up. Kept in the browser only |
| Onboarding | 3-step setup: details → upload resume (PDF, DOCX or pasted text) → review | "Understand the candidate profile" with minimal typing |
| Onboarding | "Build from scratch" path | Students without a resume can still start |
| Profile | One editable profile: basics, education, projects, experience, skills, certifications, achievements, links | The single source of truth every resume is built from |
| Profile | Section status (done / needs attention) and the impact hint on bullets without numbers | Pushes students to add real evidence instead of the AI making it up |
| Profile | Certificate upload that fills the form (PDF or image) | Saves typing; the student confirms before saving |
| Job | Paste a JD → required, nice-to-have, soft skills, responsibilities (editable) | "Understand the job description" |
| Match | Weighted match score with breakdown and per-requirement evidence (Strong / Partial / Missing) | "Determine relevance", shown as proof, not a black-box number |
| Match | Score forecast ("your potential") | Shows the payoff of closing gaps |
| Resume | Tailored resume: reordering, rewording in the job's terms, irrelevant items left out (and one-click "add it back") | "Generate a tailored resume" |
| Resume | **Line-by-line fact check**: AI checker *and* a deterministic check (numbers and tools must appear in the source). Download stays locked until every line passes | The core "truthful" promise, enforced in code, not just in a prompt |
| Resume | "Why we changed this" panel | Teaches the student; builds trust |
| Resume | Click-to-edit lines (re-checked), section show/hide | Control without a heavy editor |
| Resume | **Text-based PDF** (selectable text, ATS-readable), copy as plain text | Fixes the old image-PDF problem |
| Resume | Cover letter from profile facts only, with [placeholders] the student must fill | Truthful, and blocks download until blanks are filled |
| Grow | Learning plan per gap (steps, free resources, mini-project, progress checkboxes) | "What to learn next" |
| Grow | Interview prep (5 questions with STAR answers from real projects) | Uses the same verified evidence |
| Grow | Bullet coach (XYZ formula) | Teaches better writing |
| Home | Profile strength, next best step, strengths and roles you already fit, saved resumes (open, rename, duplicate, delete with undo) | One place to come back to |
| Platform | Basic mode: if AI is down or not configured, everything still works using deterministic logic (never canned content) | Reliability, and no fabricated fallback |

## Cut (and why)

| Old feature | Decision |
| --- | --- |
| 12 resume templates | **Cut.** One clean single-column ATS layout. Fancy templates hurt ATS parsing and add choice paralysis |
| Adaptive intake interview | **Cut.** Replaced by `[add metric]` prompts and the profile impact hints: the student adds real numbers in one place, once |
| Separate "Resume Parser Agent" page | **Merged** into onboarding upload |
| Resume Analysis / diff view | **Merged** into the "Changes" panel next to the resume |
| Knowledge Base browser (TF-IDF RAG) | **Cut** as a page. The guidance (action verbs, XYZ formula, keyword placement) now lives in the prompts and the bullet coach |
| Settings (font, size, accent colour, paper size) | **Cut.** One typographically tuned A4 layout; fewer knobs, fewer broken resumes |
| User-supplied OpenRouter key in the browser | **Cut.** Keys stay on the server |
| Version snapshots | **Simplified.** Each tailored resume is saved per job; "Duplicate" covers versioning |
| Quality badges, hardcoded ATS / template / QA scores | **Cut.** Only measured numbers are shown (match score and verified-line count) |
| User testing metrics modal | **Cut.** Landing-page survey figures stay hidden until real results are filled in (`src/pages/Landing.tsx`) |
| Profile photo | **Cut.** Photos are discouraged on ATS resumes and invite bias |
| Server fallback with canned resume content | **Removed.** Fallbacks only reorder and reuse the student's own words |

## Fixed from the previous review

- Canned fallback content with fake employers: removed; basic mode derives everything from the profile.
- Image-only PDF export: replaced with a text PDF built with jsPDF.
- `/api/agent` had no auth or rate limiting: the new `/api/ai` requires a Firebase ID token, accepts only a fixed list of tasks with server-side prompts, caps input size, and rate-limits per user.
- Hardcoded scores: removed.
- Section layout ignored in some PDF paths: there is one PDF path and it honours hidden sections.
