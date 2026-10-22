"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { auditEvents, channelEnum, productEnum, submissions, versions, type Channel, type Product } from "@/db/schema";
import { daysUntil } from "@/lib/format";
import type { Identity } from "@/lib/identities";
import { CHANNEL_FIELDS, CHANNELS_FOR } from "@/lib/labels";
import { riskScore } from "@/lib/risk";
import { getIdentity } from "@/lib/session";

export type AdFormValues = {
  product: Product | "";
  channel: Channel | "";
  campaign: string;
  launchDate: string;
  fields: Record<string, string>;
};

export type AdFormState = { errors: Record<string, string>; message?: string };

export async function saveAd(_prev: AdFormState, formData: FormData): Promise<AdFormState> {
  const identity = await getIdentity();
  if (!identity || (identity.role !== "marketer" && identity.role !== "affiliate")) {
    return { errors: {}, message: "Switch to a marketer or affiliate partner to submit ads." };
  }

  const intent = formData.get("intent") === "draft" ? "draft" : "submit";
  const draftId = Number(formData.get("id")) || undefined;
  const values = readValues(formData);
  const submitterType = identity.role === "affiliate" ? "affiliate" : "in_house";

  const errors = validate(values, intent, submitterType);
  if (Object.keys(errors).length) {
    return { errors, message: "Some fields need attention before this can be sent." };
  }

  const db = getDb();
  const now = new Date();
  const product = values.product as Product;
  const channel = values.channel as Channel;
  // Only the selected channel's fields are stored, trimmed.
  const fields = Object.fromEntries(CHANNEL_FIELDS[channel].map((field) => [field.key, (values.fields[field.key] ?? "").trim()]));
  const submitting = intent === "submit";

  const submissionId = await db.transaction(async (tx) => {
    let id = draftId;
    const base = {
      product,
      channel,
      campaign: values.campaign.trim(),
      launchDate: values.launchDate,
      status: submitting ? ("submitted" as const) : ("draft" as const),
      riskScore: submitting ? riskScore({ openFlagSeverities: [], submitterType, product, launchDate: values.launchDate, now }) : 0,
      submittedAt: submitting ? now : null,
      firstSubmittedAt: submitting ? now : null,
      updatedAt: now,
    };

    if (id) {
      // Drafts are edited in place; they only become a numbered round once submitted.
      const [owned] = await tx
        .update(submissions)
        .set(base)
        .where(and(eq(submissions.id, id), eq(submissions.status, "draft"), ownerFilter(identity)))
        .returning({ id: submissions.id });
      if (!owned) throw new Error("This draft can't be edited. It may have been submitted already.");
      await tx.update(versions).set({ fields, createdAt: now }).where(and(eq(versions.submissionId, id), eq(versions.number, 1)));
    } else {
      const [created] = await tx
        .insert(submissions)
        .values({
          ...base,
          submitterId: identity.id,
          submitterName: identity.name,
          submitterType,
          partnerId: identity.role === "affiliate" ? identity.id : null,
          currentVersion: 1,
          createdAt: now,
        })
        .returning({ id: submissions.id });
      id = created.id;
      await tx.insert(versions).values({ submissionId: id, number: 1, fields, createdAt: now });
      await tx.insert(auditEvents).values(event(identity, id, "created", base.campaign));
    }

    if (submitting) await tx.insert(auditEvents).values(event(identity, id, "submitted"));
    return id;
  });

  redirect(`/ads/${submissionId}?${submitting ? "sent" : "saved"}=1`);
}

function ownerFilter(identity: Identity) {
  return identity.role === "affiliate" ? eq(submissions.partnerId, identity.id) : eq(submissions.submitterId, identity.id);
}

function event(identity: Identity, submissionId: number, action: string, detail?: string) {
  return {
    submissionId,
    versionNumber: 1,
    actorId: identity.id,
    actorName: identity.name,
    actorRole: identity.role,
    action,
    detail: detail ?? null,
  };
}

function readValues(formData: FormData): AdFormValues {
  const text = (name: string) => String(formData.get(name) ?? "");
  const fields: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("field.")) fields[name.slice("field.".length)] = String(value);
  }
  return {
    product: (productEnum.enumValues as readonly string[]).includes(text("product")) ? (text("product") as Product) : "",
    channel: (channelEnum.enumValues as readonly string[]).includes(text("channel")) ? (text("channel") as Channel) : "",
    campaign: text("campaign"),
    launchDate: text("launchDate"),
    fields,
  };
}

// Errors are keyed by input name so the form can show each one next to its field.
function validate(values: AdFormValues, intent: "draft" | "submit", submitterType: "in_house" | "affiliate") {
  const errors: Record<string, string> = {};

  if (!values.campaign.trim()) errors.campaign = "Give the campaign a name so you can find it later.";
  if (!values.product) errors.product = "Choose which product this ad promotes.";
  if (!values.channel) errors.channel = "Choose where this ad will run.";
  else if (!CHANNELS_FOR[submitterType].includes(values.channel)) errors.channel = "This channel isn't available for your account.";
  if (!values.launchDate) errors.launchDate = "Add the date this ad goes live.";
  else if (daysUntil(values.launchDate) < 0) errors.launchDate = "The launch date can't be in the past.";

  if (intent === "draft" || !values.channel) return errors;

  for (const field of CHANNEL_FIELDS[values.channel]) {
    const value = (values.fields[field.key] ?? "").trim();
    const name = `field.${field.key}`;
    if (field.required && !value) errors[name] = `Add the ${field.label.toLowerCase()}.`;
    else if (value && field.kind === "url" && !isUrl(value)) errors[name] = "Enter a full web address starting with https://";
    else if (field.kind === "select" && value && !field.options?.includes(value)) errors[name] = "Choose one of the options.";
  }
  return errors;
}

function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
