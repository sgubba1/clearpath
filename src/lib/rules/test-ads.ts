import type { AdInput } from "./engine";
import type { RuleId } from "./catalog";

// Known ads with the flags they should get. `npm run test:rules` runs these before each deploy,
// including clean ads that must stay clean so false positives get caught too.

export type TestAd = AdInput & { name: string; expected: RuleId[]; fixesShouldClear?: boolean };

const FOOTER =
  "Unsubscribe: clearpath.example.com/unsubscribe · ClearPath Financial, 100 Example Way, Suite 400, Columbus, OH 43215";

// The ad used in the demo: an affiliate pastes it, sees five flags, applies the fixes.
export const DEMO_AFFILIATE_COPY =
  "Guaranteed approval with no credit check! Borrow $5,000 for just $199/month. We are the lender that says yes. Best rates guaranteed, apply today.";


// Different wordings of the same claims, so the rules are tested beyond the demo sentence.
const affiliate = (name: string, copy: string, expected: RuleId[], fixesShouldClear = expected.length > 0): TestAd => ({
  name,
  product: "personal_loan",
  channel: "affiliate",
  fields: { placementUrl: "https://brightpath-rates.example.com/loans", copy },
  expected,
  fixesShouldClear,
});

const VARIANTS: TestAd[] = [
  affiliate("Variant: approval guaranteed", "Approval guaranteed, even with bad credit!", ["guaranteed-approval"]),
  affiliate("Variant: everyone gets approved", "Everyone gets approved. No credit check needed.", ["guaranteed-approval", "no-credit-check"]),
  affiliate("Variant: 100% approval", "100% approval rate for all applicants.", ["guaranteed-approval"]),
  affiliate("Variant: approved no matter what", "Get approved no matter what your credit looks like.", ["guaranteed-approval"]),
  affiliate("Variant: basically approved", "Bad credit? No problem. You're basically approved already.", ["guaranteed-approval"]),
  affiliate("Variant: never check credit", "We never check your credit.", ["no-credit-check"]),
  affiliate("Variant: payment a month", "Only $250 a month for 48 months.", ["closed-end-trigger-terms"]),
  affiliate("Variant: payment monthly", "Pay as little as $150 monthly.", ["closed-end-trigger-terms"]),
  affiliate("Variant: rate starting at", "Rates starting at 5.99% APR.", ["rate-not-offered"]),
  affiliate("Variant: lowest rates guaranteed", "Lowest rates in America, guaranteed.", ["affiliate-implies-lender"]),
  affiliate("Variant: partner lends", "BrightPath lends up to $40,000 fast.", ["affiliate-implies-lender"]),
  affiliate("Variant: never says no", "Apply with the lender that never says no.", ["guaranteed-approval"]),
  affiliate("Variant: our rates (flag only, no rewrite)", "Our rates beat the banks.", ["affiliate-implies-lender"], false),
  affiliate("Clean: decision wording", "Get a decision in minutes. Checking your rate won't affect your credit score.", []),
  affiliate("Clean: ClearPath lends", "ClearPath Financial lends $2,000 to $40,000 at 8.99%–35.99% APR.", []),
  affiliate("Clean: comparison wording", "Compare personal loan offers from ClearPath Financial and see if you prequalify.", []),
];

export const TEST_ADS: TestAd[] = [
  {
    name: "Demo affiliate ad",
    product: "personal_loan",
    channel: "affiliate",
    fields: { placementUrl: "https://brightpath-rates.example.com/loans", copy: DEMO_AFFILIATE_COPY },
    expected: ["guaranteed-approval", "no-credit-check", "closed-end-trigger-terms", "affiliate-implies-lender", "affiliate-implies-lender"],
    fixesShouldClear: true,
  },
  {
    name: "Compliant affiliate copy naming ClearPath as lender",
    product: "personal_loan",
    channel: "affiliate",
    fields: {
      placementUrl: "https://brightpath-rates.example.com/loans",
      copy: "Compare ClearPath Financial personal loans at 8.99%–35.99% APR with 24–60 month terms. ClearPath Financial is the lender; BrightPath Rates may be paid for referrals.",
    },
    expected: [],
  },
  {
    name: "Payment and term without APR (email)",
    product: "personal_loan",
    channel: "email",
    fields: { subject: "Your projects, funded", body: "Borrow $10,000 and pay just $208/month for 60 months.", footer: FOOTER },
    expected: ["closed-end-trigger-terms"],
    fixesShouldClear: true,
  },
  {
    name: "Rate below the rate sheet",
    product: "personal_loan",
    channel: "affiliate",
    fields: { placementUrl: "https://cardcompass.example.com/review", copy: "ClearPath personal loans with rates as low as 4.99% APR." },
    expected: ["rate-not-offered"],
    fixesShouldClear: true,
  },
  {
    name: "Rate above the rate sheet",
    product: "personal_loan",
    channel: "landing_page",
    fields: { url: "https://clearpath.example.com/loans", copy: "Fixed rates from 8.99% to 39.99% APR." },
    expected: ["rate-not-offered"],
    fixesShouldClear: true,
  },
  {
    name: "Representative example within the rate sheet",
    product: "personal_loan",
    channel: "landing_page",
    fields: {
      url: "https://clearpath.example.com/loans",
      copy: "Fixed rates from 8.99% to 35.99% APR, terms from 24 to 60 months. Example: a $10,000 loan at 14.99% APR for 36 months has 36 monthly payments of $347.",
    },
    expected: [],
  },
  {
    name: "Preapproved card email with intro rate only",
    product: "credit_card",
    channel: "email",
    fields: {
      subject: "Good news: you're preapproved",
      body: "You're preapproved for the ClearPath Cash Back Card! Earn 2% cash back with 0% intro APR and no annual fee.",
      footer: FOOTER,
    },
    expected: ["preapproved-claim", "preapproved-claim", "open-end-trigger-terms"],
    fixesShouldClear: true,
  },
  {
    name: "Prescreened firm offer may say preapproved",
    product: "credit_card",
    channel: "email",
    fields: {
      subject: "You're preapproved",
      body: "You're preapproved for the ClearPath Cash Back Card. 19.99%–29.99% variable APR. This prescreened offer includes your right to opt out of future offers; see the notice below.",
      footer: FOOTER,
    },
    expected: [],
  },
  {
    name: "Card intro rate with ongoing APR",
    product: "credit_card",
    channel: "email",
    fields: {
      subject: "2% cash back on everything",
      body: "Enjoy 0% intro APR on purchases for 12 months, then a 19.99%–29.99% variable APR. No annual fee.",
      footer: FOOTER,
    },
    expected: [],
  },
  {
    name: "Instant approval on social",
    product: "credit_card",
    channel: "social",
    fields: { platform: "Instagram", postCopy: "Instant approval on the ClearPath Cash Back Card. No annual fee." },
    expected: ["guaranteed-approval"],
    fixesShouldClear: true,
  },
  {
    name: "SMS without opt-out",
    product: "personal_loan",
    channel: "sms",
    fields: { message: "ClearPath: Personal loans at 8.99%-35.99% APR. Check your rate: clearpath.example.com/r/pl", consentSource: "Checkout opt-in" },
    expected: ["sms-opt-out"],
    fixesShouldClear: true,
  },
  {
    name: "SMS with opt-out",
    product: "personal_loan",
    channel: "sms",
    fields: { message: "ClearPath: Personal loans at 8.99%-35.99% APR. Reply STOP to opt out", consentSource: "Checkout opt-in" },
    expected: [],
  },
  {
    name: "Email footer without unsubscribe",
    product: "credit_card",
    channel: "email",
    fields: { subject: "2% cash back", body: "Earn 2% cash back on everything. No annual fee.", footer: "ClearPath Financial, 100 Example Way, Suite 400, Columbus, OH 43215" },
    expected: ["email-unsubscribe"],
    fixesShouldClear: true,
  },
  {
    name: "Mortgage post without NMLS ID",
    product: "mortgage_prequal",
    channel: "social",
    fields: { platform: "Facebook", postCopy: "See if you prequalify for a home loan in minutes. Rates from 6.42% APR." },
    expected: ["missing-nmls"],
    fixesShouldClear: true,
  },
  {
    name: "Mortgage term without APR",
    product: "mortgage_prequal",
    channel: "paid_search",
    fields: { url: "https://clearpath.example.com/mortgage", copy: "Lock in a 30-year fixed home loan today. ClearPath Financial, NMLS ID #2045817." },
    expected: ["closed-end-trigger-terms"],
    fixesShouldClear: true,
  },
  {
    name: "Clean mortgage search ad",
    product: "mortgage_prequal",
    channel: "paid_search",
    fields: { url: "https://clearpath.example.com/mortgage", copy: "Prequalify for a Home Loan | Rates From 6.42% APR | ClearPath Financial, NMLS ID #2045817." },
    expected: [],
  },
  {
    name: "Soft-pull wording is not a no-credit-check claim",
    product: "personal_loan",
    channel: "email",
    fields: { subject: "Check your rate", body: "Checking your rate won't affect your credit score. 8.99%–35.99% APR.", footer: FOOTER },
    expected: [],
  },
  ...VARIANTS,
];
