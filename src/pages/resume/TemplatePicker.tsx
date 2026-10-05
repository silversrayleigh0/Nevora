import { useEffect, useRef } from "react";
import { Link } from "react-router";
import type { TemplateId } from "../../../shared/types";
import { CheckIcon, CloseIcon } from "../../components/icons";
import { TEMPLATES, type TemplateSpec } from "../../lib/templates";

/** A miniature page that shows the template's layout at a glance. */
export function TemplateThumb({ spec, photo }: { spec: TemplateSpec; photo?: string }) {
  const accent = spec.accent;
  const center = spec.align === "center" || spec.photo === "center";
  const line = (w: string, key?: string) => <div key={key} className="h-[3px] rounded-full bg-[#e5e5ea]" style={{ width: w }} />;
  const heading = (key: string) => (
    <div key={key} className="mt-1.5 flex flex-col gap-[3px]">
      <div className="h-[4px] w-[34%] rounded-full" style={{ background: accent === "#1d1d1f" ? "#3a3a3c" : accent }} />
      {spec.heading !== "plain" && <div className="h-px w-full" style={{ background: spec.heading === "accent" ? accent : "#d2d2d7" }} />}
    </div>
  );
  const photoEl = spec.photo ? (
    photo ? (
      <img src={photo} alt="" className="h-7 w-7 shrink-0 object-cover" style={{ borderRadius: spec.photoShape === "circle" ? 999 : 5 }} />
    ) : (
      <div className="h-7 w-7 shrink-0 bg-[#d9d9df]" style={{ borderRadius: spec.photoShape === "circle" ? 999 : 5 }} />
    )
  ) : null;
  return (
    <div className="paper flex aspect-[0.72] w-full flex-col gap-[3px] overflow-hidden rounded-md bg-white p-3 shadow-[0_6px_20px_rgba(0,0,0,0.08)]" aria-hidden="true">
      <div
        className={`flex gap-2 ${spec.photo === "center" ? "flex-col items-center" : spec.photo === "right" ? "flex-row-reverse items-center" : "items-center"} ${spec.band ? "-mx-3 -mt-3 px-3 pb-2 pt-3" : ""}`}
        style={spec.band ? { background: spec.band } : undefined}
      >
        {photoEl}
        <div className={`flex flex-1 flex-col gap-[3px] ${center ? "items-center" : ""}`}>
          <div className="h-[6px] w-[58%] rounded-full" style={{ background: accent === "#1d1d1f" ? "#1d1d1f" : accent }} />
          <div className="h-[3px] w-[80%] rounded-full bg-[#c7c7cc]" />
        </div>
      </div>
      {heading("h1")}
      {line("96%", "l1")}
      {line("88%", "l2")}
      {heading("h2")}
      {line("92%", "l3")}
      {line("84%", "l4")}
      {line("70%", "l5")}
      {heading("h3")}
      {line("90%", "l6")}
      {line("60%", "l7")}
    </div>
  );
}

export default function TemplatePicker({ value, photo, onPick, onClose }: { value: TemplateId; photo?: string; onPick: (id: TemplateId) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const group = (title: string, note: string, items: TemplateSpec[]) => (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <p className="text-[13px] text-muted">{note}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((t) => {
          const on = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(t.id)}
              className={`frost group flex flex-col gap-3 rounded-[22px] p-3.5 text-left transition hover:-translate-y-0.5 ${on ? "ring-2 ring-brand" : ""}`}
            >
              <div className="relative">
                <TemplateThumb spec={t} photo={photo} />
                {on && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white shadow">
                    <CheckIcon size={13} />
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold">{t.name}</span>
                  <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">ATS-friendly</span>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-muted">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <div
      className="no-print fixed inset-0 z-40 flex items-end justify-center bg-black/25 p-0 backdrop-blur-md sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpl-title"
        className="frost-panel rise flex max-h-[92vh] w-full max-w-[920px] flex-col gap-6 overflow-y-auto rounded-t-[28px] p-6 outline-none sm:rounded-[28px] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="tpl-title" className="text-[28px] font-semibold tight">
              Choose a template
            </h2>
            <p className="mt-1 text-[15px] text-muted">All six use one column, real text and standard section names, so applicant tracking systems read them correctly.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface hover:bg-line">
            <CloseIcon />
          </button>
        </div>
        {group(
          "Without photo",
          "Recommended for most companies, especially in the US, UK and for big-tech applications.",
          TEMPLATES.filter((t) => !t.photo),
        )}
        {group(
          "With photo",
          "Use where a photo is expected, such as campus placements in India, Europe and the Middle East.",
          TEMPLATES.filter((t) => t.photo),
        )}
        {!photo && (
          <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand-ink">
            Photo templates need a profile photo.{" "}
            <Link to="/profile#basics" className="font-semibold underline-offset-2 hover:underline">
              Add one in your profile ›
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
