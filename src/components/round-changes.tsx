import { diffWords } from "diff";
import { CheckCircle2Icon } from "lucide-react";
import type { Channel, Flag } from "@/db/schema";
import { CHANNEL_FIELDS } from "@/lib/labels";
import { getRule } from "@/lib/rules/catalog";
import { timeAgo } from "@/lib/format";

type Comment = { id: number; authorName: string; body: string; createdAt: Date; flagId: number | null };
type Round = { number: number; fields: Record<string, string>; changeNote: string | null; flags: Flag[]; comments: Comment[] };

// What a reviewer needs on round 2+: which earlier flags are gone, what the submitter says
// they changed, and a word-level diff, so they re-read only what moved.
export function RoundChanges({ channel, previous, current }: { channel: Channel; previous: Round; current: Round }) {
  const fixed = countFixed(previous.flags, current.flags);
  const introduced = current.flags.length - (previous.flags.length - fixed);
  const changedFields = CHANNEL_FIELDS[channel].filter((field) => (previous.fields[field.key] ?? "") !== (current.fields[field.key] ?? ""));

  return (
    <section aria-labelledby="changes-title" className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="changes-title" className="font-semibold">
          What changed since round {previous.number}
        </h2>
        {previous.flags.length > 0 && (
          <p
            className={
              fixed === previous.flags.length
                ? "flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900"
                : "rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900"
            }
          >
            {fixed === previous.flags.length && <CheckCircle2Icon aria-hidden className="size-4" />}
            {fixed} of {previous.flags.length} round {previous.number} {previous.flags.length === 1 ? "flag" : "flags"} fixed
            {introduced > 0 && ` · ${introduced} new`}
          </p>
        )}
      </div>

      {current.changeNote && (
        <blockquote className="border-l-2 border-primary/50 pl-3 text-sm">
          <span className="block text-xs font-medium text-muted-foreground">Submitter&apos;s note</span>
          {current.changeNote}
        </blockquote>
      )}

      {changedFields.length === 0 ? (
        <p className="text-sm text-muted-foreground">The copy is unchanged from round {previous.number}.</p>
      ) : (
        <div className="space-y-3">
          {changedFields.map((field) => (
            <div key={field.key} className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{field.label}</p>
              <p className="rounded-lg bg-muted/40 p-3 leading-7 whitespace-pre-wrap break-words">
                {diffWords(previous.fields[field.key] ?? "", current.fields[field.key] ?? "").map((part, index) =>
                  part.added ? (
                    <ins key={index} className="rounded-sm bg-emerald-100 text-emerald-950 no-underline">
                      {part.value}
                    </ins>
                  ) : part.removed ? (
                    <del key={index} className="rounded-sm bg-red-50 text-red-800 decoration-red-500/70">
                      {part.value}
                    </del>
                  ) : (
                    <span key={index}>{part.value}</span>
                  ),
                )}
              </p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            <ins className="bg-emerald-100 no-underline">Added</ins> · <del className="bg-red-50 text-red-800">Removed</del>
          </p>
        </div>
      )}

      {previous.comments.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Round {previous.number} feedback ({previous.comments.length}, resolved)</summary>
          <ul className="mt-2 space-y-2">
            {previous.comments.map((comment) => {
              const flag = previous.flags.find((candidate) => candidate.id === comment.flagId);
              return (
                <li key={comment.id} className="rounded-lg bg-muted/40 p-3 text-muted-foreground">
                  {flag && <p className="text-xs font-medium">On: {getRule(flag.ruleId).title}</p>}
                  <p className="text-foreground/80">{comment.body}</p>
                  <p className="mt-1 text-xs">
                    {comment.authorName} · {timeAgo(comment.createdAt)} · <span className="font-medium">Resolved</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

// A flag counts as fixed when its rule no longer fires on the same field as many times.
function countFixed(before: Flag[], after: Flag[]) {
  const remaining = new Map<string, number>();
  for (const flag of after) remaining.set(`${flag.ruleId}:${flag.field}`, (remaining.get(`${flag.ruleId}:${flag.field}`) ?? 0) + 1);
  let fixed = 0;
  for (const flag of before) {
    const key = `${flag.ruleId}:${flag.field}`;
    const left = remaining.get(key) ?? 0;
    if (left > 0) remaining.set(key, left - 1);
    else fixed++;
  }
  return fixed;
}
