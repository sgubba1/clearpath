"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { addTeamRule, type RuleFormState } from "@/app/rules/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Channel, Product } from "@/db/schema";
import { CHANNEL_LABELS, PRODUCT_LABELS } from "@/lib/labels";
import { RULE_CATEGORIES, type TeamRule } from "@/lib/rules/catalog";
import { testTeamRule } from "@/lib/rules/engine";
import { cn } from "@/lib/utils";

const PRODUCTS = Object.keys(PRODUCT_LABELS) as Product[];
const CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[];

const SELECT =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function RuleForm() {
  const [state, formAction, pending] = useActionState<RuleFormState, FormData>(addTeamRule, { errors: {} });
  const errors = state.errors;
  // Controlled so the test box can run the draft rule, and so input survives validation errors.
  const [kind, setKind] = useState<"phrases" | "required">("phrases");
  const [title, setTitle] = useState("");
  const [phrases, setPhrases] = useState("");
  const [requiredText, setRequiredText] = useState("");
  const [replacement, setReplacement] = useState("");
  const [severity, setSeverity] = useState<"high" | "medium">("medium");
  const [sample, setSample] = useState("");
  const [category, setCategory] = useState("brand");
  const [why, setWhy] = useState("");
  const [fix, setFix] = useState("");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [products, setProducts] = useState<string[]>(PRODUCTS);
  const [channels, setChannels] = useState<string[]>(CHANNELS);

  const draft: TeamRule = useMemo(
    () => ({
      id: "team-draft",
      category: "brand",
      title: title || "This rule",
      severity,
      regulation: "Team rule",
      sourceUrl: "",
      products: "all",
      channels: "all",
      whyItMatters: "",
      fixHint: "",
      team: {
        kind,
        phrases: phrases.split("\n").map((phrase) => phrase.trim()).filter((phrase) => phrase.length >= 3),
        requiredText: requiredText.trim() || null,
        replacement: replacement.trim() || null,
        active: true,
        createdByName: "",
        createdAt: new Date(0).toISOString(),
      },
    }),
    [kind, title, phrases, requiredText, replacement, severity],
  );
  const results = useMemo(() => testTeamRule(draft, sample), [draft, sample]);

  return (
    <form action={formAction} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="min-w-0 space-y-6">
        {state.message && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {state.message}
          </p>
        )}

        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">The rule</h2>
          <Field label="Name" name="title" error={errors.title} help="Written for the marketer who'll see it on a flag, e.g. “Calls it a payday loan”.">
            <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category" name="category" error={errors.category}>
              <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT} aria-invalid={!!errors.category}>
                {RULE_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Severity" name="severity" help="High risks a regulatory problem; medium needs a fix before launch.">
              <select id="severity" name="severity" value={severity} onChange={(e) => setSeverity(e.target.value as "high" | "medium")} className={SELECT}>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">What should it check?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["phrases", "Flag words or phrases", "e.g. “payday loan”, “cash advance”"],
                  ["required", "Require some text", "e.g. “Equal Housing Lender” on mortgage ads"],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-lg border p-3 text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                    kind === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                  )}
                >
                  <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {kind === "phrases" ? (
            <>
              <Field label="Words or phrases to flag" name="phrases" error={errors.phrases} help="One per line. Matches whole words in any capitalization.">
                <Textarea id="phrases" name="phrases" rows={3} value={phrases} onChange={(e) => setPhrases(e.target.value)} aria-invalid={!!errors.phrases} />
              </Field>
              <Field label="Suggested replacement (optional)" name="replacement" help="Offered as a one-click fix on the flag.">
                <Input id="replacement" name="replacement" value={replacement} onChange={(e) => setReplacement(e.target.value)} />
              </Field>
            </>
          ) : (
            <Field label="Text every matching ad must include" name="requiredText" error={errors.requiredText} help="Offered as a one-click addition when it's missing.">
              <Input id="requiredText" name="requiredText" value={requiredText} onChange={(e) => setRequiredText(e.target.value)} aria-invalid={!!errors.requiredText} />
            </Field>
          )}
        </section>

        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">What marketers see</h2>
          <Field label="Why it matters" name="whyItMatters" error={errors.whyItMatters} help="One sentence about the harm to the consumer.">
            <Textarea id="whyItMatters" name="whyItMatters" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} aria-invalid={!!errors.whyItMatters} />
          </Field>
          <Field label="How to fix it" name="fixHint" error={errors.fixHint}>
            <Textarea id="fixHint" name="fixHint" rows={2} value={fix} onChange={(e) => setFix(e.target.value)} aria-invalid={!!errors.fixHint} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Source (optional)" name="source" help="e.g. “Brand guidelines” or a regulation.">
              <Input id="source" name="source" value={source} onChange={(e) => setSource(e.target.value)} />
            </Field>
            <Field label="Source link (optional)" name="sourceUrl" error={errors.sourceUrl}>
              <Input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} aria-invalid={!!errors.sourceUrl} />
            </Field>
          </div>
        </section>

        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">Where it applies</h2>
          <CheckboxGroup legend="Products" name="products" error={errors.products} selected={products} onChange={setProducts} options={PRODUCTS.map((value) => [value, PRODUCT_LABELS[value]])} />
          <CheckboxGroup legend="Channels" name="channels" error={errors.channels} selected={channels} onChange={setChannels} options={CHANNELS.map((value) => [value, CHANNEL_LABELS[value]])} />
        </section>

        <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
          <Button variant="ghost" asChild>
            <Link href="/rules">Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add rule"}
          </Button>
        </div>
      </div>

      <aside aria-labelledby="test-title" className="space-y-3 rounded-xl border bg-card p-5 lg:sticky lg:top-6">
        <h2 id="test-title" className="font-semibold">
          Test it
        </h2>
        <p className="text-sm text-muted-foreground">Paste some ad copy to see whether the rule fires before you add it.</p>
        <Label htmlFor="sample" className="sr-only">
          Sample ad copy
        </Label>
        <Textarea id="sample" rows={5} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="e.g. Need cash before payday? Get a payday loan today." />
        <div aria-live="polite" className="text-sm">
          {!sample.trim() ? null : results.length === 0 ? (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-muted-foreground">Nothing flagged in this copy.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((result, index) => (
                <li key={index} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-950">
                  {result.matchText ? (
                    <>
                      Flags &ldquo;{result.matchText}&rdquo;
                      {result.replacement && <> → suggests &ldquo;{result.replacement}&rdquo;</>}
                    </>
                  ) : (
                    <>Flags the copy for missing &ldquo;{draft.team.requiredText}&rdquo;</>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </form>
  );
}

function Field({ label, name, error, help, children }: { label: string; name: string; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        help && <p className="text-sm text-muted-foreground">{help}</p>
      )}
    </div>
  );
}

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  options: [string, string][];
  selected: string[];
  onChange: (values: string[]) => void;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={value}
              checked={selected.includes(value)}
              onChange={(e) => onChange(e.target.checked ? [...selected, value] : selected.filter((item) => item !== value))}
              className="size-4 accent-primary"
            />
            {label}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}
