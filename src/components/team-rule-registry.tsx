"use client";

import { registerTeamRules, type TeamRule } from "@/lib/rules/catalog";

// Makes team rules available to rule lookups in the browser. Rendered in the layout before
// the page, so flags from team rules show their title and explanation everywhere.
export function TeamRuleRegistry({ rules }: { rules: TeamRule[] }) {
  registerTeamRules(rules);
  return null;
}
