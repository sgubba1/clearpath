"use client";

import { CheckCircle2Icon, ChevronDownIcon, ExternalLinkIcon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { SEVERITY_BADGE } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { getRule } from "@/lib/rules/catalog";
import type { Finding } from "@/lib/rules/engine";
import { cn } from "@/lib/utils";

export function findingKey(finding: Finding, index: number) {
  return `${finding.ruleId}:${finding.field}:${finding.start}:${index}`;
}

type Props = {
  findings: Finding[];
  hasCopy: boolean;
  fieldLabel: (key: string) => string;
  fieldValue: (key: string) => string;
  activeKey?: string;
  recentlyFixed?: { title: string };
  onSelect: (finding: Finding, key: string) => void;
  onApply: (finding: Finding) => void;
  onUndo: () => void;
  // The optional AI second opinion, shown after the rule flags.
  ai?: React.ReactNode;
};

export function PrecheckPanel({ findings, hasCopy, fieldLabel, fieldValue, activeKey, recentlyFixed, onSelect, onApply, onUndo, ai }: Props) {
  const high = findings.filter((finding) => finding.severity === "high").length;

  return (
    <section aria-labelledby="precheck-title" className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 id="precheck-title" className="font-semibold">
          Compliance pre-check
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Checks your copy against ClearPath&apos;s ad rules as you type.</p>
      </div>

      {recentlyFixed && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="flex items-center gap-2">
            <CheckCircle2Icon aria-hidden className="size-4 shrink-0" />
            Fixed: {recentlyFixed.title}
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-emerald-900 hover:bg-emerald-100" onClick={onUndo}>
            <Undo2Icon aria-hidden />
            Undo
          </Button>
        </div>
      )}

      <div aria-live="polite">
        {!hasCopy ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Add your copy and any issues will show up here.
          </p>
        ) : findings.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            <CheckCircle2Icon aria-hidden className="size-4 shrink-0" />
            The rule check found no issues.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {findings.length} {findings.length === 1 ? "issue" : "issues"} to fix
              {high > 0 && <span className="font-normal text-muted-foreground"> · {high} high</span>}
            </p>
            <ul className="space-y-2">
              {findings.map((finding, index) => {
                const key = findingKey(finding, index);
                return (
                  <FlagCard
                    key={key}
                    finding={finding}
                    active={activeKey === key}
                    fieldLabel={fieldLabel(finding.field)}
                    replaced={fieldValue(finding.field).slice(finding.replaceStart ?? finding.start, finding.replaceEnd ?? finding.end)}
                    onSelect={() => onSelect(finding, key)}
                    onApply={() => onApply(finding)}
                  />
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {hasCopy && ai}

      <p className="text-xs text-muted-foreground">Automated checks catch common problems. A reviewer still makes the final call.</p>
    </section>
  );
}

function FlagCard({
  finding,
  active,
  fieldLabel,
  replaced,
  onSelect,
  onApply,
}: {
  finding: Finding;
  active: boolean;
  fieldLabel: string;
  replaced: string;
  onSelect: () => void;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rule = getRule(finding.ruleId);
  const missing = finding.start === finding.end;

  return (
    <li className={cn("rounded-lg border p-3 text-sm transition-colors", active && "border-foreground/40 bg-muted/40")}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{rule.title}</p>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold", SEVERITY_BADGE[finding.severity])}>
          {finding.severity === "high" ? "High" : finding.severity === "medium" ? "Medium" : "Low"}
        </span>
      </div>

      {missing ? (
        <button type="button" onClick={onSelect} className="mt-1 text-left text-muted-foreground underline-offset-2 hover:underline">
          Missing from {fieldLabel.toLowerCase()}
        </button>
      ) : (
        <button type="button" onClick={onSelect} className="mt-1 text-left underline-offset-2 hover:underline" title="Show in the copy">
          <span className="text-muted-foreground">{fieldLabel}: </span>&ldquo;{finding.matchText}&rdquo;
        </button>
      )}
      {finding.detail && <p className="mt-1 text-muted-foreground">{finding.detail}</p>}

      {finding.replacement === undefined && (
        // No safe automatic rewrite for this one, so say how to fix it up front.
        <p className="mt-3 rounded-md bg-muted/60 p-2.5">
          <span className="text-xs font-medium text-muted-foreground">How to fix: </span>
          {rule.fixHint}
        </p>
      )}

      {finding.replacement !== undefined && (
        <div className="mt-3 space-y-2 rounded-md bg-muted/60 p-2.5">
          <p className="text-xs font-medium text-muted-foreground">{missing ? "Suggested addition" : "Suggested change"}</p>
          <p className="break-words">
            {!missing && <del className="text-muted-foreground decoration-red-500/70">{replaced}</del>}
            {!missing && " → "}
            <ins className="bg-emerald-100 no-underline">{finding.replacement.trim()}</ins>
          </p>
          <Button type="button" size="sm" variant="outline" className="bg-background" onClick={onApply}>
            Apply fix
          </Button>
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Why this matters
        <ChevronDownIcon aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-t pt-2 text-muted-foreground">
          <p className="text-foreground">{rule.whyItMatters}</p>
          {finding.replacement !== undefined && <p>{rule.fixHint}</p>}
          <a
            href={rule.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:text-foreground hover:underline"
          >
            {rule.regulation}
            <ExternalLinkIcon aria-hidden className="size-3" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          {"exampleOnly" in rule && rule.exampleOnly && (
            <p className="text-xs">Example check based on general guidance; not verified against the regulation.</p>
          )}
        </div>
      )}
    </li>
  );
}
