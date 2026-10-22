import type { Metadata } from "next";
import Link from "next/link";
import { Tag } from "@/components/badges";
import { EmptyState, PageHeader } from "@/components/page-header";
import { describeEvent } from "@/lib/activity";
import { timeAgo } from "@/lib/format";
import { submissionRef } from "@/lib/labels";
import { getAuditLog, getTeamMetrics, type TeamMetrics } from "@/lib/metrics";
import { REVIEW_TARGET_HOURS } from "@/lib/risk";
import { getRule } from "@/lib/rules/catalog";
import { requestRateUpdate } from "@/app/queue/actions";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/session";
import { getTeamRules } from "@/lib/team-rules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Team overview" };

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "audit", label: "Audit log" },
] as const;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  await requireRole(["manager"]);
  await getTeamRules();
  const query = await searchParams;
  const tab = query.tab === "audit" ? "audit" : "overview";
  const [sentRef, sentTo] = typeof query.sentBack === "string" ? query.sentBack.split("|") : [];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {sentRef && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {sentRef} sent back to {sentTo} for an update. It returns to the review queue when they resubmit.
        </p>
      )}
      <PageHeader title="Team overview" description="How fast ads move through review, and where the issues come from." />

      <nav aria-label="Team overview sections" className="flex gap-1 border-b">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={item.id === "overview" ? "/dashboard" : "/dashboard?tab=audit"}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === item.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? <Overview metrics={await getTeamMetrics()} /> : <AuditLog />}
    </main>
  );
}

function Overview({ metrics }: { metrics: TeamMetrics }) {
  const { current, previous } = metrics;
  const days = (hours: number | null) => (hours === null ? "—" : `${(hours / 24).toFixed(1)} days`);
  const pct = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Waiting for review"
          value={String(metrics.waiting)}
          note={metrics.overdue ? `${metrics.overdue} past the ${REVIEW_TARGET_HOURS}-hour target` : `All within the ${REVIEW_TARGET_HOURS}-hour target`}
          tone={metrics.overdue ? "bad" : "good"}
        />
        <Metric
          label="Average turnaround"
          value={days(current.avgTurnaroundHours)}
          {...compare(current.avgTurnaroundHours, previous.avgTurnaroundHours, (a, b) => `${((b - a) / 24).toFixed(1)} days faster`, (a, b) => `${((a - b) / 24).toFixed(1)} days slower`, "lower")}
          hint="From first submission to a decision"
        />
        <Metric
          label="Approved on the first round"
          value={pct(current.firstPassRate)}
          {...compare(current.firstPassRate, previous.firstPassRate, (a, b) => `up ${Math.round((a - b) * 100)} points`, (a, b) => `down ${Math.round((b - a) * 100)} points`, "higher")}
          hint="Approved without being sent back"
        />
        <Metric
          label="Rounds per approval"
          value={current.roundsPerApproval === null ? "—" : current.roundsPerApproval.toFixed(1)}
          {...compare(current.roundsPerApproval, previous.roundsPerApproval, (a, b) => `down from ${b.toFixed(1)}`, (a, b) => `up from ${b.toFixed(1)}`, "lower")}
          hint="Each round is a full review cycle"
        />
      </dl>
      <p className="-mt-3 text-xs text-muted-foreground">
        Decisions in the last {metrics.windowDays} days ({current.decided}) compared with the {metrics.windowDays} days before ({previous.decided}).
      </p>

      {metrics.affectedByRates.length > 0 && (
        <section aria-labelledby="rates-title" className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 id="rates-title" className="font-semibold text-amber-950">
            Approved ads that no longer match the rate sheet
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            These were fine when approved. Rates changed since, so they need an update before running again. Sending one back reopens it
            with a note to the submitter.
          </p>
          <ul className="mt-3 space-y-2">
            {metrics.affectedByRates.map((item) => (
              <li key={item.id} className="rounded-lg bg-background p-3 text-sm">
                <Link href={`/queue/${item.id}`} className="font-medium underline-offset-2 hover:underline">
                  {item.campaign}
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  · {submissionRef(item.id)} · {item.submitterName} · approved {item.decidedAt ? timeAgo(item.decidedAt) : ""}
                </span>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p>
                    &ldquo;{item.matchText}&rdquo;: {item.detail}
                  </p>
                  <form action={requestRateUpdate.bind(null, item.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      Send back to {item.submitterName.split(" ")[0]} for an update
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="issues-title" className="rounded-xl border bg-card p-5">
          <h2 id="issues-title" className="font-semibold">
            Most common issues
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Caught by the pre-check on first submission, last 30 days.</p>
          {metrics.topIssues.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No issues caught yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {metrics.topIssues.map((issue) => {
                const width = Math.max(8, (issue.count / metrics.topIssues[0].count) * 100);
                return (
                  <li key={issue.ruleId} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <Link href={`/rules#${issue.ruleId}`} className="underline-offset-2 hover:underline">
                        {getRule(issue.ruleId).title}
                      </Link>
                      <span className="tabular-nums text-muted-foreground">{issue.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section aria-labelledby="sources-title" className="rounded-xl border bg-card p-5">
          <h2 id="sources-title" className="font-semibold">
            Where issues come from
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Share of each submitter&apos;s ads flagged on first submission, last 30 days.</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Submitter</th>
                <th className="pb-2 text-right font-medium">Ads</th>
                <th className="pb-2 text-right font-medium">Flagged</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {metrics.sources.map((source) => (
                <tr key={source.name}>
                  <td className="py-2">
                    <span className="mr-2">{source.name}</span>
                    {source.isPartner && <Tag tone="partner">Partner</Tag>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{source.ads}</td>
                  <td className="py-2 text-right tabular-nums">{Math.round((source.flagged / source.ads) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

// Describes the change against the previous period, colored by whether it's an improvement.
function compare(
  now: number | null,
  before: number | null,
  better: (now: number, before: number) => string,
  worse: (now: number, before: number) => string,
  goodDirection: "higher" | "lower",
): { note?: string; tone?: "good" | "bad" } {
  if (now === null || before === null || Math.abs(now - before) < 0.01) return { note: before === null ? undefined : "No change from the previous period" };
  const improved = goodDirection === "higher" ? now > before : now < before;
  return { note: improved ? better(now, before) : worse(now, before), tone: improved ? "good" : "bad" };
}

function Metric({ label, value, note, tone, hint }: { label: string; value: string; note?: string; tone?: "good" | "bad"; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-4">
      <dt className="text-sm text-muted-foreground" title={hint}>
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {note && (
        <dd className={cn("mt-1 text-xs", tone === "good" && "text-emerald-700", tone === "bad" && "text-red-700", !tone && "text-muted-foreground")}>
          {note}
        </dd>
      )}
    </div>
  );
}

async function AuditLog() {
  const events = await getAuditLog();
  if (events.length === 0) return <EmptyState title="Nothing logged yet" description="Every submission, check, comment and decision will appear here." />;

  return (
    <section aria-label="Audit log" className="rounded-xl border bg-card">
      <p className="border-b px-5 py-3 text-sm text-muted-foreground">
        Every submission, pre-check, acknowledgment, comment and decision, newest first. Showing the latest {events.length}.
      </p>
      <ol className="divide-y">
        {events.map((event) => (
          <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
            <div className="min-w-0">
              <p>{describeEvent(event)}</p>
              {event.submissionId && (
                <Link href={`/queue/${event.submissionId}`} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                  {submissionRef(event.submissionId)} · {event.campaign}
                </Link>
              )}
            </div>
            <time dateTime={event.createdAt.toISOString()} title={event.createdAt.toLocaleString("en-US")} className="shrink-0 text-xs text-muted-foreground">
              {timeAgo(event.createdAt)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
