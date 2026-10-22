import { RiskBadge, StatusBadge, Tag } from "@/components/badges";
import { EmptyState, PageHeader } from "@/components/page-header";
import { daysUntil, formatDate, hoursSince, launchLabel, waitingFor } from "@/lib/format";
import { CHANNEL_LABELS, PRODUCT_LABELS, submissionRef } from "@/lib/labels";
import { getQueue } from "@/lib/queries";
import { REVIEW_TARGET_HOURS } from "@/lib/risk";
import { requireRole } from "@/lib/session";

export default async function QueuePage() {
  await requireRole(["reviewer"]);
  const queue = await getQueue();
  const overdue = queue.filter((item) => item.submittedAt && hoursSince(item.submittedAt) > REVIEW_TARGET_HOURS).length;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Review queue"
        description={
          queue.length
            ? `${queue.length} ad${queue.length === 1 ? "" : "s"} waiting, riskiest first${overdue ? ` · ${overdue} past the ${REVIEW_TARGET_HOURS}-hour target` : ""}.`
            : "Ads waiting for review, riskiest first."
        }
      />

      {queue.length === 0 ? (
        <EmptyState title="Nothing waiting for review" description="New submissions appear here as soon as they're sent." />
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {queue.map((item) => {
            const waitedHours = item.submittedAt ? hoursSince(item.submittedAt) : 0;
            const isOverdue = waitedHours > REVIEW_TARGET_HOURS;
            const isRush = daysUntil(item.launchDate) <= 3;
            return (
              <li key={item.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:px-5">
                <div>
                  <RiskBadge score={item.riskScore} />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{item.campaign}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span>{submissionRef(item.id)}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {CHANNEL_LABELS[item.channel]} · {PRODUCT_LABELS[item.product]}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{item.partnerName ?? item.submitterName}</span>
                    {item.submitterType === "affiliate" && <Tag tone="partner">Affiliate</Tag>}
                    {item.currentVersion > 1 && <Tag>Round {item.currentVersion}</Tag>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm sm:justify-end">
                  <span className={isRush ? "font-medium text-foreground" : "text-muted-foreground"} title={formatDate(item.launchDate)}>
                    {launchLabel(item.launchDate)}
                  </span>
                  {isOverdue ? (
                    <Tag tone="warning">Waiting {waitingFor(item.submittedAt!)} · over target</Tag>
                  ) : (
                    <span className="text-muted-foreground">Waiting {item.submittedAt ? waitingFor(item.submittedAt) : "—"}</span>
                  )}
                  <StatusBadge status={item.status} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
