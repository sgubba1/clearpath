import Link from "next/link";
import { StatusBadge } from "@/components/badges";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { Status } from "@/db/schema";
import { timeAgo } from "@/lib/format";
import { CHANNEL_LABELS, PRODUCT_LABELS, submissionRef } from "@/lib/labels";
import { getMyAds } from "@/lib/queries";
import { requireRole } from "@/lib/session";

// Group by what the submitter should do next, not by raw status.
const GROUPS: { title: string; statuses: Status[] }[] = [
  { title: "Needs your attention", statuses: ["changes_requested", "draft"] },
  { title: "With compliance", statuses: ["submitted", "in_review"] },
  { title: "Done", statuses: ["approved", "rejected"] },
];

export default async function MyAdsPage() {
  const identity = await requireRole(["marketer", "affiliate"]);
  const ads = await getMyAds(identity);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="My ads"
        description={
          identity.role === "affiliate"
            ? "Ads you've sent to ClearPath for approval, and where each one stands."
            : "Ads you've sent to compliance, and where each one stands."
        }
        action={
          <Button asChild>
            <Link href="/ads/new">{identity.role === "affiliate" ? "Submit a placement" : "New ad"}</Link>
          </Button>
        }
      />

      {ads.length === 0 ? (
        <EmptyState
          title="No ads yet"
          description="Submit your first ad to get it reviewed. It shows up here with its status and any feedback from compliance."
        />
      ) : (
        GROUPS.map((group) => {
          const items = ads.filter((ad) => group.statuses.includes(ad.status));
          if (items.length === 0) return null;
          return (
            <section key={group.title} aria-labelledby={`group-${group.title}`} className="space-y-3">
              <h2 id={`group-${group.title}`} className="text-sm font-medium text-muted-foreground">
                {group.title} <span className="font-normal">({items.length})</span>
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {items.map((ad) => (
                  <li key={ad.id}>
                    <Link
                      href={ad.status === "draft" ? `/ads/${ad.id}/edit` : `/ads/${ad.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:px-5"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">{ad.campaign}</p>
                        <p className="text-sm text-muted-foreground">
                          {submissionRef(ad.id)} · {CHANNEL_LABELS[ad.channel]} · {PRODUCT_LABELS[ad.product]} · Updated{" "}
                          {timeAgo(ad.updatedAt)}
                        </p>
                        {ad.status === "changes_requested" && ad.openComments > 0 && (
                          <p className="text-sm text-amber-900">
                            {ad.reviewerName ?? "Compliance"} left {ad.openComments} comment{ad.openComments === 1 ? "" : "s"}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={ad.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}
