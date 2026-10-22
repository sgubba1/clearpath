"use client";

import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveAd, type AdFormState, type AdFormValues } from "@/app/ads/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Channel, Product } from "@/db/schema";
import { CHANNEL_FIELDS, CHANNEL_HINTS, CHANNEL_LABELS, PRODUCT_LABELS, type ChannelField } from "@/lib/labels";
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
};

export function AdForm({ draftId, initial, channels, submitterLabel, minLaunchDate }: Props) {
  const [state, formAction, pending] = useActionState<AdFormState, FormData>(saveAd, { errors: {} });
  // Controlled values survive validation errors and let later steps (pre-check rewrites) edit the copy.
  const [values, setValues] = useState<AdFormValues>(initial);
  const errors = state.errors;
  const set = (patch: Partial<AdFormValues>) => setValues((current) => ({ ...current, ...patch }));
  const setField = (key: string, value: string) => setValues((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {draftId && <input type="hidden" name="id" value={draftId} />}

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
            />
          ))}
        </Section>
      ) : (
        <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
          Choose where the ad will run to see the fields for that channel.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="ghost" asChild>
          <Link href="/ads">Cancel</Link>
        </Button>
        <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
          Save draft
        </Button>
        <Button type="submit" name="intent" value="submit" disabled={pending}>
          {pending ? "Sending…" : "Submit for review"}
        </Button>
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
  onChange,
}: {
  field: ChannelField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const name = `field.${field.key}`;
  const label = field.required ? field.label : `${field.label} (optional)`;
  const describedBy = error ? `${name}-error` : field.help ? `${name}-help` : undefined;
  const common = { id: name, name, value, "aria-invalid": !!error, "aria-describedby": describedBy };

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
      {field.kind === "textarea" ? (
        <Textarea {...common} rows={field.rows ?? 4} onChange={(e) => onChange(e.target.value)} />
      ) : field.kind === "select" ? (
        <select
          {...common}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive sm:w-64"
        >
          <option value="">Choose a platform</option>
          {field.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <Input {...common} type={field.kind === "url" ? "url" : "text"} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}
