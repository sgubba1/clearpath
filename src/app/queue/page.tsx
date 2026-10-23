import type { Metadata } from "next";
import Link from "next/link";
import { RiskBadge, RiskReasons, StatusBadge, Tag } from "@/components/badges";
import { FilterSummary, ListFilters } from "@/components/list-filters";
import { EmptyState, PageHeader } from "@/components/page-header";
import { daysUntil, formatDate, hoursSince, launchLabel, timeAgo, waitingFor } from "@/lib/format";
import { CHANNEL_LABELS, PRODUCT_LABELS, submissionRef } from "@/lib/labels";
import { getQueue, getRecentlyDecided, getSentBack, type DecidedSummary } from "@/lib/queries";
import { REVIEW_TARGET_HOURS, riskLevel } from "@/lib/risk";
import { matchesQuery, searchParam } from "@/lib/search";
import { requireRole } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Review queue" };

export default async function QueuePage({ searchParams }: PageProps<"/queue">) {
  const identity = await requireRole(["reviewer"]);
  const query = await searchParams;
  const tab = query.tab === "sent-back" || query.tab === "decided" ? query.tab : "waiting";
  // Counts for every tab are cheap at this volume and keep the tab labels honest.
  const [queue, sentBack, decided] = await Promise.all([getQueue(), getSentBack(identity.id), getRecentlyDecided(identity.id)]);
  const overdue = queue.filter((item) => item.submittedAt && hoursSince(item.submittedAt) > REVIEW_TARGET_HOURS).length;

  // Search across all tabs (ad name, CP number, submitter or partner); risk chips on Waiting.
  const q = searchParam(query.q);
  const risk = query.risk === "high" || query.risk === "medium" || query.risk === "low" ? query.risk : undefined;
  const matches = (item: DecidedSummary) =>
    matchesQuery(q, item.campaign, submissionRef(item.id), item.submitterName, item.partnerName, CHANNEL_LABELS[item.channel], PRODUCT_LABELS[item.product]);
  const searched = queue.filter(matches);
  const waiting = searched.filter((item) => !risk || riskLevel(item.riskScore) === risk);
  const riskChips = [
    { value: "all", label: "All", count: searched.length },
    ...(["high", "medium", "low"] as const).map((level) => ({
      value: level,
      label: level[0].toUpperCase() + level.slice(1),
      count: searched.filter((item) => riskLevel(item.riskScore) === level).length,
    })),
  ];
  const shownSentBack = sentBack.filter(matches);
  const shownDecided = decided.filter(matches);
  const tabHref = (id: string) => {
    const next = new URLSearchParams();
    if (id !== "waiting") next.set("tab", id);
    if (q) next.set("q", q);
    const qs = next.toString();
    return qs ? `/queue?${qs}` : "/queue";
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {query.done && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {query.done} {query.result}.{queue.length === 0 && " That was the last one. The queue is clear."}
        </p>
      )}
      <PageHeader
        title="Review queue"
        description={
          tab === "sent-back"
            ? "Ads you sent back, waiting on the submitter. They return to the queue when resubmitted."
            : tab === "decided"
              ? "Your approvals and rejections from the last 14 days, newest first."
              : queue.length
                ? `${queue.length} ad${queue.length === 1 ? "" : "s"} waiting, riskiest first${overdue ? ` · ${overdue} past the ${REVIEW_TARGET_HOURS}-hour target` : ""}. Hover a risk label for the full score.`
                : "Ads waiting for review, riskiest first."
        }
      />

      <nav aria-label="Review queue sections" className="flex gap-1 border-b">
        {(
          [
            ["waiting", "Waiting", queue.length],
            ["sent-back", "Sent back", sentBack.length],
            ["decided", "Recently decided", decided.length],
          ] as const
        ).map(([id, label, count]) => (
          <Link
            key={id}
            href={tabHref(id)}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label} <span className="font-normal text-muted-foreground">({count})</span>
          </Link>
        ))}
      </nav>

      <div className="space-y-2">
        <ListFilters
          key={tab}
          label="Search ads"
          placeholder="Search by ad, CP number, person or channel"
          chips={tab === "waiting" ? riskChips : undefined}
        />
        <FilterSummary
          shown={tab === "sent-back" ? shownSentBack.length : tab === "decided" ? shownDecided.length : waiting.length}
          total={tab === "sent-back" ? sentBack.length : tab === "decided" ? decided.length : queue.length}
          clearHref={tab === "waiting" ? "/queue" : `/queue?tab=${tab}`}
        />
      </div>

      {tab === "sent-back" ? (
        <HistoryList
          items={shownSentBack}
          empty="Nothing sent back. Ads you request changes on show up here until they're resubmitted."
          status={(item) => `With ${item.partnerName ?? item.submitterName} · sent back ${timeAgo(item.updatedAt)}`}
        />
      ) : tab === "decided" ? (
        <HistoryList
          items={shownDecided}
          empty="No decisions in the last 14 days."
          status={(item) => `${item.status === "approved" ? "Approved" : "Rejected"} · ${item.decidedAt ? timeAgo(item.decidedAt) : ""}`}
        />
      ) : queue.length === 0 ? (
        <EmptyState title="Nothing waiting for review" description="New submissions appear here as soon as they're sent." />
      ) : waiting.length === 0 ? (
        <EmptyState title="No ads match" description="Try a different search or risk level." />
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {waiting.map((item) => {
            const waitedHours = item.submittedAt ? hoursSince(item.submittedAt) : 0;
            const isOverdue = waitedHours > REVIEW_TARGET_HOURS;
            const isRush = daysUntil(item.launchDate) <= 3;
            return (
              <li key={item.id}>
                <Link
                  href={`/queue/${item.id}`}
                  className="grid gap-3 px-4 py-4 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:px-5"
                >
                  <div>
                    <RiskBadge score={item.riskScore} parts={item.riskParts} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{item.campaign}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <span>{submissionRef(item.id)}</span>
                      <span aria-hidden>·</span>
                      {/* Partners only submit affiliate placements, so the Affiliate tag stands in for the channel. */}
                      <span>
                        {item.submitterType === "affiliate" ? PRODUCT_LABELS[item.product] : `${CHANNEL_LABELS[item.channel]} · ${PRODUCT_LABELS[item.product]}`}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{item.partnerName ?? item.submitterName}</span>
                      {item.submitterType === "affiliate" && <Tag tone="partner">Affiliate</Tag>}
                      {item.currentVersion > 1 && <Tag>Round {item.currentVersion}</Tag>}
                    </div>
                    <RiskReasons parts={item.riskParts} />
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
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}

// The calmer list for ads already decided: name, one line of details, and where it stands.
function HistoryList({ items, empty, status }: { items: DecidedSummary[]; empty: string; status: (item: DecidedSummary) => string }) {
  if (items.length === 0) return <EmptyState title="Nothing here yet" description={empty} />;
  return (
    <ol className="divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/queue/${item.id}`}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:px-5"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{item.campaign}</p>
              <p className="text-sm text-muted-foreground">
                {submissionRef(item.id)} · {item.submitterType === "affiliate" ? PRODUCT_LABELS[item.product] : `${CHANNEL_LABELS[item.channel]} · ${PRODUCT_LABELS[item.product]}`} ·{" "}
                {item.partnerName ?? item.submitterName}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{status(item)}</p>
          </Link>
        </li>
      ))}
    </ol>
  );
}
