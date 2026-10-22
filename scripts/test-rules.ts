import { applyFix, precheck, type RateSheet } from "../src/lib/rules/engine";
import { TEST_ADS } from "../src/lib/rules/test-ads";
import { RATE_SHEET } from "../src/lib/reference-data";

// Runs every test ad through the pre-check and compares flags with what's expected.
// Uses the rate sheet from code so it needs no database. Exits non-zero on any mismatch.

const rateSheet = Object.fromEntries(
  RATE_SHEET.map((r) => [
    r.product,
    {
      aprMin: r.aprMin,
      aprMax: r.aprMax,
      termMinMonths: r.termMinMonths ?? null,
      termMaxMonths: r.termMaxMonths ?? null,
      introAprMonths: r.introAprMonths ?? null,
      nmlsId: r.nmlsId ?? null,
    },
  ]),
) as RateSheet;

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

console.log(`\n${TEST_ADS.length - failures}/${TEST_ADS.length} test ads match their expected flags.`);
process.exit(failures ? 1 : 0);
