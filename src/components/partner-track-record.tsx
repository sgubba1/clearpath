import Link from "next/link";
import { getRule } from "@/lib/rules/catalog";

type Record = {
  days: number;
  ads: number;
  flagged: number;
  sentBack: number;
  rejected: number;
  approvedFirstRound: number;
  topIssue?: { ruleId: string; count: number };
};

// One line of context for a partner's ad: how this partner's other recent ads went.
export function PartnerTrackRecord({ partnerName, record }: { partnerName: string; record: Record }) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const possessive = partnerName.endsWith("s") ? `${partnerName}'` : `${partnerName}'s`;
  const concerning = record.ads > 0 && (record.rejected > 0 || record.flagged / record.ads >= 0.5);
  // Reads as a sentence and skips what didn't happen, e.g. "3 other ads in the last 90 days:
  // all 3 flagged on first submission, 1 sent back, 2 rejected."
  const outcomes = [
    record.flagged === record.ads ? `all ${record.ads} flagged on first submission` : `${record.flagged} flagged on first submission`,
    record.sentBack ? `${record.sentBack} sent back` : null,
    record.rejected ? `${record.rejected} rejected` : null,
    record.approvedFirstRound ? `${record.approvedFirstRound} approved first time` : null,
  ].filter(Boolean);
  // With a single ad, describe what happened to it rather than counting.
  const single = [
    record.flagged ? "flagged on first submission" : "clean on first submission",
    record.sentBack ? "sent back" : null,
    record.rejected ? "rejected" : record.approvedFirstRound ? "approved first time" : null,
  ].filter(Boolean) as string[];
  const singleText = single.length > 1 ? `${single.slice(0, -1).join(", ")} and ${single.at(-1)}` : single[0];

  return (
    <section
      aria-label={`${partnerName} track record`}
      className={
        concerning
          ? "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          : "rounded-lg border bg-card px-4 py-3 text-sm"
      }
    >
      <span className="font-medium">{possessive} track record: </span>
      {record.ads === 0 ? (
        <>no other ads in the last {record.days} days.</>
      ) : (
        <>
          {record.ads === 1
            ? `1 other ad in the last ${record.days} days. It was ${singleText}.`
            : `${plural(record.ads, "other ad")} in the last ${record.days} days: ${outcomes.join(", ")}.`}
          {record.topIssue && (
            <>
              {" "}
              Most common issue:{" "}
              <Link href={`/rules#${record.topIssue.ruleId}`} className="underline underline-offset-2">
                {getRule(record.topIssue.ruleId).title}
              </Link>
              .
            </>
          )}
        </>
      )}
    </section>
  );
}
