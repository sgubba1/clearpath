"use client";

import { SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { getAiSecondOpinion } from "@/app/ai-actions";
import { Button } from "@/components/ui/button";
import type { Channel, Product } from "@/db/schema";
import type { AiReviewResult, AiSuggestion } from "@/lib/ai-review";
import { cn } from "@/lib/utils";

type Props = {
  enabled: boolean;
  input: { product: Product; channel: Channel; fields: Record<string, string> } | null;
  fieldLabel: (key: string) => string;
  // In the form, suggestions can be applied and quotes located in the field.
  onApply?: (suggestion: AiSuggestion) => void;
  onSelect?: (suggestion: AiSuggestion) => void;
};

// Advisory only: shown apart from the rule flags, never changes them or the risk score.
export function AiSecondOpinion({ enabled, input, fieldLabel, onApply, onSelect }: Props) {
  const [result, setResult] = useState<AiReviewResult & { inputKey?: string }>();
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const inputKey = input ? JSON.stringify(input) : "";
  const stale = result?.inputKey !== undefined && result.inputKey !== inputKey;

  if (!enabled) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
        <SparklesIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        AI second opinion is off. It turns on when an ANTHROPIC_API_KEY is configured; everything else works without it.
      </p>
    );
  }

  function run() {
    if (!input) return;
    const key = inputKey;
    startTransition(async () => {
      const next = await getAiSecondOpinion(input);
      setResult({ ...next, inputKey: key });
      setApplied(new Set());
    });
  }

  return (
    <section aria-labelledby="ai-title" className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="ai-title" className="flex items-center gap-1.5 text-sm font-medium">
          <SparklesIcon aria-hidden className="size-4 text-violet-700" />
          AI second opinion
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-background"
          onClick={run}
          disabled={pending || !input}
          title="Looks for what rules can't: paraphrased promises, misleading overall impressions, fake urgency. Advisory only; it never clears a flag or approves anything."
        >
          {pending ? "Reviewing…" : result && !stale ? "Ask again" : "Get a second opinion"}
        </Button>
      </div>

      <div aria-live="polite" className="space-y-2 text-sm empty:hidden">
        {pending ? (
          <p className="text-muted-foreground">Reading the ad for anything the rules missed. This takes about ten seconds.</p>
        ) : !result ? null : result.status !== "ok" ? (
          <p className="text-muted-foreground">{result.message}</p>
        ) : (
          <>
            {stale && applied.size === 0 && <p className="text-xs font-medium text-amber-800">The copy changed since this check. Ask again for an up-to-date opinion.</p>}
            {result.suggestions.length === 0 ? (
              <p className="text-emerald-900">Nothing beyond the rule check stood out.</p>
            ) : (
              <ul className="space-y-2">
                {result.suggestions.map((suggestion) => {
                  const id = `${suggestion.field}:${suggestion.quote}`;
                  const done = applied.has(id);
                  // Usable as long as the quoted text is still there, even after other edits.
                  const stillInCopy = input?.fields[suggestion.field]?.includes(suggestion.quote) ?? false;
                  return (
                    <li key={id} className="rounded-md border bg-background p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{suggestion.issue}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold",
                            suggestion.severity === "high" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900",
                          )}
                        >
                          {suggestion.severity === "high" ? "High" : "Medium"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelect?.(suggestion)}
                        disabled={!onSelect}
                        className="mt-1 text-left enabled:underline-offset-2 enabled:hover:underline"
                      >
                        <span className="text-muted-foreground">{fieldLabel(suggestion.field)}: </span>&ldquo;{suggestion.quote}&rdquo;
                      </button>
                      <p className="mt-1 text-muted-foreground">{suggestion.explanation}</p>
                      {suggestion.suggestion && (
                        <div className="mt-2 rounded bg-muted/60 p-2">
                          <p className="text-xs font-medium text-muted-foreground">Suggested wording</p>
                          <p>{suggestion.suggestion}</p>
                          {onApply && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-2 bg-background"
                              disabled={done || !stillInCopy}
                              onClick={() => {
                                onApply(suggestion);
                                setApplied(new Set(applied).add(id));
                              }}
                            >
                              {done ? "Applied" : stillInCopy ? "Use this wording" : "Text already changed"}
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {result.overall && <p className="text-xs text-muted-foreground">{result.overall}</p>}
            <p className="text-xs text-muted-foreground">Advisory only: it never clears a flag or approves anything.</p>
          </>
        )}
      </div>
    </section>
  );
}
