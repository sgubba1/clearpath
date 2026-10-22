"use server";

import type { Channel, Product } from "@/db/schema";
import { runAiReview, type AiReviewResult } from "@/lib/ai-review";
import { getRateSheet } from "@/lib/rate-sheet";
import { getRule } from "@/lib/rules/catalog";
import { precheck } from "@/lib/rules/engine";
import { getIdentity } from "@/lib/session";
import { getTeamRules } from "@/lib/team-rules";

// Runs on request from the pre-check panel or the review screen. The rule check is re-run
// here so the AI is told what's already flagged, whatever the browser sent.
export async function getAiSecondOpinion(input: { product: Product; channel: Channel; fields: Record<string, string> }): Promise<AiReviewResult> {
  if (!(await getIdentity())) return { status: "error", message: "Pick a role first." };
  const rateSheet = await getRateSheet();
  const findings = precheck(input, rateSheet, await getTeamRules());
  return runAiReview({
    ...input,
    rates: rateSheet[input.product],
    ruleFindings: findings.map((finding) => ({ ruleTitle: getRule(finding.ruleId).title, matchText: finding.matchText })),
  });
}
