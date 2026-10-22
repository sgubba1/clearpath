import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RiskBadge, StatusBadge, Tag } from "@/components/badges";
import { ClaimOnOpen } from "@/components/claim-on-open";
import { ReviewWorkspace } from "@/components/review-workspace";
import { RoundChanges } from "@/components/round-changes";
import { describeEvent } from "@/lib/activity";
import { aiReviewEnabled } from "@/lib/ai-review";
import { launchLabel, timeAgo, waitingFor } from "@/lib/format";
import { CHANNEL_LABELS, PRODUCT_LABELS, submissionRef } from "@/lib/labels";
import { getReviewItem } from "@/lib/queries";
import { getRateSheet } from "@/lib/rate-sheet";
import { requireRole } from "@/lib/session";
import { getTeamRules } from "@/lib/team-rules";

export async function generateMetadata({ params }: PageProps<"/queue/[id]">): Promise<Metadata> {
  return { title: `${submissionRef(Number((await params).id))} · Review` };
}

export default async function ReviewPage({ params, searchParams }: PageProps<"/queue/[id]">) {
  // Managers can open any ad read-only (from the audit log or rate-change list); only reviewers decide.
  const identity = await requireRole(["reviewer", "manager"]);
  const item = await getReviewItem(Number((await params).id));
  if (!item) notFound();
  const query = await searchParams;
  await getTeamRules();

  const version = item.versions[item.versions.length - 1];
  const rates = (await getRateSheet())[item.product];
  const rateTerms = [
    `${PRODUCT_LABELS[item.product]} ${rates.aprMin.toFixed(2)}%–${rates.aprMax.toFixed(2)}% APR`,
    rates.termMinMonths && rates.termMaxMonths ? `${rates.termMinMonths}–${rates.termMaxMonths} month terms` : null,
    rates.introAprMonths ? `0% intro APR for ${rates.introAprMonths} months` : null,
    rates.nmlsId ? `NMLS ID #${rates.nmlsId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const isReviewer = identity.role === "reviewer";
  const waitingForReview = item.status === "submitted" || item.status === "in_review";
  const canDecide = isReviewer && waitingForReview;
  const submitter = item.partner ? `${item.submitterName}, ${item.partner.name}` : item.submitterName;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {isReviewer && item.status === "submitted" && <ClaimOnOpen submissionId={item.id} />}

      {query.done && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {query.done} {query.result}. Here&apos;s the next riskiest ad in the queue.
        </p>
      )}

      <div className="space-y-3">
        <Link href={isReviewer ? "/queue" : "/dashboard"} className="text-sm text-muted-foreground hover:text-foreground">
          ← {isReviewer ? "Review queue" : "Team overview"}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{item.campaign}</h1>
          <div className="flex items-center gap-2">
            {waitingForReview && <RiskBadge score={item.riskScore} />}
            <StatusBadge status={item.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{submissionRef(item.id)}</span>
          <span aria-hidden>·</span>
          <span>
            {CHANNEL_LABELS[item.channel]} · {PRODUCT_LABELS[item.product]}
          </span>
          <span aria-hidden>·</span>
          <span>{submitter}</span>
          {item.submitterType === "affiliate" && <Tag tone="partner">Affiliate</Tag>}
          {item.versions.length > 1 && <Tag>Round {item.versions.length}</Tag>}
          <span aria-hidden>·</span>
          <span>{launchLabel(item.launchDate)}</span>
          {waitingForReview && item.submittedAt && (
            <>
              <span aria-hidden>·</span>
              <span>Waiting {waitingFor(item.submittedAt)}</span>
            </>
          )}
        </div>
        {!waitingForReview && (
          <p className="rounded-lg bg-muted/60 px-4 py-2.5 text-sm">
            {item.status === "draft"
              ? "Still a draft. It hasn't been sent to compliance."
              : item.status === "changes_requested"
              ? `Sent back to ${item.submitterName} for changes. It returns to the queue when they resubmit.`
                : `${item.status === "approved" ? "Approved" : "Rejected"} by ${item.reviewerName ?? "a reviewer"}${item.decidedAt ? ` ${timeAgo(item.decidedAt)}` : ""}.`}
          </p>
        )}
      </div>

      {item.versions.length > 1 && (
        <RoundChanges channel={item.channel} previous={item.versions[item.versions.length - 2]} current={version} />
      )}

      <ReviewWorkspace
        key={version.id}
        submissionId={item.id}
        product={item.product}
        channel={item.channel}
        fields={version.fields}
        flags={version.flags}
        submitterName={item.submitterName}
        canDecide={canDecide}
        rateTerms={rateTerms}
        aiEnabled={aiReviewEnabled()}
      />

      <details className="rounded-xl border bg-card p-5">
        <summary className="cursor-pointer font-semibold">Activity ({item.auditEvents.length})</summary>
        <ol className="mt-3 space-y-2 text-sm">
          {item.auditEvents.map((event) => (
            <li key={event.id} className="flex flex-wrap justify-between gap-x-4">
              <span>{describeEvent(event)}</span>
              <time dateTime={event.createdAt.toISOString()} title={event.createdAt.toLocaleString("en-US")} className="text-muted-foreground">
                {timeAgo(event.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      </details>
    </main>
  );
}
