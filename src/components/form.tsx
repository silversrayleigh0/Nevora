import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { SkillCategory } from "../../shared/types";
import { Dropdown } from "./Dropdown";
import { formatMonthYear, MONTHS, OTHER, parseMonthYear, SKILL_CATALOG, YEARS } from "../lib/options";

const Label = ({ htmlFor, label, optional }: { htmlFor: string; label: string; optional?: boolean }) => (
  <label htmlFor={htmlFor} className="text-sm font-medium">
    {label} {optional && <span className="font-normal text-muted">(optional)</span>}
  </label>
);

/** Dropdown with an "Other…" choice that reveals a text box for anything not listed. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Select",
  allowOther = true,
  optional,
  id,
  className = "",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  allowOther?: boolean;
  optional?: boolean;
  id?: string;
  className?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const listed = options.includes(value);
  const [typing, setTyping] = useState(Boolean(value) && !listed);
  const showOther = allowOther && (typing || (Boolean(value) && !listed));
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Label htmlFor={fid} label={label} optional={optional} />
      <Dropdown
        id={fid}
        value={showOther ? OTHER : value}
        placeholder={placeholder}
        options={[...options.map((o) => ({ value: o, label: o })), ...(allowOther ? [{ value: OTHER, label: "Other…" }] : [])]}
        onChange={(v) => {
          if (v === OTHER) {
            setTyping(true);
            onChange("");
          } else {
            setTyping(false);
            onChange(v);
          }
        }}
      />
      {showOther && (
        <input
          aria-label={`${label} (type it)`}
          className="input"
          autoFocus={typing && !value}
          placeholder={`Type your ${label.toLowerCase()}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export function YearField({ label, value, onChange, optional, id }: { label: string; value: string; onChange: (v: string) => void; optional?: boolean; id?: string }) {
  return <SelectField label={label} value={value} options={YEARS} onChange={onChange} placeholder="Year" allowOther={false} optional={optional} id={id} />;
}

/** Month + year pickers stored as "Jun 2025"; `allowPresent` adds a "Present" choice. */
export function MonthYearField({
  label,
  value,
  onChange,
  allowPresent,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowPresent?: boolean;
  id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const { month, year, present } = parseMonthYear(value);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fid} label={label} />
      <div className="flex gap-2">
        <Dropdown
          id={fid}
          ariaLabel={`${label} month`}
          className="flex-1"
          placeholder="Month"
          disabled={present}
          value={month}
          options={MONTHS.map((m) => ({ value: m, label: m }))}
          onChange={(m) => onChange(formatMonthYear(m, year))}
        />
        <Dropdown
          ariaLabel={`${label} year`}
          className="flex-1"
          placeholder="Year"
          value={present ? "present" : year}
          options={[...(allowPresent ? [{ value: "present", label: "Present" }] : []), ...YEARS.map((y) => ({ value: y, label: y }))]}
          onChange={(v) => onChange(v === "present" ? "Present" : formatMonthYear(month, v))}
        />
      </div>
    </div>
  );
}

/** Type-ahead skill picker; known skills come with their category. */
export function SkillPicker({ taken, onPick }: { taken: string[]; onPick: (name: string, category?: SkillCategory) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const lowerTaken = useMemo(() => new Set(taken.map((t) => t.toLowerCase())), [taken]);
  const q = query.trim().toLowerCase();
  const matches = SKILL_CATALOG.filter((s) => !lowerTaken.has(s.name.toLowerCase()) && (!q || s.name.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)))
    .slice(0, 8);
  const exact = SKILL_CATALOG.some((s) => s.name.toLowerCase() === q);
  const options = [...matches.map((m) => ({ ...m, custom: false })), ...(q && !exact && !lowerTaken.has(q) ? [{ name: query.trim(), category: undefined, custom: true }] : [])];

  const pick = (i: number) => {
    const o = options[i];
    if (!o) return;
    onPick(o.name, o.category);
    setQuery("");
    setActive(0);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={box} className="relative flex-1" onBlur={(e) => !box.current?.contains(e.relatedTarget as Node) && setOpen(false)}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        Add a skill
      </label>
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        className="input"
        placeholder="Search skills, e.g. React, SQL, Figma"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKey}
      />
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[56px] z-20 max-h-72 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
        >
          {options.map((o, i) => (
            <li key={`${o.name}-${o.custom}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[15px] ${i === active ? "bg-surface" : ""}`}
              >
                <span>{o.custom ? `Add “${o.name}”` : o.name}</span>
                {o.category && <span className="text-[13px] capitalize text-muted">{o.category}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
