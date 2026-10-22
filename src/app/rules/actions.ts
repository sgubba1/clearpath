"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { auditEvents, channelEnum, productEnum, teamRules, type Channel, type Product } from "@/db/schema";
import { RULE_CATEGORIES } from "@/lib/rules/catalog";
import { getIdentity } from "@/lib/session";

export type RuleFormState = { errors: Record<string, string>; message?: string };

async function requireCompliance() {
  const identity = await getIdentity();
  if (!identity || (identity.role !== "reviewer" && identity.role !== "manager")) return undefined;
  return identity;
}

export async function addTeamRule(_prev: RuleFormState, formData: FormData): Promise<RuleFormState> {
  const identity = await requireCompliance();
  if (!identity) return { errors: {}, message: "Only compliance reviewers and managers can add rules." };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const kind = text("kind") === "required" ? "required" : "phrases";
  const phrases = text("phrases")
    .split("\n")
    .map((phrase) => phrase.trim())
    .filter(Boolean);
  const products = formData.getAll("products").map(String).filter((value): value is Product => (productEnum.enumValues as readonly string[]).includes(value));
  const channels = formData.getAll("channels").map(String).filter((value): value is Channel => (channelEnum.enumValues as readonly string[]).includes(value));
  const values = {
    title: text("title"),
    category: text("category"),
    severity: text("severity") === "high" ? ("high" as const) : ("medium" as const),
    requiredText: text("requiredText"),
    replacement: text("replacement"),
    whyItMatters: text("whyItMatters"),
    fixHint: text("fixHint"),
    source: text("source"),
    sourceUrl: text("sourceUrl"),
  };

  const errors: Record<string, string> = {};
  if (!values.title) errors.title = "Name the rule the way a marketer would read it on a flag.";
  if (!RULE_CATEGORIES.some((category) => category.id === values.category)) errors.category = "Choose a category.";
  if (kind === "phrases" && phrases.length === 0) errors.phrases = "Add at least one word or phrase to flag, one per line.";
  if (kind === "phrases" && phrases.some((phrase) => phrase.length < 3)) errors.phrases = "Each phrase needs at least three characters, so it doesn't match inside other words.";
  if (kind === "required" && !values.requiredText) errors.requiredText = "Add the text every matching ad must include.";
  if (!values.whyItMatters) errors.whyItMatters = "Explain the harm in one sentence. Marketers see this on the flag.";
  if (!values.fixHint) errors.fixHint = "Say how to fix it.";
  if (products.length === 0) errors.products = "Choose at least one product.";
  if (channels.length === 0) errors.channels = "Choose at least one channel.";
  if (values.sourceUrl && !/^https?:\/\//.test(values.sourceUrl)) errors.sourceUrl = "Enter a full link starting with https://";
  if (Object.keys(errors).length) return { errors, message: "A few fields need attention." };

  const db = getDb();
  await db.transaction(async (tx) => {
    const [rule] = await tx
      .insert(teamRules)
      .values({
        title: values.title,
        category: values.category,
        severity: values.severity,
        kind,
        phrases: kind === "phrases" ? phrases : [],
        requiredText: kind === "required" ? values.requiredText : null,
        replacement: kind === "phrases" ? values.replacement || null : null,
        // Every option chosen means "all", so the rule also covers products and channels added later.
        products: products.length === productEnum.enumValues.length ? null : products,
        channels: channels.length === channelEnum.enumValues.length ? null : channels,
        whyItMatters: values.whyItMatters,
        fixHint: values.fixHint,
        source: values.source || null,
        sourceUrl: values.sourceUrl || null,
        createdById: identity.id,
        createdByName: identity.name,
      })
      .returning({ id: teamRules.id });
    await tx.insert(auditEvents).values({
      submissionId: null,
      versionNumber: null,
      actorId: identity.id,
      actorName: identity.name,
      actorRole: identity.role,
      action: "rule_added",
      detail: `${values.title} (team-${rule.id})`,
    });
  });

  redirect("/rules?added=1");
}

export async function setTeamRuleActive(id: number, active: boolean) {
  const identity = await requireCompliance();
  if (!identity) throw new Error("Only compliance reviewers and managers can change rules.");
  const db = getDb();
  const [rule] = await db.update(teamRules).set({ active }).where(eq(teamRules.id, id)).returning({ title: teamRules.title });
  if (!rule) return;
  await db.insert(auditEvents).values({
    submissionId: null,
    versionNumber: null,
    actorId: identity.id,
    actorName: identity.name,
    actorRole: identity.role,
    action: active ? "rule_turned_on" : "rule_turned_off",
    detail: rule.title,
  });
  redirect(`/rules#team-${id}`);
}
