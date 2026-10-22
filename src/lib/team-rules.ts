import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { teamRules } from "@/db/schema";
import { registerTeamRules, type RuleCategory, type TeamRule } from "@/lib/rules/catalog";

type Row = typeof teamRules.$inferSelect;

export function toTeamRule(row: Row): TeamRule {
  return {
    id: `team-${row.id}`,
    category: row.category as RuleCategory,
    title: row.title,
    severity: row.severity,
    regulation: row.source || "Team rule",
    sourceUrl: row.sourceUrl ?? "",
    products: row.products?.length ? row.products : "all",
    channels: row.channels?.length ? row.channels : "all",
    whyItMatters: row.whyItMatters,
    fixHint: row.fixHint,
    team: {
      kind: row.kind,
      phrases: row.phrases,
      requiredText: row.requiredText,
      replacement: row.replacement,
      active: row.active,
      createdByName: row.createdByName,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

// Loads every team rule (including turned-off ones, so old flags still explain themselves)
// and registers them for rule lookups in this process.
export async function getTeamRules(): Promise<TeamRule[]> {
  const rules = (await getDb().select().from(teamRules).orderBy(asc(teamRules.createdAt))).map(toTeamRule);
  registerTeamRules(rules);
  return rules;
}
