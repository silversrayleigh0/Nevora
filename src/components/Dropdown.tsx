import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon } from "./icons";

export type Option = { value: string; label: string; hint?: string };

/**
 * Styled replacement for <select>: a button that opens a frosted list with
 * keyboard support (arrows, Enter, Escape, type to jump) and a search box for long lists.
 */
export function Dropdown({
  id,
  value,
  options,
  onChange,
  placeholder = "Select",
  disabled,
  ariaLabel,
  className = "",
}: {
  id?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const auto = useId();
  const listId = `${id ?? auto}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const searchable = options.length > 10;
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(i);
    requestAnimationFrame(() => {
      if (searchable) search.current?.focus();
      list.current?.querySelector(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }, [open, options, value, searchable]);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (o?: Option) => {
    if (!o) return;
    onChange(o.value);
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      return setOpen(true);
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(shown[active]);
    } else if (!searchable && e.key.length === 1) {
      const i = shown.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div ref={root} className={`relative ${className}`} onKeyDown={onKey}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`input flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${open ? "border-brand bg-card" : ""}`}
      >
        <span className={`truncate ${selected ? "" : "text-[#8e8e93]"}`}>{selected?.label ?? placeholder}</span>
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="frost-panel rise-fast absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl p-1.5">
          {searchable && (
            <input
              ref={search}
              aria-label="Search options"
              placeholder="Search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              className="mb-1 w-full rounded-xl bg-surface px-3 py-2 text-[15px] outline-none placeholder:text-[#8e8e93]"
            />
          )}
          <ul ref={list} id={listId} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">
            {shown.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-[15px] ${i === active ? "bg-surface" : ""} ${
                    isSelected ? "font-medium text-brand" : ""
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected ? <CheckIcon size={14} className="shrink-0" /> : o.hint ? <span className="shrink-0 text-[13px] text-muted">{o.hint}</span> : null}
                </li>
              );
            })}
            {!shown.length && <li className="px-3 py-2 text-[15px] text-muted">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
