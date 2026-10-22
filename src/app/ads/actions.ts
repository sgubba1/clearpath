"use server";

import { and, eq, inArray, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { auditEvents, channelEnum, comments, flags, productEnum, submissions, versions, type Channel, type Product } from "@/db/schema";
import { daysUntil } from "@/lib/format";
import type { Identity } from "@/lib/identities";
import { CHANNEL_FIELDS, CHANNELS_FOR } from "@/lib/labels";
import { getRateSheet } from "@/lib/rate-sheet";
import { getTeamRules } from "@/lib/team-rules";
import { riskScore } from "@/lib/risk";
import { precheck } from "@/lib/rules/engine";
import { getIdentity } from "@/lib/session";

export type AdFormValues = {
  product: Product | "";
  channel: Channel | "";
  campaign: string;
  launchDate: string;
  fields: Record<string, string>;
};

export type AdFormState = { errors: Record<string, string>; message?: string };

// Problems the submitter can act on (the ad was already sent, or no longer exists). These show
// as a message on the form instead of an error page.
class SaveProblem extends Error {}

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

  // The server re-runs the pre-check rather than trusting the browser's result.
  const findings = submitting ? precheck({ product, channel, fields }, await getRateSheet(), await getTeamRules()) : [];
  const reason = String(formData.get("reason") ?? "").trim();
  if (findings.length && !reason) {
    return {
      errors: { reason: "Add a short reason so the reviewer knows why these were sent unchanged." },
      message: `${findings.length} ${findings.length === 1 ? "issue is" : "issues are"} still open.`,
    };
  }

  const changeNote = String(formData.get("changeNote") ?? "").trim();
  const risk = (launchDate: string) =>
    riskScore({ openFlagSeverities: findings.map((finding) => finding.severity), submitterType, product, launchDate, now });
  const flagRows = (versionId: number) =>
    findings.map((finding) => ({
      versionId,
      ruleId: finding.ruleId,
      field: finding.field,
      matchText: finding.matchText,
      detail: finding.detail ?? null,
      start: finding.start,
      end: finding.end,
      severity: finding.severity,
      status: "acknowledged" as const,
      reason,
    }));
  const checkEvents = (id: number, round: number) => [
    event(identity, id, round, "prechecked", findings.length ? `${findings.length} issue${findings.length === 1 ? "" : "s"} found` : "No issues found"),
    ...(findings.length ? [event(identity, id, round, "flags_acknowledged", `Sent with ${findings.length} unresolved: "${reason}"`)] : []),
  ];

  let submissionId: number;
  try {
    submissionId = await db.transaction(async (tx) => {
      const existing = draftId
        ? await tx.query.submissions.findFirst({ where: and(eq(submissions.id, draftId), ownerFilter(identity)) })
        : undefined;
      if (draftId && !existing) throw new SaveProblem("This ad no longer exists. It may have been removed when the demo data was reset. Start a new ad from My ads.");

      // A sent-back ad becomes a new round; product and channel stay as they were.
      if (existing?.status === "changes_requested") {
        if (!submitting) throw new SaveProblem("A revision can't be saved as a draft. Resubmit it when it's ready.");
        const round = existing.currentVersion + 1;
        const [version] = await tx
          .insert(versions)
          .values({ submissionId: existing.id, number: round, fields, changeNote: changeNote || null, createdAt: now })
          .returning({ id: versions.id });
        if (findings.length) await tx.insert(flags).values(flagRows(version.id));
        await tx
          .update(submissions)
          .set({
            campaign: values.campaign.trim(),
            launchDate: values.launchDate,
            status: "submitted",
            riskScore: risk(values.launchDate),
            currentVersion: round,
            submittedAt: now,
            decidedAt: null,
            updatedAt: now,
          })
          .where(eq(submissions.id, existing.id));
        // Feedback on earlier rounds is answered by this one.
        const earlier = await tx.select({ id: versions.id }).from(versions).where(and(eq(versions.submissionId, existing.id), lt(versions.number, round)));
        await tx.update(comments).set({ resolved: true }).where(inArray(comments.versionId, earlier.map((v) => v.id)));
        await tx.insert(auditEvents).values([...checkEvents(existing.id, round), event(identity, existing.id, round, "resubmitted", changeNote || undefined)]);
        return existing.id;
      }

      const base = {
        product,
        channel,
        campaign: values.campaign.trim(),
        launchDate: values.launchDate,
        status: submitting ? ("submitted" as const) : ("draft" as const),
        riskScore: submitting ? risk(values.launchDate) : 0,
        submittedAt: submitting ? now : null,
        firstSubmittedAt: submitting ? now : null,
        updatedAt: now,
      };

      let id: number;
      let versionId: number;
      if (existing) {
        // Drafts are edited in place; they only become a numbered round once submitted.
        if (existing.status !== "draft") throw new SaveProblem("This ad was already sent to compliance, so it can't be edited as a draft anymore. Reload to see its status.");
        id = existing.id;
        await tx.update(submissions).set(base).where(eq(submissions.id, id));
        const [version] = await tx
          .update(versions)
          .set({ fields, createdAt: now })
          .where(and(eq(versions.submissionId, id), eq(versions.number, 1)))
          .returning({ id: versions.id });
        versionId = version.id;
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
        const [version] = await tx.insert(versions).values({ submissionId: id, number: 1, fields, createdAt: now }).returning({ id: versions.id });
        versionId = version.id;
        await tx.insert(auditEvents).values(event(identity, id, 1, "created", base.campaign));
      }

      if (submitting) {
        if (findings.length) await tx.insert(flags).values(flagRows(versionId));
        await tx.insert(auditEvents).values([...checkEvents(id, 1), event(identity, id, 1, "submitted")]);
      }
      return id;
    });
  } catch (error) {
    if (error instanceof SaveProblem) return { errors: {}, message: error.message };
    throw error;
  }

  redirect(`/ads/${submissionId}?${submitting ? "sent" : "saved"}=1`);
}

function ownerFilter(identity: Identity) {
  return identity.role === "affiliate" ? eq(submissions.partnerId, identity.id) : eq(submissions.submitterId, identity.id);
}

function event(identity: Identity, submissionId: number, versionNumber: number, action: string, detail?: string) {
  return {
    submissionId,
    versionNumber,
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
