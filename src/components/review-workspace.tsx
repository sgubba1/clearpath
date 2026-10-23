"use client";

import { MessageSquarePlusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { decide, type DecisionState } from "@/app/queue/actions";
import { AdPreview, type PreviewFlag } from "@/components/ad-preview";
import { AiSecondOpinion } from "@/components/ai-second-opinion";
import { SEVERITY_BADGE } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Channel, Flag, Product } from "@/db/schema";
import { CHANNEL_FIELDS } from "@/lib/labels";
import { getRule, REVIEWER_CHECKLIST } from "@/lib/rules/catalog";
import { cn } from "@/lib/utils";

type Props = {
  submissionId: number;
  product: Product;
  channel: Channel;
  fields: Record<string, string>;
  flags: Flag[];
  submitterName: string;
  canDecide: boolean;
  rateTerms: string;
  aiEnabled: boolean;
};

export function ReviewWorkspace({ submissionId, product, channel, fields, flags, submitterName, canDecide, rateTerms, aiEnabled }: Props) {
  const [state, formAction, pending] = useActionState<DecisionState, FormData>(decide, { errors: {} });
  const [activeFlagId, setActiveFlagId] = useState<number>();
  const [commenting, setCommenting] = useState<Set<number>>(new Set());
  // Controlled so typed feedback survives a validation error (React resets uncontrolled fields after an action).
  const [flagComments, setFlagComments] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const errors = state.errors;
  // While deciding, flags already judged acceptable drop out; afterwards, show everything found at submission.
  const openFlags = canDecide ? flags.filter((flag) => flag.status !== "dismissed") : flags;
  // One reason usually covers every flag (it's asked once at submit), so show it once.
  const reasons = [...new Set(openFlags.map((flag) => flag.reason).filter(Boolean))];
  const sharedReason = reasons.length === 1 && openFlags.every((flag) => flag.reason === reasons[0]) ? reasons[0] : undefined;
  const firstName = submitterName.split(" ")[0];
  const pendingComments = Object.values(flagComments).filter((body) => body.trim()).length + (note.trim() ? 1 : 0);
  const fieldLabel = (key: string) => CHANNEL_FIELDS[channel].find((field) => field.key === key)?.label ?? key;

  const previewFlags: PreviewFlag[] = openFlags.map((flag) => ({
    id: flag.id,
    field: flag.field,
    start: flag.start,
    end: flag.end,
    severity: flag.severity,
    ruleId: flag.ruleId,
  }));

  function focusFlag(id: number, from: "ad" | "list") {
    setActiveFlagId(id);
    const target = document.getElementById(from === "ad" ? `flag-${id}` : `mark-${id}`);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const checklist = (
    <section aria-labelledby="checklist-title" className="rounded-xl border bg-card p-5">
      <h2 id="checklist-title" className="font-semibold">
        Judgment calls
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">The pre-check can&apos;t judge these. Worth a look on every ad.</p>
      <ul className="mt-3 space-y-2">
        {REVIEWER_CHECKLIST.map((item) => (
          <li key={item}>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={checked.has(item)}
                onChange={() => {
                  const next = new Set(checked);
                  if (next.has(item)) next.delete(item);
                  else next.add(item);
                  setChecked(next);
                }}
                className="mt-0.5 size-4 accent-primary"
              />
              {item}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    // Desktop: the ad, judgment calls and decision read top to bottom on the left, flags on the right.
    // Phones: ad, flags, judgment calls, decision. One copy of each, so no field is submitted twice.
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_auto_1fr] lg:items-start">
      <input type="hidden" name="id" value={submissionId} />

      <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
        <AdPreview channel={channel} fields={fields} flags={previewFlags} activeFlagId={activeFlagId} onFlagClick={(id) => focusFlag(id, "ad")} />
        <p className="rounded-lg bg-muted/60 px-4 py-2.5 text-sm">
          <span className="font-medium">Rate sheet:</span> {rateTerms}
        </p>
      </div>

      <div className="space-y-4 lg:col-start-2 lg:row-span-3 lg:row-start-1">
        <section aria-labelledby="flags-title" className="rounded-xl border bg-card p-5">
          <h2 id="flags-title" className="font-semibold">
            {canDecide
              ? openFlags.length
                ? `${openFlags.length} flagged by pre-check`
                : "Pre-check found no issues"
              : openFlags.length
                ? `${openFlags.length} flagged at submission`
                : "At submission, the pre-check found no issues"}
          </h2>
          {sharedReason && (
            <blockquote className="mt-3 border-l-2 border-amber-400 bg-amber-50 py-2 pr-3 pl-3 text-sm text-amber-950">
              <span className="block text-xs font-medium">
                {submitterName} sent it with {openFlags.length === 1 ? "this issue" : `these ${openFlags.length} issues`} open:
              </span>
              &ldquo;{sharedReason}&rdquo;
            </blockquote>
          )}
          {openFlags.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {openFlags.map((flag) => {
                const rule = getRule(flag.ruleId);
                const missing = flag.start === flag.end;
                const isCommenting = commenting.has(flag.id);
                return (
                  <li
                    key={flag.id}
                    id={`flag-${flag.id}`}
                    className={cn("rounded-lg border p-3 text-sm transition-colors", activeFlagId === flag.id && "border-foreground/40 bg-muted/40")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{rule.title}</p>
                      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold", SEVERITY_BADGE[flag.severity])}>
                        {flag.severity === "high" ? "High" : flag.severity === "medium" ? "Medium" : "Low"}
                      </span>
                    </div>
                    <button type="button" onClick={() => focusFlag(flag.id, "list")} className="mt-1 text-left underline-offset-2 hover:underline">
                      {missing ? (
                        <span className="text-muted-foreground">Missing from {fieldLabel(flag.field).toLowerCase()}</span>
                      ) : (
                        <>
                          <span className="text-muted-foreground">{fieldLabel(flag.field)}: </span>&ldquo;{flag.matchText}&rdquo;
                        </>
                      )}
                    </button>
                    {flag.detail && <p className="mt-1 text-muted-foreground">{flag.detail}</p>}
                    <details className="mt-1 text-xs text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground">Rule and source</summary>
                      <p className="mt-1 text-foreground">{rule.whyItMatters}</p>
                      {rule.sourceUrl && (
                        <a href={rule.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline-offset-2 hover:text-foreground hover:underline">
                          {rule.regulation}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      )}
                    </details>

                    {flag.reason && !sharedReason && (
                      <blockquote className="mt-2 border-l-2 border-amber-400 bg-amber-50 py-1.5 pr-2 pl-2.5 text-amber-950">
                        <span className="text-xs font-medium">{submitterName} sent it anyway:</span> &ldquo;{flag.reason}&rdquo;
                      </blockquote>
                    )}

                    {canDecide &&
                      (isCommenting ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <Label htmlFor={`flagComment.${flag.id}`} className="text-xs">
                              Comment for {firstName}
                            </Label>
                            <button
                              type="button"
                              onClick={() => {
                                const next = new Set(commenting);
                                next.delete(flag.id);
                                setCommenting(next);
                                setFlagComments({ ...flagComments, [flag.id]: "" });
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Remove
                            </button>
                          </div>
                          <Textarea
                            id={`flagComment.${flag.id}`}
                            name={`flagComment.${flag.id}`}
                            rows={2}
                            autoFocus
                            value={flagComments[flag.id] ?? ""}
                            onChange={(e) => setFlagComments({ ...flagComments, [flag.id]: e.target.value })}
                            placeholder={rule.fixHint}
                            className="bg-background"
                            aria-describedby={`flagComment.${flag.id}-help`}
                          />
                          <p id={`flagComment.${flag.id}-help`} className="text-xs text-muted-foreground">
                            Sent to {firstName} with your decision below.
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCommenting(new Set(commenting).add(flag.id))}
                          className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <MessageSquarePlusIcon aria-hidden className="size-3.5" />
                          Comment on this flag
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
          ) : (
            canDecide && <p className="mt-1 text-sm text-muted-foreground">Check the judgment calls, then approve if it reads right.</p>
          )}
          <div className="mt-4">
            <AiSecondOpinion enabled={aiEnabled} input={{ product, channel, fields }} fieldLabel={fieldLabel} />
          </div>
        </section>
      </div>

      {/* Judgment calls matter before a decision, not after. */}
      {canDecide && <div className="min-w-0 lg:col-start-1 lg:row-start-2">{checklist}</div>}

      {canDecide && (
        <div className="min-w-0 lg:col-start-1 lg:row-start-3">
          <section aria-labelledby="decision-title" className="space-y-4 rounded-xl border bg-card p-5">
            <div>
              <h2 id="decision-title" className="font-semibold">
                Decision
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {pendingComments > 0
                  ? `Your ${pendingComments === 1 ? "comment goes" : `${pendingComments} comments go`} to ${firstName} with whichever decision you choose.`
                  : `Comments on flags and the note below go to ${firstName} with your decision.`}
              </p>
            </div>
            {state.message && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {state.message}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="note">Note to {firstName}</Label>
              <Textarea
                id="note"
                name="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-invalid={!!errors.note}
                aria-describedby={errors.note ? "note-error" : "note-help"}
                placeholder="Optional when approving"
              />
              {errors.note ? (
                <p id="note-error" className="text-sm text-red-700">
                  {errors.note}
                </p>
              ) : (
                <p id="note-help" className="text-xs text-muted-foreground">
                  Required to request changes (unless you commented on a flag) or to reject.
                </p>
              )}
            </div>

            {openFlags.length > 0 && (
              <label className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-3 text-sm">
                <input
                  type="checkbox"
                  name="confirmOpenFlags"
                  value="yes"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary" aria-describedby={errors.confirmOpenFlags ? "confirm-error" : undefined} />
                <span>
                  To approve: I&apos;ve read the {openFlags.length} flagged {openFlags.length === 1 ? "phrase" : "phrases"} and they&apos;re acceptable as written.
                  {errors.confirmOpenFlags && (
                    <span id="confirm-error" className="mt-1 block text-red-700">
                      {errors.confirmOpenFlags}
                    </span>
                  )}
                </span>
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="decision" value="approve" disabled={pending}>
                Approve
              </Button>
              <Button type="submit" name="decision" value="changes" variant="outline" disabled={pending}>
                Request changes{pendingComments > 0 && ` · ${pendingComments} ${pendingComments === 1 ? "comment" : "comments"}`}
              </Button>
              <Button type="submit" name="decision" value="reject" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" disabled={pending}>
                Reject
              </Button>
            </div>
            {pending && <p className="text-sm text-muted-foreground">Saving…</p>}
          </section>
        </div>
      )}
    </form>
  );
}
