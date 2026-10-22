import type { Product, Severity } from "@/db/schema";

// Assumption, stated in the README: risk is the sum of unresolved flag severities, plus
// bumps for the riskiest submitters, products and timelines. Reviewers start at the top.
export const SEVERITY_POINTS: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const AFFILIATE_BUMP = 2;
const MORTGAGE_BUMP = 1;
const RUSH_BUMP = 2;
const RUSH_DAYS = 3;

type RiskInput = {
  openFlagSeverities: Severity[];
  submitterType: "in_house" | "affiliate";
  product: Product;
  launchDate: string; // YYYY-MM-DD
  now?: Date;
};

export type RiskPart = {
  kind: "flags" | "partner" | "mortgage" | "launch-soon" | "live";
  label: string;
  points: number;
  severity?: Severity;
  count?: number;
};

// The score and the reasons behind it, so the queue order is never a black box.
export function riskBreakdown(input: RiskInput): { score: number; parts: RiskPart[] } {
  const parts: RiskPart[] = [];
  for (const severity of ["high", "medium", "low"] as const) {
    const count = input.openFlagSeverities.filter((value) => value === severity).length;
    if (count) {
      parts.push({ kind: "flags", severity, count, label: `${count} ${severity}-severity flag${count === 1 ? "" : "s"}`, points: count * SEVERITY_POINTS[severity] });
    }
  }
  if (input.submitterType === "affiliate") parts.push({ kind: "partner", label: "Partner submission", points: AFFILIATE_BUMP });
  if (input.product === "mortgage_prequal") parts.push({ kind: "mortgage", label: "Mortgage", points: MORTGAGE_BUMP });
  const daysToLaunch = (Date.parse(`${input.launchDate}T00:00:00`) - (input.now ?? new Date()).getTime()) / 86_400_000;
  if (daysToLaunch <= RUSH_DAYS) {
    parts.push(
      daysToLaunch < 0
        ? { kind: "live", label: "Already live", points: RUSH_BUMP }
        : { kind: "launch-soon", label: "Launches within 3 days", points: RUSH_BUMP },
    );
  }
  return { score: parts.reduce((sum, part) => sum + part.points, 0), parts };
}

export function riskScore(input: RiskInput): number {
  return riskBreakdown(input).score;
}

export type RiskLevel = "high" | "medium" | "low";

export function riskLevel(score: number): RiskLevel {
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

// Assumption: the team aims to give a first decision within two days of submission.
export const REVIEW_TARGET_HOURS = 48;
