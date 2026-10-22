"use client";

import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveAd, type AdFormState, type AdFormValues } from "@/app/ads/actions";
import { HighlightTextarea, type Mark } from "@/components/highlight-textarea";
import { findingKey, PrecheckPanel } from "@/components/precheck-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Channel, Product } from "@/db/schema";
import { CHANNEL_FIELDS, CHANNEL_HINTS, CHANNEL_LABELS, PRODUCT_LABELS, type ChannelField } from "@/lib/labels";
import { getRule } from "@/lib/rules/catalog";
import { applyFix, precheck, type Finding, type RateSheet } from "@/lib/rules/engine";
import { cn } from "@/lib/utils";

const PRODUCT_HINTS: Record<Product, string> = {
  personal_loan: "Fixed-rate loans, $2,000 to $40,000",
  credit_card: "ClearPath Cash Back Card",
  mortgage_prequal: "See if you prequalify for a home loan",
};

type Props = {
  draftId?: number;
  initial: AdFormValues;
  channels: Channel[];
  submitterLabel: string;
  minLaunchDate: string;
  rateSheet: RateSheet;
};

export function AdForm({ draftId, initial, channels, submitterLabel, minLaunchDate, rateSheet }: Props) {
  const [state, formAction, pending] = useActionState<AdFormState, FormData>(saveAd, { errors: {} });
  // Controlled values survive validation errors and let the pre-check apply rewrites.
  const [values, setValues] = useState<AdFormValues>(initial);
  const [activeKey, setActiveKey] = useState<string>();
  const [undoStack, setUndoStack] = useState<Record<string, string>[]>([]);
  const [recentlyFixed, setRecentlyFixed] = useState<{ title: string }>();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const errors = state.errors;
  const set = (patch: Partial<AdFormValues>) => setValues((current) => ({ ...current, ...patch }));
  const setField = (key: string, value: string) => setValues((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));

  // The same engine the server runs on submit, run live on every change. It's a few regexes,
  // so it runs on the current text and fixes always apply to exactly what's on screen.
  const channelFields = values.channel ? CHANNEL_FIELDS[values.channel] : [];
  const hasCopy = channelFields.some((field) => field.kind !== "url" && field.kind !== "select" && values.fields[field.key]?.trim());
  const findings = useMemo(
    () =>
      values.product && values.channel
        ? precheck({ product: values.product, channel: values.channel, fields: values.fields }, rateSheet)
        : [],
    [values.product, values.channel, values.fields, rateSheet],
  );
  const marksByField = useMemo(() => {
    const map = new Map<string, Mark[]>();
    findings.forEach((finding, index) => {
      const marks = map.get(finding.field) ?? [];
      marks.push({ id: findingKey(finding, index), start: finding.start, end: finding.end, severity: finding.severity });
      map.set(finding.field, marks);
    });
    return map;
  }, [findings]);

  // The "Fixed" confirmation stays long enough to undo, then clears.
  useEffect(() => {
    if (!recentlyFixed) return;
    const timer = setTimeout(() => setRecentlyFixed(undefined), 8000);
    return () => clearTimeout(timer);
  }, [recentlyFixed]);

  useEffect(() => {
    if (confirming) reasonRef.current?.focus();
  }, [confirming]);

  function selectFinding(finding: Finding, key: string) {
    setActiveKey(key);
    const input = inputs.current.get(finding.field);
    if (!input) return;
    input.focus();
    input.setSelectionRange(finding.start, finding.end);
    input.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function applyFinding(finding: Finding) {
    setUndoStack((stack) => [...stack, values.fields]);
    setValues((current) => ({ ...current, fields: applyFix(current.fields, finding) }));
    setRecentlyFixed({ title: getRule(finding.ruleId).title });
    setActiveKey(undefined);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((stack) => stack.slice(0, -1));
    setValues((current) => ({ ...current, fields: previous }));
    setRecentlyFixed(undefined);
  }

  const fieldLabel = (key: string) => channelFields.find((field) => field.key === key)?.label ?? key;
  const openIssues = findings.length;

  return (
    <form action={formAction} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:items-start">
      {draftId && <input type="hidden" name="id" value={draftId} />}

      <div className="min-w-0 space-y-6">
        {state.message && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {state.message}
          </p>
        )}

        <Section title="About this ad">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Campaign name" name="campaign" error={errors.campaign}>
              <Input
                id="campaign"
                name="campaign"
                value={values.campaign}
                onChange={(e) => set({ campaign: e.target.value })}
                placeholder="e.g. Fall debt consolidation email"
                aria-invalid={!!errors.campaign}
                aria-describedby={errors.campaign ? "campaign-error" : undefined}
              />
            </Field>
            <Field label="Launch date" name="launchDate" error={errors.launchDate} help="Reviews usually take up to two days.">
              <Input
                id="launchDate"
                name="launchDate"
                type="date"
                min={minLaunchDate}
                value={values.launchDate}
                onChange={(e) => set({ launchDate: e.target.value })}
                aria-invalid={!!errors.launchDate}
                aria-describedby={errors.launchDate ? "launchDate-error" : "launchDate-help"}
              />
            </Field>
          </div>

          <ChoiceGroup
            legend="Product"
            name="product"
            error={errors.product}
            value={values.product}
            onChange={(product) => set({ product: product as Product })}
            options={(Object.keys(PRODUCT_LABELS) as Product[]).map((product) => ({
              value: product,
              label: PRODUCT_LABELS[product],
              hint: PRODUCT_HINTS[product],
            }))}
          />

          {channels.length > 1 ? (
            <ChoiceGroup
              legend="Where will it run?"
              name="channel"
              error={errors.channel}
              value={values.channel}
              onChange={(channel) => set({ channel: channel as Channel })}
              options={channels.map((channel) => ({ value: channel, label: CHANNEL_LABELS[channel], hint: CHANNEL_HINTS[channel] }))}
            />
          ) : (
            <input type="hidden" name="channel" value={channels[0]} />
          )}

          <p className="text-sm text-muted-foreground">
            Submitting as <span className="font-medium text-foreground">{submitterLabel}</span>
          </p>
        </Section>

        {values.channel ? (
          <Section title={channels.length > 1 ? `${CHANNEL_LABELS[values.channel]} copy` : "Your placement"}>
            {CHANNEL_FIELDS[values.channel].map((field) => (
              <ChannelInput
                key={`${values.channel}-${field.key}`}
                field={field}
                value={values.fields[field.key] ?? ""}
                onChange={(value) => setField(field.key, value)}
                error={errors[`field.${field.key}`]}
                marks={marksByField.get(field.key) ?? []}
                activeMark={activeKey}
                inputRef={(element) => {
                  if (element) inputs.current.set(field.key, element);
                  else inputs.current.delete(field.key);
                }}
              />
            ))}
          </Section>
        ) : (
          <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            Choose where the ad will run to see the fields for that channel.
          </p>
        )}

      </div>

      {/* On phones the pre-check sits between the copy and the buttons, so flags show before submitting. */}
      <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {values.channel && values.product ? (
          <PrecheckPanel
            findings={findings}
            hasCopy={hasCopy}
            fieldLabel={fieldLabel}
            fieldValue={(key) => values.fields[key] ?? ""}
            activeKey={activeKey}
            recentlyFixed={recentlyFixed}
            onSelect={selectFinding}
            onApply={applyFinding}
            onUndo={undo}
          />
        ) : (
          <section className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            <h2 className="font-semibold text-foreground">Compliance pre-check</h2>
            <p className="mt-1">Choose a product and channel, then add your copy. Issues show up here as you type.</p>
          </section>
        )}
      </div>

      <div className="min-w-0 space-y-3 lg:col-start-1">
        {confirming && openIssues > 0 && (
          <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <div>
              <Label htmlFor="reason" className="text-amber-950">
                Why send it with {openIssues} open {openIssues === 1 ? "issue" : "issues"}?
              </Label>
              <p id="reason-help" className="mt-1 text-sm text-amber-900">
                The reviewer sees this next to each flag. A clear reason speeds up the decision.
              </p>
            </div>
            <Textarea
              ref={reasonRef}
              id="reason"
              name="reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={errors.reason ? "reason-error" : "reason-help"}
              aria-invalid={!!errors.reason}
              className="bg-background"
              placeholder="e.g. The full APR disclosure is on the landing page this links to."
            />
            {errors.reason && (
              <p id="reason-error" className="text-sm text-red-700">
                {errors.reason}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="ghost" asChild>
            <Link href="/ads">Cancel</Link>
          </Button>
          <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
            Save draft
          </Button>
          {openIssues > 0 && !confirming ? (
            // Sending with open issues takes one extra step: say why.
            <Button type="button" onClick={() => setConfirming(true)} disabled={pending}>
              Submit for review
            </Button>
          ) : (
            <Button type="submit" name="intent" value="submit" disabled={pending || (confirming && openIssues > 0 && !reason.trim())}>
              {pending ? "Sending…" : confirming && openIssues > 0 ? "Send with open issues" : "Submit for review"}
            </Button>
          )}
        </div>
        {openIssues > 0 && !confirming && (
          <p className="text-right text-sm text-muted-foreground">
            Fixing the {openIssues === 1 ? "issue" : `${openIssues} issues`} first usually means a faster approval.
          </p>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  error,
  help,
  aside,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  help?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={name}>{label}</Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        help && (
          <p id={`${name}-help`} className="text-sm text-muted-foreground">
            {help}
          </p>
        )
      )}
    </div>
  );
}

function ChoiceGroup({
  legend,
  name,
  value,
  options,
  error,
  onChange,
}: {
  legend: string;
  name: string;
  value: string;
  options: { value: string; label: string; hint: string }[];
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "relative flex cursor-pointer flex-col rounded-lg border p-3 pr-9 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
              value === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {value === option.value && <CheckCircle2Icon aria-hidden className="absolute top-3 right-3 size-4 text-primary" />}
            <span className="font-medium">{option.label}</span>
            <span className="text-muted-foreground">{option.hint}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

const SMS_SEGMENT = 160;

function ChannelInput({
  field,
  value,
  error,
  marks,
  activeMark,
  inputRef,
  onChange,
}: {
  field: ChannelField;
  value: string;
  error?: string;
  marks: Mark[];
  activeMark?: string;
  inputRef: (element: HTMLTextAreaElement | null) => void;
  onChange: (value: string) => void;
}) {
  const name = `field.${field.key}`;
  const label = field.required ? field.label : `${field.label} (optional)`;
  const describedBy = error ? `${name}-error` : field.help ? `${name}-help` : undefined;
  const common = { id: name, name, "aria-invalid": !!error, "aria-describedby": describedBy };

  // Live character count for SMS, so length problems show before submitting.
  const aside =
    field.key === "message" ? (
      <span className={cn("text-xs tabular-nums", value.length > SMS_SEGMENT ? "font-medium text-amber-800" : "text-muted-foreground")} aria-live="polite">
        {value.length} / {SMS_SEGMENT}
        {value.length > SMS_SEGMENT && ` · sends as ${Math.ceil(value.length / 153)} messages`}
      </span>
    ) : undefined;

  return (
    <Field label={label} name={name} error={error} help={field.help} aside={aside}>
      {field.kind === "textarea" || field.kind === "text" ? (
        <HighlightTextarea
          {...common}
          ref={inputRef}
          value={value}
          onChange={onChange}
          marks={marks}
          activeMark={activeMark}
          singleLine={field.kind === "text"}
          placeholder={field.placeholder}
          className={field.kind === "textarea" ? "min-h-28" : undefined}
        />
      ) : field.kind === "select" ? (
        <select
          {...common}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive sm:w-64"
        >
          <option value="">Choose a platform</option>
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <Input {...common} value={value} type="url" placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}
