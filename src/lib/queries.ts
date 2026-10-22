import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, flags, partners, submissions, versions } from "@/db/schema";
import type { Identity } from "@/lib/identities";
import { riskBreakdown } from "@/lib/risk";

const submissionColumns = {
  id: submissions.id,
  product: submissions.product,
  channel: submissions.channel,
  campaign: submissions.campaign,
  launchDate: submissions.launchDate,
  submitterName: submissions.submitterName,
  submitterType: submissions.submitterType,
  partnerName: partners.name,
  status: submissions.status,
  riskScore: submissions.riskScore,
  currentVersion: submissions.currentVersion,
  reviewerName: submissions.reviewerName,
  submittedAt: submissions.submittedAt,
  decidedAt: submissions.decidedAt,
  updatedAt: submissions.updatedAt,
};

// Marketers see their own ads; affiliates see everything their partner organization sent.
export async function getMyAds(identity: Identity) {
  const owner =
    identity.role === "affiliate" ? eq(submissions.partnerId, identity.id) : eq(submissions.submitterId, identity.id);

  // Unresolved reviewer comments on the current version, so the list can say "2 comments".
  const openComments = getDb()
    .select({ submissionId: versions.submissionId, count: sql<number>`count(*)::int`.as("count") })
    .from(comments)
    .innerJoin(versions, eq(comments.versionId, versions.id))
    .innerJoin(submissions, and(eq(versions.submissionId, submissions.id), eq(versions.number, submissions.currentVersion)))
    .where(eq(comments.resolved, false))
    .groupBy(versions.submissionId)
    .as("open_comments");

  return getDb()
    .select({ ...submissionColumns, openComments: sql<number>`coalesce(${openComments.count}, 0)` })
    .from(submissions)
    .leftJoin(partners, eq(submissions.partnerId, partners.id))
    .leftJoin(openComments, eq(openComments.submissionId, submissions.id))
    .where(owner)
    .orderBy(desc(submissions.updatedAt));
}

// Everything waiting on a reviewer, riskiest first, then longest waiting.
// Risk is recalculated on every load, so an ad climbs as its launch date nears, and each
// item carries the reasons behind its score.
export async function getQueue(now = new Date()) {
  const db = getDb();
  const items = await db
    .select(submissionColumns)
    .from(submissions)
    .leftJoin(partners, eq(submissions.partnerId, partners.id))
    .where(inArray(submissions.status, ["submitted", "in_review"]));
  if (items.length === 0) return [];

  // Unresolved flags on each item's current round.
  const openFlags = await db
    .select({ submissionId: versions.submissionId, severity: flags.severity })
    .from(flags)
    .innerJoin(versions, eq(flags.versionId, versions.id))
    .innerJoin(submissions, and(eq(versions.submissionId, submissions.id), eq(versions.number, submissions.currentVersion)))
    .where(and(inArray(versions.submissionId, items.map((item) => item.id)), ne(flags.status, "dismissed")));

  return items
    .map((item) => {
      const risk = riskBreakdown({
        openFlagSeverities: openFlags.filter((flag) => flag.submissionId === item.id).map((flag) => flag.severity),
        submitterType: item.submitterType,
        product: item.product,
        launchDate: item.launchDate,
        now,
      });
      return { ...item, riskScore: risk.score, riskParts: risk.parts };
    })
    .sort((a, b) => b.riskScore - a.riskScore || (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0));
}

export async function getAllSubmissions() {
  return getDb()
    .select(submissionColumns)
    .from(submissions)
    .leftJoin(partners, eq(submissions.partnerId, partners.id))
    .where(ne(submissions.status, "draft"))
    .orderBy(desc(submissions.updatedAt));
}

export type SubmissionSummary = Awaited<ReturnType<typeof getQueue>>[number];

// One of the viewer's own ads with every version, or undefined if it isn't theirs.
export async function getOwnedAd(identity: Identity, id: number) {
  if (!Number.isInteger(id)) return undefined;
  const owner =
    identity.role === "affiliate" ? eq(submissions.partnerId, identity.id) : eq(submissions.submitterId, identity.id);
  return getDb().query.submissions.findFirst({
    where: and(eq(submissions.id, id), owner),
    with: {
      partner: true,
      versions: {
        orderBy: (v, { asc }) => [asc(v.number)],
        with: { comments: { orderBy: (c, { asc }) => [asc(c.createdAt)], with: { flag: true } } },
      },
    },
  });
}

// Everything the reviewer needs on one screen: the ad, every round with its flags and
// comments, the activity log and the product's rate terms.
export async function getReviewItem(id: number) {
  if (!Number.isInteger(id)) return undefined;
  return getDb().query.submissions.findFirst({
    where: eq(submissions.id, id),
    with: {
      partner: true,
      versions: {
        orderBy: (v, { asc }) => [asc(v.number)],
        with: {
          flags: { orderBy: (f, { asc }) => [asc(f.id)] },
          comments: { orderBy: (c, { asc }) => [asc(c.createdAt)] },
        },
      },
      auditEvents: { orderBy: (e, { asc }) => [asc(e.createdAt), asc(e.id)] },
    },
  });
}

export type ReviewItem = NonNullable<Awaited<ReturnType<typeof getReviewItem>>>;

// The next item a reviewer should open after deciding on one.
export async function getNextInQueue(excludeId: number) {
  const queue = await getQueue();
  return queue.find((item) => item.id !== excludeId);
}

// A partner's recent history, for reviewers judging one of their ads. Excludes the ad being reviewed.
export async function getPartnerTrackRecord(partnerId: string, excludeId: number, days = 90) {
  const since = new Date(Date.now() - days * 86_400_000);
  const ads = await getDb().query.submissions.findMany({
    where: and(eq(submissions.partnerId, partnerId), ne(submissions.id, excludeId), ne(submissions.status, "draft")),
    with: { versions: { orderBy: (v, { asc }) => [asc(v.number)], with: { flags: true } } },
  });
  const recent = ads.filter((ad) => ad.firstSubmittedAt && ad.firstSubmittedAt >= since);
  const issueCounts = new Map<string, number>();
  for (const ad of recent) for (const flag of ad.versions[0]?.flags ?? []) issueCounts.set(flag.ruleId, (issueCounts.get(flag.ruleId) ?? 0) + 1);
  const topIssue = [...issueCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    days,
    ads: recent.length,
    flagged: recent.filter((ad) => (ad.versions[0]?.flags.length ?? 0) > 0).length,
    sentBack: recent.filter((ad) => ad.versions.length > 1 || ad.status === "changes_requested").length,
    rejected: recent.filter((ad) => ad.status === "rejected").length,
    approvedFirstRound: recent.filter((ad) => ad.status === "approved" && ad.versions.length === 1).length,
    topIssue: topIssue ? { ruleId: topIssue[0], count: topIssue[1] } : undefined,
  };
}

// Ads this reviewer sent back that are waiting on the submitter, most recent first.
export async function getSentBack(reviewerId: string) {
  return getDb()
    .select(submissionColumns)
    .from(submissions)
    .leftJoin(partners, eq(submissions.partnerId, partners.id))
    .where(and(eq(submissions.status, "changes_requested"), eq(submissions.reviewerId, reviewerId)))
    .orderBy(desc(submissions.updatedAt));
}

// This reviewer's approvals and rejections from the last couple of weeks, newest first.
export async function getRecentlyDecided(reviewerId: string, days = 14) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await getDb()
    .select(submissionColumns)
    .from(submissions)
    .leftJoin(partners, eq(submissions.partnerId, partners.id))
    .where(and(inArray(submissions.status, ["approved", "rejected"]), eq(submissions.reviewerId, reviewerId)))
    .orderBy(desc(submissions.decidedAt));
  return rows.filter((row) => row.decidedAt && row.decidedAt >= since);
}

export type DecidedSummary = Awaited<ReturnType<typeof getSentBack>>[number];
