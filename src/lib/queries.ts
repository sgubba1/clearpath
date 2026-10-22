import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, partners, submissions, versions } from "@/db/schema";
import type { Identity } from "@/lib/identities";

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
export async function getQueue() {
  return getDb()
    .select(submissionColumns)
    .from(submissions)
    .leftJoin(partners, eq(submissions.partnerId, partners.id))
    .where(inArray(submissions.status, ["submitted", "in_review"]))
    .orderBy(desc(submissions.riskScore), asc(submissions.submittedAt));
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
