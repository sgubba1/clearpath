import type { Product, Severity } from "@/db/schema";

// Assumption, stated in the README: risk is the sum of unresolved flag severities, plus
// bumps for the riskiest submitters, products and timelines. Reviewers start at the top.
const SEVERITY_POINTS: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const AFFILIATE_BUMP = 2;
const MORTGAGE_BUMP = 1;
const RUSH_BUMP = 2;
const RUSH_DAYS = 3;

export function riskScore(input: {
  openFlagSeverities: Severity[];
  submitterType: "in_house" | "affiliate";
  product: Product;
  launchDate: string; // YYYY-MM-DD
  now?: Date;
}): number {
  const flagPoints = input.openFlagSeverities.reduce((sum, severity) => sum + SEVERITY_POINTS[severity], 0);
  const daysToLaunch = (Date.parse(`${input.launchDate}T00:00:00`) - (input.now ?? new Date()).getTime()) / 86_400_000;

  return (
    flagPoints +
    (input.submitterType === "affiliate" ? AFFILIATE_BUMP : 0) +
    (input.product === "mortgage_prequal" ? MORTGAGE_BUMP : 0) +
    (daysToLaunch <= RUSH_DAYS ? RUSH_BUMP : 0)
  );
}

export type RiskLevel = "high" | "medium" | "low";

export function riskLevel(score: number): RiskLevel {
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}
