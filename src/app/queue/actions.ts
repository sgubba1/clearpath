"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { auditEvents, comments, flags, submissions } from "@/db/schema";
import type { Identity } from "@/lib/identities";
import { submissionRef } from "@/lib/labels";
import { getNextInQueue, getReviewItem } from "@/lib/queries";
import { getRule } from "@/lib/rules/catalog";
import { getIdentity } from "@/lib/session";

async function requireReviewer(): Promise<Identity> {
  const identity = await getIdentity();
  if (identity?.role !== "reviewer") throw new Error("Only reviewers can do this.");
  return identity;
}

function auditRow(identity: Identity, submissionId: number, versionNumber: number, action: string, detail?: string) {
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

// Opening a waiting item claims it, so the queue shows someone is on it.
export async function claimReview(id: number) {
  const identity = await requireReviewer();
  const db = getDb();
  const [claimed] = await db
    .update(submissions)
    .set({ status: "in_review", reviewerId: identity.id, reviewerName: identity.name, updatedAt: new Date() })
    .where(and(eq(submissions.id, id), eq(submissions.status, "submitted")))
    .returning({ id: submissions.id, currentVersion: submissions.currentVersion });
  if (claimed) await db.insert(auditEvents).values(auditRow(identity, id, claimed.currentVersion, "review_started"));
}

export type DecisionState = { errors: Record<string, string>; message?: string };

const DECISIONS = {
  approve: { status: "approved", action: "approved", label: "approved" },
  changes: { status: "changes_requested", action: "changes_requested", label: "sent back for changes" },
  reject: { status: "rejected", action: "rejected", label: "rejected" },
} as const;

export async function decide(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const identity = await requireReviewer();
  const id = Number(formData.get("id"));
  const decision = String(formData.get("decision")) as keyof typeof DECISIONS;
  if (!(decision in DECISIONS)) return { errors: {}, message: "Choose approve, request changes or reject." };

  const item = await getReviewItem(id);
  if (!item || (item.status !== "submitted" && item.status !== "in_review")) {
    return { errors: {}, message: "This ad is no longer waiting for review. It may have been decided already." };
  }
  const version = item.versions[item.versions.length - 1];
  const openFlags = version.flags.filter((flag) => flag.status !== "dismissed");

  const note = String(formData.get("note") ?? "").trim();
  const flagComments = version.flags
    .map((flag) => ({ flag, body: String(formData.get(`flagComment.${flag.id}`) ?? "").trim() }))
    .filter((comment) => comment.body);

  const errors: Record<string, string> = {};
  if (decision === "changes" && !note && flagComments.length === 0) {
    errors.note = "Tell the submitter what to change, here or on a specific flag.";
  }
  if (decision === "reject" && !note) errors.note = "Explain why it can't run, so the submitter doesn't repeat it.";
  if (decision === "approve" && openFlags.length && formData.get("confirmOpenFlags") !== "yes") {
    errors.confirmOpenFlags = "Confirm you've reviewed the flagged text before approving.";
  }
  if (Object.keys(errors).length) return { errors, message: "One more thing before this can be sent." };

  const now = new Date();
  const outcome = DECISIONS[decision];
  const db = getDb();

  await db.transaction(async (tx) => {
    if (flagComments.length || note) {
      await tx.insert(comments).values([
        ...flagComments.map(({ flag, body }) => ({
          versionId: version.id,
          flagId: flag.id,
          authorId: identity.id,
          authorName: identity.name,
          body,
          createdAt: now,
        })),
        ...(note ? [{ versionId: version.id, flagId: null, authorId: identity.id, authorName: identity.name, body: note, createdAt: now }] : []),
      ]);
    }

    // Approving with flags in the copy means the reviewer judged them acceptable.
    if (decision === "approve" && openFlags.length) {
      await tx.update(flags).set({ status: "dismissed" }).where(inArray(flags.id, openFlags.map((flag) => flag.id)));
    }

    await tx
      .update(submissions)
      .set({
        status: outcome.status,
        reviewerId: identity.id,
        reviewerName: identity.name,
        decidedAt: decision === "changes" ? null : now,
        updatedAt: now,
      })
      .where(eq(submissions.id, id));

    await tx.insert(auditEvents).values([
      ...flagComments.map(({ flag }) => auditRow(identity, id, version.number, "commented", `On "${getRule(flag.ruleId).title}"`)),
      ...(note ? [auditRow(identity, id, version.number, "commented", "General note")] : []),
      auditRow(
        identity,
        id,
        version.number,
        outcome.action,
        decision === "approve" && openFlags.length ? `Approved with ${openFlags.length} flag${openFlags.length === 1 ? "" : "s"} judged acceptable` : undefined,
      ),
    ]);
  });

  // Straight to the next riskiest item, carrying a confirmation of what just happened.
  const next = await getNextInQueue(id);
  const done = new URLSearchParams({ done: submissionRef(id), result: outcome.label });
  redirect(next ? `/queue/${next.id}?${done}` : `/queue?${done}`);
}
