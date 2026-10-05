import type { Profile, TailoredBullet, TailoredResume, Verification } from "../../../shared/types";
import { CheckIcon, ShieldIcon } from "../../components/icons";
import { Button } from "../../components/ui";
import { sourceLabel } from "../../lib/engine";

export function verificationSummary(resume: TailoredResume, verifications: Verification[] | null) {
  const bullets = resume.sections.flatMap((s) => s.items.flatMap((i) => i.bullets));
  const find = (id: string) => verifications?.find((v) => v.bulletId === id);
  return {
    total: bullets.length,
    ok: bullets.filter((b) => find(b.id)?.supported).length,
    bad: bullets.filter((b) => find(b.id) && !find(b.id)!.supported),
    pending: bullets.filter((b) => !find(b.id)),
    bullets,
  };
}

export function ChangesPanel({ resume }: { resume: TailoredResume }) {
  const changed = resume.sections
    .flatMap((s) => s.items.flatMap((i) => i.bullets.map((b) => ({ b, where: i.heading.split(" — ")[0] }))))
    .filter(({ b }) => b.originalText && b.text !== b.originalText.replace(/\.$/, ""));
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13px] text-muted">Why we changed this</p>
      {changed.map(({ b, where }) => (
        <div key={b.id} className="flex flex-col gap-1.5 rounded-2xl bg-surface p-4">
          <span className="text-xs text-muted">{where}</span>
          <p className="text-sm text-muted line-through">{b.originalText}</p>
          <p className="text-sm font-medium">{b.text}</p>
          <p className="text-[13px] leading-snug text-brand-ink">{b.changeReason}</p>
        </div>
      ))}
      {resume.orderNotes.map((n) => (
        <div key={n.change} className="flex flex-col gap-1.5 rounded-2xl bg-surface p-4">
          <span className="text-xs text-muted">Order</span>
          <p className="text-sm font-medium">{n.change}</p>
          <p className="text-[13px] leading-snug text-brand-ink">{n.reason}</p>
        </div>
      ))}
      {!changed.length && !resume.orderNotes.length && <p className="text-sm text-muted">No wording changes — your lines already fit this job.</p>}
    </div>
  );
}

export function VerifiedPanel({
  resume,
  profile,
  verifications,
  checking,
  onRemove,
  onRecheck,
}: {
  resume: TailoredResume;
  profile: Profile;
  verifications: Verification[] | null;
  checking: boolean;
  onRemove: (id: string) => void;
  onRecheck: () => void;
}) {
  const { total, ok, bad, pending, bullets } = verificationSummary(resume, verifications);
  const allGood = !bad.length && !pending.length;
  const issue = (b: TailoredBullet) => verifications?.find((v) => v.bulletId === b.id)?.issue;
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${allGood ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
          <ShieldIcon />
        </span>
        <div>
          <div className="text-lg font-semibold">{checking ? "Checking every line…" : `${ok} of ${total} lines verified`}</div>
          <div className="mt-0.5 text-[13px] text-muted">Every line is checked against your profile.</div>
        </div>
      </div>
      {bad.map((b) => (
        <div key={b.id} className="flex flex-col gap-2.5 rounded-2xl bg-bad-soft p-4">
          <p className="text-sm font-semibold text-[#9A0015]">Not found in your profile</p>
          <p className="text-sm">“{b.text}”</p>
          {issue(b) && <p className="text-[13px] leading-snug text-muted">{issue(b)}</p>}
          <div className="flex gap-2">
            <Button variant="dark" size="sm" onClick={() => onRemove(b.id)}>
              Remove line
            </Button>
            <Button variant="secondary" size="sm" href="/new/grow">
              Learn it instead
            </Button>
          </div>
        </div>
      ))}
      {pending.length > 0 && !checking && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-warn-soft p-4 text-sm text-warn">
          <span>
            {pending.length} edited line{pending.length > 1 ? "s" : ""} not checked yet.
          </span>
          <Button variant="secondary" size="sm" onClick={onRecheck}>
            Check now
          </Button>
        </div>
      )}
      {!allGood && <p className="text-[13px] text-muted">Download is paused until every line is verified.</p>}
      <ul>
        {bullets
          .filter((b) => verifications?.find((v) => v.bulletId === b.id)?.supported)
          .map((b) => (
            <li key={b.id} className="flex items-start gap-2.5 border-t border-[#EDEDF0] py-3">
              <CheckIcon className="mt-0.5 shrink-0 text-ok" />
              <div>
                <p className="text-sm">{b.text}</p>
                <p className="mt-0.5 text-xs text-muted">From: {[...new Set(b.sourceIds.map((id) => sourceLabel(profile, id)))].join(", ")}</p>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}
