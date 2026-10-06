import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Account, Profile } from "../../shared/types";
import { FileIcon, UploadIcon } from "../components/icons";
import { RequireSession, SetupHeader } from "../components/layout";
import { Button, ErrorBox, Steps, TextArea } from "../components/ui";
import { parseResume } from "../lib/ai";
import { isDocx, isPdf, MAX_UPLOAD_BYTES } from "../lib/extract";
import { emptyProfile } from "../lib/normalize";
import { useApp } from "../store/app";
import { useSetup } from "../store/setup";

/** Details typed in step 1 win over whatever the parser found. */
const withAccount = (p: Profile, a: Account | null): Profile => ({
  ...p,
  basics: {
    ...p.basics,
    name: a?.name || p.basics.name,
    email: a?.email || p.basics.email,
    phone: a?.phone || p.basics.phone,
    location: a?.city || p.basics.location,
  },
});

function Upload() {
  const navigate = useNavigate();
  const account = useApp((s) => s.account);
  const setProfile = useApp((s) => s.setProfile);
  const setFoundLinkedIn = useSetup((s) => s.setFoundLinkedIn);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const pick = (f?: File) => {
    setError("");
    if (!f) return;
    if (!isPdf(f) && !isDocx(f)) return setError("Choose a PDF or Word (.docx) file, or paste your resume text instead.");
    if (f.size > MAX_UPLOAD_BYTES) return setError("That file is over 5 MB. Try a smaller file.");
    setFile(f);
  };
  const analyze = async () => {
    setFoundLinkedIn(null);
    setBusy(true);
    setError("");
    try {
      const { profile, linkedIn } = await parseResume(pasting ? null : file, pasting ? text : "");
      setFoundLinkedIn(linkedIn);
      setProfile(withAccount(profile, account));
      navigate("/setup/review");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const fromScratch = () => {
    setFoundLinkedIn(null);
    setProfile(withAccount(emptyProfile(account?.name, account?.email), account));
    navigate("/setup/review");
  };
  const ready = pasting ? text.trim().length > 40 : Boolean(file);

  return (
    <main className="mx-auto flex max-w-[660px] flex-col gap-3 px-6 pb-24 pt-20">
      <p className="text-[15px] font-medium text-brand">Your resume</p>
      <h1 className="text-[40px] font-semibold tight md:text-5xl">Add your current resume.</h1>
      <p className="text-[17px] leading-relaxed text-muted">Nevora reads it and organizes everything into your profile. You can edit anything afterwards.</p>
      {pasting ? (
        <TextArea
          className="mt-8"
          label="Paste your resume text"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Copy everything from your resume and paste it here."
        />
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`mt-8 flex h-[250px] flex-col items-center justify-center gap-2.5 rounded-[26px] border-[1.5px] border-dashed transition ${
            dragging ? "border-brand bg-brand-soft" : "border-[#C7C7CC] bg-[#FBFBFD]"
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
            <UploadIcon />
          </span>
          <p className="mt-1.5 text-[19px] font-semibold">Drop your resume here</p>
          <p className="text-sm text-muted">PDF or Word, up to 5 MB</p>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
            className="sr-only"
            id="resume-file"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => input.current?.click()}>
            Choose file
          </Button>
        </div>
      )}
      <button
        type="button"
        className="self-start text-[15px] text-brand hover:text-brand-hover"
        onClick={() => {
          setPasting(!pasting);
          setError("");
        }}
      >
        {pasting ? "Upload a file instead" : "Paste text instead"}
      </button>
      {(file && !pasting) || busy ? (
        <div className="mt-2 flex flex-col gap-5 rounded-[22px] bg-surface px-6 py-6">
          {file && !pasting && (
            <div className="flex items-center gap-3.5">
              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-white text-muted">
                <FileIcon />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{file.name}</div>
                <div className="mt-0.5 text-[13px] text-muted">
                  {Math.round(file.size / 1024)} KB · {busy ? "Analyzing…" : "Ready"}
                </div>
              </div>
              {!busy && (
                <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setFile(null)}>
                  Remove
                </button>
              )}
            </div>
          )}
          {busy && <Steps steps={["Reading your resume", "Finding your projects and experience", "Organizing your skills", "Checking what’s missing"]} />}
        </div>
      ) : null}
      {error && <ErrorBox message={error} onRetry={ready ? analyze : undefined} />}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={fromScratch} className="text-base text-brand hover:text-brand-hover">
          No resume? Build from scratch
        </button>
        <Button size="lg" onClick={analyze} disabled={!ready} loading={busy}>
          {busy ? "Analyzing" : "Continue"}
        </Button>
      </div>
    </main>
  );
}

export default function SetupUpload() {
  return (
    <RequireSession needProfile={false}>
      <SetupHeader step={2} />
      <Upload />
    </RequireSession>
  );
}
