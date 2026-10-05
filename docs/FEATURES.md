# Nevora feature checklist

The problem statement asks for five things: understand the job description, understand the
candidate, measure the fit **without inventing anything**, generate a tailored and
recruiter-friendly resume, and cut the manual effort. Every feature below was kept only if it
serves one of those goals and fits the minimal design.

## Kept (built)

| Area | Feature | Why it stays |
| --- | --- | --- |
| Account | Email/password and Google sign-in (Firebase Auth), password reset. These are the only ways in | One profile per person, synced across devices |
| Onboarding | 3-step setup: details → upload resume (PDF, DOCX or pasted text) → review | "Understand the candidate profile" with minimal typing |
| Onboarding | "Build from scratch" path | Students without a resume can still start |
| Profile | One editable profile: basics, education, projects, experience, skills, certifications, achievements, links | The single source of truth every resume is built from |
| Profile | Section status (done / needs attention) and the impact hint on bullets without numbers | Pushes students to add real evidence instead of the AI making it up |
| Profile | Dropdowns for degree, branch, years and dates (with "Other…"), and a searchable skill picker that sorts skills into categories | Faster, consistent entries |
| Profile | **Certificates by image only**: upload a photo/scan/PDF; the AI reads it and checks it's issued to the student. Only verified certificates appear on resumes | No typed-in credentials to fake |
| Profile | **Proof for experience**: upload an offer/internship/experience letter; the AI checks name, organisation, role and dates | Recruiter trust; clearing a field after verification resets the check |
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
| Platform | Claude as the primary AI, OpenRouter as automatic fallback | Quality first, still answers if one provider fails |
| Platform | Basic mode: if AI is down or not configured, everything still works using deterministic logic, including a local resume reader (never canned content) | Reliability, and no fabricated fallback |

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
| Version snapshots | **Built.** Generated, edited and downloaded versions are kept per resume, named by job role |
| Quality badges, hardcoded ATS / template / QA scores | **Cut.** Only measured numbers are shown (match score and verified-line count) |
| User testing metrics modal | **Cut.** Landing-page survey figures stay hidden until real results are filled in (`src/pages/Landing.tsx`) |
| Profile photo | **Optional.** Used only by the three photo templates; the three no-photo templates are recommended |
| Demo account | **Cut.** Email/password and Google are the only ways in |
| Server fallback with canned resume content | **Removed.** Fallbacks only reorder and reuse the student's own words |

## Fixed from the previous review

- Canned fallback content with fake employers: removed; basic mode derives everything from the profile.
- Image-only PDF export: replaced with a text PDF built with jsPDF.
- `/api/agent` had no auth or rate limiting: the new `/api/ai` requires a Firebase ID token, accepts only a fixed list of tasks with server-side prompts, caps input size, and rate-limits per user.
- Hardcoded scores: removed.
- Section layout ignored in some PDF paths: there is one PDF path and it honours hidden sections.

## LinkedIn import and course recommendations

Flow: setup step 4 (or Profile / Grow) → upload the LinkedIn "Save to PDF" export → compare with the profile → add missing skills, experience and certifications → Grow suggests courses for the remaining gaps → save or open them.

- **No LinkedIn login.** A short 3-step guide shows how to download the PDF (Me → View profile → Resources → Save to PDF).
- **Token use:** the PDF is read in the browser with a parser for LinkedIn's fixed layout, so most imports cost no AI tokens. Only if that finds nothing is Claude asked (`parseLinkedIn`, low effort, skills/experience/certifications only, 12k characters max).
- **Compare:** anything already on the profile is skipped (skill aliases like React / React.js, same company and role, same certificate). Skills that close a gap for the current job come first. Imported certificates stay off resumes until their image is verified.
- **Courses:** one Claude web-search call per resume covers every gap (up to 4 skills, at most 3 searches, low effort), cached on the resume. The server keeps only courses whose URL appeared in the search results. Without Claude, each gap shows search links on Coursera, edX, freeCodeCamp, YouTube and Udemy. Saved courses live on the account.
- Tests use mocked providers only; no live web searches.
