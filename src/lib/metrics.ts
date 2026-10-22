import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, submissions } from "@/db/schema";
import { getRateSheet } from "@/lib/rate-sheet";
import { REVIEW_TARGET_HOURS } from "@/lib/risk";
import { precheck } from "@/lib/rules/engine";

const DAY = 86_400_000;
const WINDOW_DAYS = 14;

type Period = { decided: number; avgTurnaroundHours: number | null; firstPassRate: number | null; roundsPerApproval: number | null };

// Everything the manager view shows, computed from the same records the other views use.
export async function getTeamMetrics(now = new Date()) {
  const db = getDb();
  const all = await db.query.submissions.findMany({
    with: { partner: true, versions: { orderBy: (v, { asc }) => [asc(v.number)], with: { flags: true } } },
  });
  const submitted = all.filter((item) => item.status !== "draft");

  const waiting = submitted.filter((item) => item.status === "submitted" || item.status === "in_review");
  const overdue = waiting.filter((item) => item.submittedAt && now.getTime() - item.submittedAt.getTime() > REVIEW_TARGET_HOURS * 3_600_000);

  // Compare the last two weeks with the two before, by decision date.
  const decidedIn = (fromDaysAgo: number, toDaysAgo: number) =>
    submitted.filter(
      (item) =>
        (item.status === "approved" || item.status === "rejected") &&
        item.decidedAt &&
        item.decidedAt.getTime() > now.getTime() - fromDaysAgo * DAY &&
        item.decidedAt.getTime() <= now.getTime() - toDaysAgo * DAY,
    );
  const period = (items: typeof submitted): Period => {
    const approved = items.filter((item) => item.status === "approved");
    const turnarounds = items.filter((item) => item.firstSubmittedAt && item.decidedAt).map((item) => (item.decidedAt!.getTime() - item.firstSubmittedAt!.getTime()) / 3_600_000);
    return {
      decided: items.length,
      avgTurnaroundHours: turnarounds.length ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length : null,
      // Approved without being sent back: the number the pre-check is meant to move.
      firstPassRate: approved.length ? approved.filter((item) => item.versions.length === 1).length / approved.length : null,
      roundsPerApproval: approved.length ? approved.reduce((sum, item) => sum + item.versions.length, 0) / approved.length : null,
    };
  };

  // What the pre-check caught on first submission over the last 30 days.
  const recent = submitted.filter((item) => item.firstSubmittedAt && item.firstSubmittedAt.getTime() > now.getTime() - 30 * DAY);
  const issueCounts = new Map<string, number>();
  for (const item of recent) for (const flag of item.versions[0]?.flags ?? []) issueCounts.set(flag.ruleId, (issueCounts.get(flag.ruleId) ?? 0) + 1);
  const topIssues = [...issueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ruleId, count]) => ({ ruleId, count }));

  // Who the issues come from, so training goes where it helps.
  const bySource = new Map<string, { name: string; isPartner: boolean; ads: number; flagged: number; flags: number }>();
  for (const item of recent) {
    const key = item.partnerId ?? item.submitterId;
    const row = bySource.get(key) ?? { name: item.partner?.name ?? item.submitterName, isPartner: !!item.partnerId, ads: 0, flagged: 0, flags: 0 };
    const firstFlags = item.versions[0]?.flags.length ?? 0;
    row.ads++;
    row.flags += firstFlags;
    if (firstFlags) row.flagged++;
    bySource.set(key, row);
  }
  const sources = [...bySource.values()].sort((a, b) => b.flags / b.ads - a.flags / a.ads || b.ads - a.ads);

  // Approved ads still running whose copy no longer matches today's rate sheet.
  const rateSheet = await getRateSheet();
  const affectedByRates = submitted
    .filter((item) => item.status === "approved")
    .flatMap((item) => {
      const version = item.versions[item.versions.length - 1];
      // Only rates that went wrong after approval; a rate the reviewer accepted at the time isn't news.
      const flaggedAtSubmission = new Set(version.flags.map((flag) => `${flag.ruleId}|${flag.matchText}`));
      const stale = precheck({ product: item.product, channel: item.channel, fields: version.fields }, rateSheet).filter(
        (finding) => finding.ruleId === "rate-not-offered" && !flaggedAtSubmission.has(`${finding.ruleId}|${finding.matchText}`),
      );
      return stale.length ? [{ id: item.id, campaign: item.campaign, submitterName: item.submitterName, decidedAt: item.decidedAt, detail: stale[0].detail, matchText: stale[0].matchText }] : [];
    });

  return {
    waiting: waiting.length,
    overdue: overdue.length,
    current: period(decidedIn(WINDOW_DAYS, 0)),
    previous: period(decidedIn(WINDOW_DAYS * 2, WINDOW_DAYS)),
    topIssues,
    sources,
    affectedByRates,
    windowDays: WINDOW_DAYS,
  };
}

export type TeamMetrics = Awaited<ReturnType<typeof getTeamMetrics>>;

export async function getAuditLog(limit = 150) {
  return getDb()
    .select({
      id: auditEvents.id,
      submissionId: auditEvents.submissionId,
      versionNumber: auditEvents.versionNumber,
      actorName: auditEvents.actorName,
      actorRole: auditEvents.actorRole,
      action: auditEvents.action,
      detail: auditEvents.detail,
      createdAt: auditEvents.createdAt,
      campaign: submissions.campaign,
    })
    .from(auditEvents)
    .leftJoin(submissions, eq(auditEvents.submissionId, submissions.id))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(limit);
}
