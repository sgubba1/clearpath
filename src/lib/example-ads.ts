import type { Channel, Product } from "@/db/schema";
import type { RuleId } from "@/lib/rules/catalog";

// Ready-made ads behind the form's "Try an example" menu, so evaluators can see the
// pre-check work without writing copy. Each is also a test ad: `npm run test:rules`
// checks it gets exactly these flags and that applying the suggested fixes clears them.

export type ExampleAd = {
  id: string;
  label: string;
  description: string;
  for: "in_house" | "affiliate";
  campaign: string;
  product: Product;
  channel: Channel;
  fields: Record<string, string>;
  expected: RuleId[];
};

const FOOTER =
  "Unsubscribe: clearpath.example.com/unsubscribe · ClearPath Financial, 100 Example Way, Suite 400, Columbus, OH 43215";

export const EXAMPLE_ADS: ExampleAd[] = [
  {
    id: "consolidation-email",
    label: "Debt consolidation email",
    description: "Reads like normal marketing copy. Five things in it would get sent back.",
    for: "in_house",
    campaign: "Credit card payoff email",
    product: "personal_loan",
    channel: "email",
    fields: {
      subject: "Pay off your credit cards faster",
      preheader: "One fixed monthly payment and no fees.",
      body: "Consolidate your credit card debt with rates as low as 8.99% APR. Check your rate and apply in minutes with no impact to your credit score. Get funds as soon as tomorrow. Save $3,000 on interest.",
      footer: FOOTER,
    },
    expected: ["fee-claim", "lowest-rate-conditions", "credit-impact", "funding-speed", "savings-claim"],
  },
  {
    id: "mortgage-social",
    label: "Mortgage rate post",
    description: "A rate post for Instagram with the disclosures left for the bio.",
    for: "in_house",
    campaign: "Mortgage rate watch",
    product: "mortgage_prequal",
    channel: "social",
    fields: {
      platform: "Instagram",
      postCopy: "Rates just dropped. Lock in 6.42% APR on a 30-year fixed and see if you prequalify in minutes. Full terms in bio.",
      link: "https://clearpath.example.com/mortgage/prequal",
    },
    expected: ["mortgage-rate-basis", "terms-off-ad", "missing-nmls"],
  },
  {
    id: "loan-sms",
    label: "Personal loan text",
    description: "Short, friendly and missing two things a text message needs.",
    for: "in_house",
    campaign: "Holiday expenses SMS",
    product: "personal_loan",
    channel: "sms",
    fields: {
      message: "ClearPath: Holiday bills piling up? Personal loans 8.99%-35.99% APR, funds as soon as tomorrow. Check your rate: clearpath.example.com/r/hol",
      consentSource: "Opt-in checkbox at checkout on clearpath.example.com",
    },
    expected: ["funding-speed", "sms-opt-out"],
  },
  {
    id: "partner-review",
    label: "Comparison site review",
    description: "A typical partner placement: an enthusiastic pick with no paid-referral disclosure.",
    for: "affiliate",
    campaign: "Best debt consolidation loans",
    product: "personal_loan",
    channel: "affiliate",
    fields: {
      placementUrl: "https://brightpath-rates.example.com/best-consolidation-loans",
      copy: "Our #1 pick for debt consolidation: ClearPath personal loans with rates as low as 8.99% APR. Get pre-approved in minutes and get funds as soon as tomorrow.",
    },
    expected: ["ranking-claim", "lowest-rate-conditions", "preapproved-claim", "funding-speed", "affiliate-disclosure"],
  },
  {
    id: "partner-aggressive",
    label: "Aggressive lead-gen ad",
    description: "The kind of partner copy that gets lenders in trouble with regulators.",
    for: "affiliate",
    campaign: "Fast cash loans placement",
    product: "personal_loan",
    channel: "affiliate",
    fields: {
      placementUrl: "https://brightpath-rates.example.com/fast-cash",
      copy: "Guaranteed approval with no credit check! Borrow $5,000 for just $199/month. We are the lender that says yes. Best rates guaranteed, apply today.",
    },
    expected: [
      "guaranteed-approval",
      "credit-impact",
      "closed-end-trigger-terms",
      "affiliate-implies-lender",
      "affiliate-implies-lender",
      "affiliate-disclosure",
    ],
  },
];
