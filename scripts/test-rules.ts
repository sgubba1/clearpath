import type { TeamRule } from "../src/lib/rules/catalog";
import { applyFix, precheck } from "../src/lib/rules/engine";
import { toRateSheet } from "../src/lib/rate-sheet";
import { TEST_ADS } from "../src/lib/rules/test-ads";
import { RATE_SHEET } from "../src/lib/reference-data";

// Runs every test ad through the pre-check and compares flags with what's expected.
// Uses the rate sheet from code so it needs no database. Exits non-zero on any mismatch.

const rateSheet = toRateSheet(RATE_SHEET);

const count = (ids: string[]) => ids.slice().sort().join(", ") || "none";
let failures = 0;

for (const ad of TEST_ADS) {
  const findings = precheck(ad, rateSheet);
  const actual = count(findings.map((f) => f.ruleId));
  const expected = count(ad.expected);
  let ok = actual === expected;
  let note = "";

  // Applying every suggested rewrite should leave a clean ad.
  if (ok && ad.fixesShouldClear) {
    let fields = ad.fields;
    for (let i = 0; i < 10; i++) {
      const next = precheck({ ...ad, fields }, rateSheet).find((f) => f.replacement !== undefined);
      if (!next) break;
      fields = applyFix(fields, next);
    }
    const left = precheck({ ...ad, fields }, rateSheet);
    if (left.length) {
      ok = false;
      note = `  after fixes still flags: ${count(left.map((f) => f.ruleId))}`;
    }
  }

  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${ad.name}`);
  if (!ok) {
    console.log(`      expected: ${expected}`);
    console.log(`      actual:   ${actual}`);
    for (const f of findings) console.log(`        - ${f.ruleId} on ${f.field}: "${f.matchText}"`);
    if (note) console.log(note);
  }
}

// Team rules added in the app go through the same engine.
const teamRule = (id: number, team: Partial<TeamRule["team"]>, extra: Partial<TeamRule> = {}): TeamRule => ({
  id: `team-${id}`,
  category: "brand",
  title: `Team rule ${id}`,
  severity: "medium",
  regulation: "Team rule",
  sourceUrl: "",
  products: "all",
  channels: "all",
  whyItMatters: "",
  fixHint: "",
  team: { kind: "phrases", phrases: [], requiredText: null, replacement: null, active: true, createdByName: "Test", createdAt: "", ...team },
  ...extra,
});
const teamCases: [string, TeamRule, string, number][] = [
  ["Team phrase rule flags whole words", teamRule(1, { phrases: ["payday loan"], replacement: "personal loan" }), "Need a Payday Loan before Friday?", 1],
  ["Team phrase rule ignores partial words", teamRule(2, { phrases: ["cash"] }), "Earn cashback on everything.", 0],
  ["Team required-text rule flags when missing", teamRule(3, { kind: "required", requiredText: "Equal Housing Lender" }), "See if you prequalify.", 1],
  ["Team required-text rule passes when present", teamRule(4, { kind: "required", requiredText: "Equal Housing Lender" }), "See if you prequalify. equal housing lender.", 0],
  ["Turned-off team rule doesn't run", teamRule(5, { phrases: ["payday loan"], active: false }), "Get a payday loan.", 0],
  ["Team rule respects its products", teamRule(6, { phrases: ["payday loan"] }, { products: ["mortgage_prequal"] }), "Get a payday loan.", 0],
];
let teamTotal = 0;
for (const [name, rule, copy, expected] of teamCases) {
  teamTotal++;
  const found = precheck({ product: "personal_loan", channel: "landing_page", fields: { url: "https://x.example.com", copy } }, rateSheet, [rule]).filter((f) => f.ruleId === rule.id);
  const ok = found.length === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` (expected ${expected}, got ${found.length})`}`);
}

console.log(`\n${TEST_ADS.length + teamTotal - failures}/${TEST_ADS.length + teamTotal} test cases match their expected flags.`);
process.exit(failures ? 1 : 0);
