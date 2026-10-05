import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Link } from "react-router";
import type { MatchStatus } from "../../shared/types";
import { CheckIcon, CloseIcon, Spinner } from "./icons";

// ---------- Button ----------

const VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "bg-white text-ink border border-hair hover:bg-surface",
  dark: "bg-ink text-white hover:bg-black",
  learn: "bg-learn text-white hover:bg-learn-hover",
  ghost: "bg-surface text-ink hover:bg-line",
};
const SIZES = { sm: "h-9 px-4 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-[52px] px-8 text-[17px]" };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  href?: string;
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", href, loading, children, className = "", disabled, ...rest }: ButtonProps) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:border-transparent ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (href)
    return (
      <Link to={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type="button" className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

// ---------- Fields ----------

type FieldExtras = { label: string; hint?: string; optional?: boolean; hideLabel?: boolean };
const fieldId = (label: string, id?: string) => id ?? `f-${label.toLowerCase().replace(/\W+/g, "-")}`;

function FieldShell({ id, label, hint, optional, hideLabel, className = "", children }: FieldExtras & { id: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm font-medium"}>
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

export function TextField({ label, hint, optional, hideLabel, id, className, ...rest }: FieldExtras & InputHTMLAttributes<HTMLInputElement>) {
  const fid = fieldId(label, id);
  return (
    <FieldShell id={fid} label={label} hint={hint} optional={optional} hideLabel={hideLabel} className={className}>
      <input id={fid} className="input" {...rest} />
    </FieldShell>
  );
}

export function TextArea({ label, hint, optional, hideLabel, id, className, ...rest }: FieldExtras & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fid = fieldId(label, id);
  return (
    <FieldShell id={fid} label={label} hint={hint} optional={optional} hideLabel={hideLabel} className={className}>
      <textarea id={fid} className="input" {...rest} />
    </FieldShell>
  );
}

// ---------- Chips and toggles ----------

const CHIP_TONES = {
  soft: "bg-surface text-ink",
  solid: "bg-ink text-white",
  white: "bg-white text-ink",
  brand: "bg-brand-soft text-brand-ink",
  learn: "bg-learn-soft text-learn-ink",
  warn: "bg-warn-soft text-warn",
};

export function Chip({ children, tone = "soft", onRemove, className = "" }: { children: ReactNode; tone?: keyof typeof CHIP_TONES; onRemove?: () => void; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${CHIP_TONES[tone]} ${className}`}>
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${typeof children === "string" ? children : "item"}`}
          className="-mr-1 rounded-full p-0.5 opacity-60 hover:opacity-100"
        >
          <CloseIcon size={12} />
        </button>
      )}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-[34px] flex-1 whitespace-nowrap rounded-full px-4 text-sm transition ${
            o.value === value ? "bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)]" : "text-ink/80 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Feedback ----------

/** Animated checklist shown while work happens. */
export function Steps({ steps }: { steps: string[] }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCurrent((c) => Math.min(c + 1, steps.length - 1)), 1400);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="flex flex-col gap-3 text-[15px]" role="status" aria-live="polite">
      {steps.map((s, i) => (
        <div key={s} className={`flex items-center gap-3 ${i > current ? "text-muted" : ""} ${i === current ? "font-medium" : ""}`}>
          <span className="flex h-[18px] w-[18px] items-center justify-center">
            {i < current ? (
              <CheckIcon size={18} className="text-ok" />
            ) : i === current ? (
              <span className="text-brand">
                <Spinner size={13} />
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-hair" />
            )}
          </span>
          {s}
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl bg-bad-soft px-5 py-4 text-[15px] text-bad">
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[28px] bg-surface px-8 py-16 text-center">
      <h2 className="text-2xl font-semibold tight">{title}</h2>
      <p className="max-w-md text-muted">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ---------- Scores ----------

export function ScoreRing({ score, size = 220, stroke = 12, color = "var(--color-brand)", label = "out of 100" }: { score: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(score);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(score * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} ${label}`}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E5EA" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold leading-none tracking-[-0.05em]" style={{ fontSize: size * 0.33 }}>
          {shown}
        </span>
        {size >= 120 && <span className="mt-1 text-sm text-muted">{label}</span>}
      </div>
    </div>
  );
}

const STATUS = {
  strong: { label: "Strong", dot: "bg-ok-dot", text: "text-ok" },
  partial: { label: "Partial", dot: "bg-warn-dot", text: "text-warn" },
  missing: { label: "Missing", dot: "bg-bad-dot", text: "text-bad" },
};

export function StatusDot({ status }: { status: MatchStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-2 text-sm ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export const scoreDot = (score: number) => (score >= 70 ? "bg-ok-dot" : score >= 50 ? "bg-warn-dot" : "bg-bad-dot");

/** Highlights [placeholders] the student still needs to fill in. */
export function Placeholders({ text, className = "rounded bg-metric px-1" }: { text: string; className?: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).map((part, i) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <mark key={i} className={className}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
