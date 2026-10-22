import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { auditEvents, comments, flags, partners, rateSheet, submissions, teamRules, versions, type Channel, type Product } from "@/db/schema";
import { toRateSheet } from "@/lib/rate-sheet";
import { precheck } from "@/lib/rules/engine";
import { getRule, type RuleId } from "@/lib/rules/catalog";
import { PARTNERS, RATE_SHEET } from "@/lib/reference-data";
import { riskScore } from "@/lib/risk";
import {
  CLEAN_COPY,
  COPY_WITHOUT_TERMS,
  PARTNER_DISCLOSURE,
  FOOTER,
  HISTORY,
  PEOPLE,
  SHORT_COPY,
  SUBJECTS,
  SUBMISSIONS,
  TEAM_RULE,
  VIOLATION_PHRASES,
  type PersonKey,
  type SeedSubmission,
  type SeedVersion,
} from "@/db/seed-data";

const HOUR = 3_600_000;
const RATES = toRateSheet(RATE_SHEET);

type SubmissionRow = typeof submissions.$inferInsert;
type VersionRow = typeof versions.$inferInsert;
type FlagRow = typeof flags.$inferInsert;
type CommentRow = typeof comments.$inferInsert;
type EventRow = typeof auditEvents.$inferInsert;

// A submission's rows before ids exist; ids are filled in level by level after each bulk insert.
type Plan = {
  submission: SubmissionRow;
  versions: { row: Omit<VersionRow, "submissionId">; flags: Omit<FlagRow, "versionId">[]; comments: (Omit<CommentRow, "versionId" | "flagId"> & { onFlag?: RuleId })[] }[];
  events: Omit<EventRow, "submissionId">[];
};

// Wipes every table and loads the demo data. Used by `npm run db:seed` and the in-app reset button.
// Inserts each table in one bulk statement so a reset takes a few round trips, not hundreds.
export async function seedDatabase(db: Db, now = new Date()) {
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);
  const inDays = (days: number) => new Date(now.getTime() + days * 24 * HOUR).toISOString().slice(0, 10);

  // Oldest first, so reference numbers rise with time like a real system.
  const plans = [...SUBMISSIONS, ...HISTORY.map(historyToSubmission)]
    .sort((a, b) => b.versions[0].hoursAgo - a.versions[0].hoursAgo)
    .map((item) => planSubmission(item, ago, inDays, now));

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`TRUNCATE audit_events, comments, flags, versions, submissions, partners, rate_sheet, team_rules RESTART IDENTITY CASCADE`,
    );
    await tx.insert(partners).values(PARTNERS);
    await tx.insert(rateSheet).values(RATE_SHEET);

    // Postgres returns rows from a multi-row INSERT in input order, so ids map back by index.
    const submissionIds = await tx.insert(submissions).values(plans.map((plan) => plan.submission)).returning({ id: submissions.id });

    const versionInputs = plans.flatMap((plan, i) => plan.versions.map((version) => ({ ...version, submissionId: submissionIds[i].id })));
    const versionIds = await tx
      .insert(versions)
      .values(versionInputs.map((version) => ({ ...version.row, submissionId: version.submissionId })))
      .returning({ id: versions.id });

    const flagInputs = versionInputs.flatMap((version, i) => version.flags.map((flag) => ({ ...flag, versionId: versionIds[i].id })));
    const flagIds = flagInputs.length ? await tx.insert(flags).values(flagInputs).returning({ id: flags.id }) : [];
    const flagIdFor = (versionId: number, ruleId: string) => {
      const index = flagInputs.findIndex((flag) => flag.versionId === versionId && flag.ruleId === ruleId);
      return index >= 0 ? flagIds[index].id : null;
    };

    const commentRows = versionInputs.flatMap((version, i) =>
      version.comments.map(({ onFlag, ...comment }) => ({
        ...comment,
        versionId: versionIds[i].id,
        flagId: onFlag ? flagIdFor(versionIds[i].id, onFlag) : null,
      })),
    );
    if (commentRows.length) await tx.insert(comments).values(commentRows);

    await tx.insert(auditEvents).values(plans.flatMap((plan, i) => plan.events.map((event) => ({ ...event, submissionId: submissionIds[i].id }))));

    // One rule the team added in the app, so the library shows built-in and team rules side by side.
    const ruleAddedAt = ago(6 * 24);
    const [rule] = await tx
      .insert(teamRules)
      .values({ ...TEAM_RULE, createdById: PEOPLE.priya.id, createdByName: PEOPLE.priya.name, createdAt: ruleAddedAt })
      .returning({ id: teamRules.id });
    await tx.insert(auditEvents).values({
      submissionId: null,
      versionNumber: null,
      actorId: PEOPLE.priya.id,
      actorName: PEOPLE.priya.name,
      actorRole: "manager",
      action: "rule_added",
      detail: `${TEAM_RULE.title} (team-${rule.id})`,
      createdAt: ruleAddedAt,
    });
  });

  return { submissions: plans.length };
}

function planSubmission(item: SeedSubmission, ago: (hours: number) => Date, inDays: (days: number) => string, now: Date): Plan {
  const submitter = PEOPLE[item.submitter];
  const reviewer = item.reviewer ? PEOPLE[item.reviewer] : undefined;
  const first = item.versions[0];
  const latest = item.versions[item.versions.length - 1];
  const isDraft = item.status === "draft";
  const launchDate = inDays(item.launchInDays);

  // Flags come from the real pre-check, so the demo always matches what the rules catch.
  const findingsFor = (version: SeedVersion) =>
    item.approvedUnderOldRates ? [] : precheck({ product: item.product, channel: item.channel, fields: version.fields }, RATES);
  const score = riskScore({
    openFlagSeverities: findingsFor(latest).map((finding) => finding.severity),
    submitterType: submitter.role === "affiliate" ? "affiliate" : "in_house",
    product: item.product,
    launchDate,
    now,
  });

  const plan: Plan = {
    submission: {
      product: item.product,
      channel: item.channel,
      campaign: item.campaign,
      launchDate,
      submitterId: submitter.id,
      submitterName: submitter.name,
      submitterType: submitter.role === "affiliate" ? "affiliate" : "in_house",
      partnerId: "partnerId" in submitter ? submitter.partnerId : null,
      status: item.status,
      riskScore: score,
      currentVersion: item.versions.length,
      reviewerId: reviewer?.id ?? null,
      reviewerName: reviewer?.name ?? null,
      createdAt: ago(first.hoursAgo + 0.5),
      submittedAt: isDraft ? null : ago(latest.hoursAgo),
      firstSubmittedAt: isDraft ? null : ago(first.hoursAgo),
      decidedAt: item.decidedHoursAgo !== undefined ? ago(item.decidedHoursAgo) : null,
      updatedAt: ago(item.decidedHoursAgo ?? Math.min(latest.hoursAgo, item.reviewStartedHoursAgo ?? Infinity)),
    },
    versions: [],
    events: [],
  };

  const event = (who: PersonKey, action: string, at: Date, versionNumber: number | null, detail?: string) => {
    const person = PEOPLE[who];
    plan.events.push({
      versionNumber,
      actorId: person.id,
      actorName: person.name,
      actorRole: person.role,
      action,
      detail: detail ?? null,
      createdAt: at,
    });
  };

  event(item.submitter, "created", ago(first.hoursAgo + 0.5), 1, item.campaign);

  for (const [index, version] of item.versions.entries()) {
    const number = index + 1;
    const versionAt = ago(version.hoursAgo);

    const flagRows = isDraft
      ? []
      : findingsFor(version).map((finding) => ({
          ruleId: finding.ruleId,
          field: finding.field,
          matchText: finding.matchText,
          detail: finding.detail ?? null,
          start: finding.start,
          end: finding.end,
          severity: finding.severity,
          // Anything still flagged at submit was sent with a reason.
          status: "acknowledged" as const,
          reason: version.reason ?? "Sent without changes.",
        }));
    for (const comment of version.comments ?? []) {
      if (comment.onFlag && !flagRows.some((flag) => flag.ruleId === comment.onFlag)) {
        throw new Error(`Seed: comment on "${comment.onFlag}" but the pre-check found no such flag in "${item.campaign}"`);
      }
    }

    plan.versions.push({
      row: { number, fields: version.fields, changeNote: version.changeNote ?? null, createdAt: versionAt },
      flags: flagRows,
      comments: (version.comments ?? []).map((comment) => ({
        onFlag: comment.onFlag,
        authorId: PEOPLE[comment.author].id,
        authorName: PEOPLE[comment.author].name,
        body: comment.body,
        // Feedback on earlier rounds was addressed by the resubmission.
        resolved: index < item.versions.length - 1,
        createdAt: ago(comment.hoursAgo),
      })),
    });

    event(
      item.submitter,
      "prechecked",
      new Date(versionAt.getTime() - 10 * 60_000),
      number,
      flagRows.length ? `${flagRows.length} issue${flagRows.length === 1 ? "" : "s"} found` : "No issues found",
    );
    if (isDraft) continue;

    const acknowledged = flagRows.filter((flag) => flag.status === "acknowledged");
    if (acknowledged.length) {
      event(item.submitter, "flags_acknowledged", versionAt, number, `Sent with ${acknowledged.length} unresolved: "${acknowledged[0].reason}"`);
    }
    event(item.submitter, number === 1 ? "submitted" : "resubmitted", versionAt, number, version.changeNote);

    for (const comment of version.comments ?? []) {
      event(comment.author, "commented", ago(comment.hoursAgo), number, comment.onFlag ? `On "${getRule(comment.onFlag).title}"` : "General note");
    }
    if (item.versions[index + 1] && item.reviewer) {
      event(item.reviewer, "changes_requested", ago(item.versions[index + 1].hoursAgo + 2), number);
    }
  }

  if (item.reviewer && item.reviewStartedHoursAgo !== undefined) {
    event(item.reviewer, "review_started", ago(item.reviewStartedHoursAgo), item.versions.length);
  }
  if (item.reviewer && item.status === "changes_requested") {
    const lastComment = latest.comments?.at(-1);
    event(item.reviewer, "changes_requested", ago(lastComment ? lastComment.hoursAgo - 0.05 : 1), item.versions.length);
  }
  if (item.reviewer && item.decidedHoursAgo !== undefined && (item.status === "approved" || item.status === "rejected")) {
    event(item.reviewer, item.status, ago(item.decidedHoursAgo), item.versions.length);
  }

  return plan;
}

// Builds a closed submission from a compact history row: v1 carries the issues, v2 fixes them.
function historyToSubmission([product, channel, submitter, reviewer, daysAgo, hoursToDecision, issues, outcome, campaign]: (typeof HISTORY)[number]): SeedSubmission {
  const firstHoursAgo = daysAgo * 24;
  const decidedHoursAgo = firstHoursAgo - hoursToDecision;
  const issueText = issues.map((rule) => VIOLATION_PHRASES[rule]).join(" ");

  // Rules about missing terms only fire when the terms are absent, so round 1 drops them; texts use the short copy.
  const needsBareCopy = issues.some((rule) => ["closed-end-trigger-terms", "open-end-trigger-terms", "mortgage-rate-basis"].includes(rule));
  const base = channel === "sms" ? SHORT_COPY[product] : (needsBareCopy ? COPY_WITHOUT_TERMS : CLEAN_COPY)[product];
  const v1Copy = issueText ? `${issueText} ${base}` : undefined;
  const v1: SeedVersion = {
    hoursAgo: firstHoursAgo,
    fields: fieldsFor(channel, product, submitter, v1Copy),
    reason: issues.length ? "Reviewed with my manager before submitting." : undefined,
    comments: issues.length
      ? [{ author: reviewer, onFlag: issues[0], body: getRule(issues[0]).fixHint, hoursAgo: firstHoursAgo - hoursToDecision * 0.4 }]
      : [],
  };

  const found = precheck({ product, channel, fields: v1.fields }, RATES).map((finding) => finding.ruleId);
  if (found.slice().sort().join() !== issues.slice().sort().join()) {
    throw new Error(`Seed: "${campaign}" expected ${issues.join(", ") || "no flags"} but the pre-check found ${found.join(", ") || "none"}`);
  }

  const fixedInRound2 = issues.length > 0 && outcome === "approved";
  const versionsList: SeedVersion[] = fixedInRound2
    ? [v1, { hoursAgo: firstHoursAgo - hoursToDecision * 0.7, changeNote: "Fixed the flagged wording.", fields: fieldsFor(channel, product, submitter) }]
    : [v1];

  return {
    product,
    channel,
    campaign,
    launchInDays: -daysAgo + 5,
    submitter,
    status: outcome,
    reviewer,
    reviewStartedHoursAgo: firstHoursAgo - Math.min(6, hoursToDecision * 0.2),
    decidedHoursAgo,
    versions: versionsList,
  };
}

function fieldsFor(channel: Channel, product: Product, submitter: PersonKey, copy?: string): Record<string, string> {
  const text = copy ?? CLEAN_COPY[product];
  switch (channel) {
    case "email":
      return { subject: SUBJECTS[product], preheader: "Takes a few minutes. No impact to your credit score.", body: text, footer: FOOTER };
    case "sms":
      return { message: copy ?? SHORT_COPY[product], consentSource: "Opt-in checkbox at checkout on clearpath.example.com" };
    case "social":
      return { platform: "Facebook", postCopy: text, link: "https://clearpath.example.com/offers" };
    case "affiliate":
      return { placementUrl: `https://${submitter}.example.com/clearpath`, copy: `${text} ${PARTNER_DISCLOSURE}` };
    case "landing_page":
      return { url: "https://clearpath.example.com/offers", copy: text };
    case "paid_search":
      return { url: "https://clearpath.example.com/offers", copy: text };
  }
}
