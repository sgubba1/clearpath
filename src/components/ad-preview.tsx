"use client";

import { LinkIcon } from "lucide-react";
import type { Channel, Severity } from "@/db/schema";
import { getRule } from "@/lib/rules/catalog";
import { cn } from "@/lib/utils";

export type PreviewFlag = { id: number; field: string; start: number; end: number; severity: Severity; ruleId: string };

type Props = {
  channel: Channel;
  fields: Record<string, string>;
  flags: PreviewFlag[];
  activeFlagId?: number;
  onFlagClick?: (id: number) => void;
};

const MARK: Record<Severity, string> = {
  high: "bg-red-100 shadow-[inset_0_-2px_0_var(--color-red-500)]",
  medium: "bg-amber-100 shadow-[inset_0_-2px_0_var(--color-amber-500)]",
  low: "bg-sky-100 shadow-[inset_0_-2px_0_var(--color-sky-500)]",
};

// Short names for rules about something absent, shown where the missing text should go.
const MISSING_LABELS: Record<string, string> = {
  "missing-nmls": "NMLS ID",
  "sms-opt-out": "\"Reply STOP\" opt-out",
  "email-unsubscribe": "unsubscribe link or address",
};

// Shows the ad the way people will see it, in the shape of its channel, with flagged text marked.
export function AdPreview({ channel, fields, flags, activeFlagId, onFlagClick }: Props) {
  const text = (key: string, className?: string) => (
    <Highlighted text={fields[key] ?? ""} flags={flags.filter((flag) => flag.field === key)} activeFlagId={activeFlagId} onFlagClick={onFlagClick} className={className} />
  );

  if (channel === "email") {
    return (
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="space-y-1 border-b bg-muted/40 px-5 py-4">
          <p className="text-xs text-muted-foreground">From: ClearPath Financial</p>
          {text("subject", "text-base font-semibold")}
          {fields.preheader && text("preheader", "text-sm text-muted-foreground")}
        </div>
        <div className="px-5 py-5">{text("body", "leading-7")}</div>
        <div className="border-t px-5 py-4">{text("footer", "text-xs leading-5 text-muted-foreground")}</div>
      </div>
    );
  }

  if (channel === "sms") {
    const length = (fields.message ?? "").length;
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="mx-auto max-w-sm rounded-[2rem] border-8 border-foreground/80 bg-muted/30 px-4 pt-8 pb-10">
          <p className="mb-3 text-center text-xs text-muted-foreground">Text message · ClearPath</p>
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-[15px] leading-6">{text("message")}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            {length} characters · {length <= 160 ? "1 message" : `${Math.ceil(length / 153)} messages`}
          </p>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Consent source:</span> {fields.consentSource || "Not provided"}
        </p>
      </div>
    );
  }

  if (channel === "social") {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="mx-auto max-w-md rounded-xl border">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              CP
            </span>
            <div className="text-sm leading-tight">
              <p className="font-medium">ClearPath Financial</p>
              <p className="text-xs text-muted-foreground">Sponsored · {fields.platform || "Social"}</p>
            </div>
          </div>
          <div className="px-4 py-3">{text("postCopy", "leading-6")}</div>
          {fields.link && (
            <p className="flex items-center gap-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground">
              <LinkIcon aria-hidden className="size-3.5" />
              {fields.link}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Affiliate placements, landing pages and search ads: the copy with where it runs.
  const urlKey = channel === "affiliate" ? "placementUrl" : "url";
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <p className="flex items-center gap-1.5 border-b bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
        <LinkIcon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{fields[urlKey] || "No URL provided"}</span>
      </p>
      <div className="px-5 py-5">{text("copy", "leading-7")}</div>
    </div>
  );
}

function Highlighted({
  text,
  flags,
  activeFlagId,
  onFlagClick,
  className,
}: {
  text: string;
  flags: PreviewFlag[];
  activeFlagId?: number;
  onFlagClick?: (id: number) => void;
  className?: string;
}) {
  const marks = flags.filter((flag) => flag.end > flag.start).sort((a, b) => a.start - b.start);
  const missing = flags.filter((flag) => flag.end === flag.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const flag of marks) {
    if (flag.start < cursor) continue;
    parts.push(text.slice(cursor, flag.start));
    parts.push(
      <mark
        key={flag.id}
        id={`mark-${flag.id}`}
        onClick={() => onFlagClick?.(flag.id)}
        className={cn(
          "cursor-pointer rounded-sm px-0.5 text-inherit [box-decoration-break:clone]",
          MARK[flag.severity],
          activeFlagId === flag.id && "outline-2 outline-offset-1 outline-foreground/70",
        )}
      >
        {text.slice(flag.start, flag.end)}
      </mark>,
    );
    cursor = flag.end;
  }
  parts.push(text.slice(cursor));

  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {parts}
      {/* Something required is missing: mark where it should go. */}
      {missing.map((flag) => (
        <button
          key={flag.id}
          type="button"
          id={`mark-${flag.id}`}
          onClick={() => onFlagClick?.(flag.id)}
          className={cn(
            "ml-1.5 inline-flex items-center rounded border border-dashed border-red-400 bg-red-50 px-1.5 align-middle text-xs font-medium text-red-800",
            activeFlagId === flag.id && "outline-2 outline-offset-1 outline-foreground/70",
          )}
        >
          Missing: {MISSING_LABELS[flag.ruleId] ?? getRule(flag.ruleId).title}
        </button>
      ))}
    </p>
  );
}
