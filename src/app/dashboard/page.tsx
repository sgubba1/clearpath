import { RiskBadge, StatusBadge } from "@/components/badges";
import { EmptyState, PageHeader } from "@/components/page-header";
import type { Status } from "@/db/schema";
import { timeAgo } from "@/lib/format";
import { CHANNEL_LABELS, PRODUCT_LABELS, submissionRef } from "@/lib/labels";
import { getAllSubmissions } from "@/lib/queries";
import { requireRole } from "@/lib/session";

const COUNTS: { label: string; statuses: Status[] }[] = [
  { label: "Waiting for review", statuses: ["submitted"] },
  { label: "In review", statuses: ["in_review"] },
  { label: "With submitters", statuses: ["changes_requested"] },
  { label: "Approved", statuses: ["approved"] },
  { label: "Rejected", statuses: ["rejected"] },
];

export default async function DashboardPage() {
  await requireRole(["manager"]);
  const all = await getAllSubmissions();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title="Team overview" description="Where every ad stands across the team." />

      {all.length === 0 ? (
        <EmptyState title="No review activity yet" description="Counts and recent activity appear here once ads are submitted." />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {COUNTS.map((count) => (
              <div key={count.label} className="rounded-xl border bg-card px-4 py-3">
                <dt className="text-sm text-muted-foreground">{count.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {all.filter((item) => count.statuses.includes(item.status)).length}
                </dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="recent" className="space-y-3">
            <h2 id="recent" className="text-sm font-medium text-muted-foreground">
              Recent activity
            </h2>
            <ul className="divide-y rounded-xl border bg-card">
              {all.slice(0, 15).map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">{item.campaign}</p>
                    <p className="text-sm text-muted-foreground">
                      {submissionRef(item.id)} · {CHANNEL_LABELS[item.channel]} · {PRODUCT_LABELS[item.product]} ·{" "}
                      {item.partnerName ?? item.submitterName} · Updated {timeAgo(item.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(item.status === "submitted" || item.status === "in_review") && <RiskBadge score={item.riskScore} />}
                    <StatusBadge status={item.status} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
