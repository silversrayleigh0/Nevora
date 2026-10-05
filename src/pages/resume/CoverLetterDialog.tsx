import { useEffect, useRef, useState } from "react";
import type { Application, CoverLetter } from "../../../shared/types";
import { CloseIcon } from "../../components/icons";
import { Button, ErrorBox, Segmented, Steps } from "../../components/ui";
import { coverLetter } from "../../lib/ai";
import { fileSafe, letterPdf } from "../../lib/pdf";
import { useApp } from "../../store/app";
import { toast } from "../../store/toast";

export default function CoverLetterDialog({ app, onClose }: { app: Application; onClose: () => void }) {
  const profile = useApp((s) => s.profile);
  const updateApplication = useApp((s) => s.updateApplication);
  const [tone, setTone] = useState<CoverLetter["tone"]>(app.coverLetter?.tone ?? "formal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const text = app.coverLetter?.text ?? "";
  const blanks = text.match(/\[[^\]]+\]/g) ?? [];

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const write = async () => {
    if (!profile || !app.jd) return;
    setBusy(true);
    setError("");
    try {
      updateApplication(app.id, { coverLetter: await coverLetter(profile, app.jd, tone) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Cover letter copied");
    } catch {
      toast("Copy was blocked. Select the text and copy it instead.");
    }
  };
  const download = async () => {
    try {
      await letterPdf(text, fileSafe(`${profile?.basics.name ?? "Cover"}_Cover_Letter_${app.jd?.company ?? app.name}`));
    } catch {
      setError("Couldn't create the PDF. Use Copy instead.");
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cl-title"
        className="rise flex max-h-[92vh] w-full max-w-[720px] flex-col gap-5 overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)] outline-none sm:rounded-[28px] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="cl-title" className="text-[28px] font-semibold tight">
              Cover letter
            </h2>
            <p className="mt-1 text-[15px] text-muted">For {[app.jd?.title, app.jd?.company].filter(Boolean).join(" at ")}. Built only from your profile.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface hover:bg-line">
            <CloseIcon />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Tone"
            value={tone}
            onChange={setTone}
            options={[
              { value: "formal", label: "Formal" },
              { value: "friendly", label: "Friendly" },
            ]}
          />
          <Button variant={text ? "secondary" : "primary"} onClick={write} loading={busy}>
            {text ? "Write again" : "Write my cover letter"}
          </Button>
        </div>
        {busy && <Steps steps={["Picking your strongest projects", "Connecting them to the job", "Writing in your voice"]} />}
        {error && <ErrorBox message={error} onRetry={write} />}
        {text && !busy && (
          <>
            {blanks.length > 0 && (
              <p className="rounded-2xl bg-metric/70 px-4 py-3 text-sm text-warn">
                Fill in {blanks.length === 1 ? "the part" : `${blanks.length} parts`} in brackets with your own words, like {blanks[0]}. Nevora never makes up your reasons.
              </p>
            )}
            <label htmlFor="cl-text" className="sr-only">
              Cover letter text
            </label>
            <textarea
              id="cl-text"
              value={text}
              rows={16}
              onChange={(e) => updateApplication(app.id, { coverLetter: { tone, text: e.target.value } })}
              className="input min-h-[360px] text-[15px] leading-relaxed"
            />
            <div className="flex flex-wrap justify-end gap-2.5">
              <Button variant="secondary" onClick={copy}>
                Copy
              </Button>
              <Button onClick={download} disabled={blanks.length > 0} title={blanks.length ? "Fill in the bracketed parts first" : "Download as PDF"}>
                Download
              </Button>
            </div>
          </>
        )}
        {!text && !busy && !error && (
          <p className="rounded-2xl bg-surface p-5 text-[15px] text-muted">
            Nevora writes a short letter that connects your real projects to what this job asks for. Pick a tone, then write it.
          </p>
        )}
      </div>
    </div>
  );
}
