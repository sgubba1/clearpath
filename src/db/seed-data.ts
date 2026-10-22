import type { Channel, Product, Status } from "@/db/schema";
import type { RuleId } from "@/lib/rules/catalog";
import { ratesAsOfDate } from "@/lib/reference-data";

// Demo data. Everything here is fictional: people, partners, URLs, NMLS IDs and addresses.
// Times are relative to when the seed runs, so the demo always looks current.

export type Person = {
  id: string;
  name: string;
  role: "marketer" | "affiliate" | "reviewer" | "manager";
  partnerId?: string;
};

export const PEOPLE = {
  maya: { id: "maya", name: "Maya Alvarez", role: "marketer" },
  sam: { id: "sam", name: "Sam Okafor", role: "marketer" },
  lena: { id: "lena", name: "Lena Fischer", role: "marketer" },
  brightpath: { id: "brightpath", name: "Jordan Reyes", role: "affiliate", partnerId: "brightpath" },
  fundfinder: { id: "fundfinder", name: "Chris Novak", role: "affiliate", partnerId: "fundfinder" },
  cardcompass: { id: "cardcompass", name: "Ana Ruiz", role: "affiliate", partnerId: "cardcompass" },
  dev: { id: "dev", name: "Dev Patel", role: "reviewer" },
  hannah: { id: "hannah", name: "Hannah Brooks", role: "reviewer" },
  marcus: { id: "marcus", name: "Marcus Lee", role: "reviewer" },
  priya: { id: "priya", name: "Priya Shah", role: "manager" },
} as const satisfies Record<string, Person>;

export type PersonKey = keyof typeof PEOPLE;
type SubmitterKey = "maya" | "sam" | "lena" | "brightpath" | "fundfinder" | "cardcompass";
type ReviewerKey = "dev" | "hannah" | "marcus";

export type SeedComment = {
  author: ReviewerKey;
  body: string;
  // Rule of the flag this comment is about (the first flag for that rule); omit for a general note on the round.
  onFlag?: RuleId;
  hoursAgo: number;
};

export type SeedVersion = {
  hoursAgo: number;
  fields: Record<string, string>;
  changeNote?: string;
  // Flags come from running the pre-check on these fields. If any are found, the submitter
  // sent it anyway with this reason.
  reason?: string;
  comments?: SeedComment[];
};

export type SeedSubmission = {
  product: Product;
  channel: Channel;
  campaign: string;
  launchInDays: number;
  submitter: SubmitterKey;
  status: Status;
  // Approved under an earlier rate sheet: no flags at the time, but its rate is off today's sheet.
  approvedUnderOldRates?: boolean;
  reviewer?: ReviewerKey;
  reviewStartedHoursAgo?: number;
  decidedHoursAgo?: number;
  versions: SeedVersion[];
};

const FOOTER =
  "You're receiving this because you're a ClearPath customer. Unsubscribe: clearpath.example.com/unsubscribe · ClearPath Financial, 100 Example Way, Suite 400, Columbus, OH 43215 (fictional address)";
const NMLS = "ClearPath Financial, NMLS ID #2045817.";
const [asOfY, asOfM, asOfD] = ratesAsOfDate().split("-").map(Number);
const AS_OF = new Date(asOfY, asOfM - 1, asOfD).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
// Mortgage rates always carry their date and assumptions.
const MORTGAGE_BASIS = `Rate as of ${AS_OF}; assumes a 740 credit score and 20% down.`;
export const PARTNER_DISCLOSURE = "We may be compensated when you apply through our links.";

// The live queue and recent history: one story per item.
export const SUBMISSIONS: SeedSubmission[] = [
  {
    // The bad affiliate ad: top of the queue.
    product: "personal_loan",
    channel: "affiliate",
    campaign: "Fast cash personal loan placement",
    launchInDays: 2,
    submitter: "fundfinder",
    status: "submitted",
    versions: [
      {
        hoursAgo: 5,
        fields: {
          placementUrl: "https://fundfinder-daily.example.com/best-personal-loans",
          copy: "Guaranteed approval with no credit check! Borrow $5,000 for just $199/month. FundFinder Daily is the lender that says yes when banks say no. Best rates guaranteed, apply in 60 seconds.",
        },
        reason: "This wording ran on our site last year without issues.",
      },
    ],
  },
  {
    // Rate below the rate sheet, waiting past the 48-hour target.
    product: "personal_loan",
    channel: "affiliate",
    campaign: "Debt consolidation review page",
    launchInDays: 9,
    submitter: "cardcompass",
    status: "submitted",
    versions: [
      {
        hoursAgo: 52,
        fields: {
          placementUrl: "https://cardcompass.example.com/reviews/clearpath-personal-loan",
          copy: `Our pick for debt consolidation: ClearPath Financial personal loans with rates as low as 4.99% APR, terms from 24 to 60 months and no prepayment penalty. Checking your rate won't affect your credit score. ${PARTNER_DISCLOSURE}`,
        },
        reason: "Taken from ClearPath's rates page in March.",
      },
    ],
  },
  {
    // SMS missing "Reply STOP".
    product: "personal_loan",
    channel: "sms",
    campaign: "Home repair loans, fall SMS",
    launchInDays: 6,
    submitter: "sam",
    status: "submitted",
    versions: [
      {
        hoursAgo: 9,
        fields: {
          message: "ClearPath: Home repairs can't wait. Personal loans at 8.99%-35.99% APR, 24-60 mo terms. Check your rate: clearpath.example.com/r/home",
          consentSource: "Opt-in checkbox at checkout on clearpath.example.com",
        },
        reason: "Our SMS vendor appends opt-out text automatically.",
      },
    ],
  },
  {
    // Mortgage ad missing the NMLS ID, currently with Dev.
    product: "mortgage_prequal",
    channel: "social",
    campaign: "Homebuyer prequal social",
    launchInDays: 4,
    submitter: "lena",
    status: "in_review",
    reviewer: "dev",
    reviewStartedHoursAgo: 1,
    versions: [
      {
        hoursAgo: 26,
        fields: {
          platform: "Facebook",
          postCopy: `Thinking about buying next year? See if you prequalify for a home loan in minutes. Rates from 6.42% APR. ${MORTGAGE_BASIS} Checking won't affect your credit score.`,
          link: "https://clearpath.example.com/mortgage/prequal",
        },
        reason: "The NMLS ID is on the landing page the post links to.",
      },
    ],
  },
  {
    // Round 2: Maya added the APR after Dev's feedback. Shows the diff.
    product: "personal_loan",
    channel: "email",
    campaign: "Fall home project loans",
    launchInDays: 5,
    submitter: "maya",
    status: "submitted",
    versions: [
      {
        hoursAgo: 30,
        fields: {
          subject: "Your fall projects, funded",
          preheader: "Fixed monthly payments for the projects on your list.",
          body: "Kitchen refresh? New roof? Borrow $10,000 and pay just $208/month for 60 months. Funds can arrive as soon as the next business day after approval.",
          footer: FOOTER,
        },
        reason: "APR is on the landing page; I wanted to keep the email short.",
        comments: [
          { author: "dev", onFlag: "closed-end-trigger-terms", body: "The payment needs the APR right next to it, not just on the landing page. Our lowest rate is 8.99%, which matches $208/month on $10,000 over 60 months.", hoursAgo: 20 },
          { author: "dev", body: "Everything else is good. Add the APR and the full range and I can approve this quickly.", hoursAgo: 20 },
        ],
      },
      {
        hoursAgo: 3,
        changeNote: "Added the APR next to the payment and the full APR range.",
        fields: {
          subject: "Your fall projects, funded",
          preheader: "Fixed monthly payments for the projects on your list.",
          body: "Kitchen refresh? New roof? Borrow $10,000 and pay $208/month for 60 months at 8.99% APR, our lowest rate. APRs range from 8.99% to 35.99% based on your credit, so your rate may be higher. Funds can arrive as soon as the next business day after approval.",
          footer: FOOTER,
        },
      },
    ],
  },
  {
    // "You're preapproved" without a firm offer; Dev asked for changes.
    product: "credit_card",
    channel: "email",
    campaign: "Cash Back Card fall launch",
    launchInDays: 8,
    submitter: "maya",
    status: "changes_requested",
    reviewer: "dev",
    reviewStartedHoursAgo: 8,
    versions: [
      {
        hoursAgo: 28,
        fields: {
          subject: "Good news: you're preapproved",
          preheader: "Your new ClearPath Cash Back Card is waiting.",
          body: "You're preapproved for the ClearPath Cash Back Card! Earn 2% cash back on everything, with 0% intro APR and no annual fee. Claim your card today.",
          footer: FOOTER,
        },
        reason: "Sending to the Q3 customer list.",
        comments: [
          { author: "dev", onFlag: "preapproved-claim", body: "The Q3 list isn't a prescreened firm-offer list, so we can't say preapproved. \"See if you prequalify\" works in both places.", hoursAgo: 6 },
          { author: "dev", onFlag: "open-end-trigger-terms", body: "Add the intro length and the ongoing rate: \"0% intro APR on purchases for 12 months, then 19.99%–29.99% variable APR.\"", hoursAgo: 6 },
          { author: "dev", body: "Two fixes and this is ready. Both rewrites are on the flags.", hoursAgo: 6 },
        ],
      },
    ],
  },
  {
    // BrightPath (the demo affiliate) has feedback waiting.
    product: "credit_card",
    channel: "affiliate",
    campaign: "Top cash back cards roundup",
    launchInDays: 10,
    submitter: "brightpath",
    status: "changes_requested",
    reviewer: "dev",
    reviewStartedHoursAgo: 5,
    versions: [
      {
        hoursAgo: 22,
        fields: {
          placementUrl: "https://brightpath-rates.example.com/cards/cash-back",
          copy: `Our top cash back pick: the ClearPath Cash Back Card. Earn 2% on everything, pay no annual fee and enjoy 0% intro APR! ${PARTNER_DISCLOSURE}`,
        },
        reason: "Space is limited in the roundup widget.",
        comments: [
          { author: "dev", onFlag: "open-end-trigger-terms", body: "Add \"for 12 months, then 19.99%–29.99% variable APR\" after the intro offer. It fits on one more line in the widget.", hoursAgo: 4 },
          { author: "dev", body: "The rest looks good. Once the rate terms are in, this is ready to approve.", hoursAgo: 4 },
        ],
      },
    ],
  },
  {
    // BrightPath approved last week after one fix.
    product: "personal_loan",
    channel: "affiliate",
    campaign: "Personal loan comparison table",
    launchInDays: -2,
    submitter: "brightpath",
    status: "approved",
    reviewer: "hannah",
    reviewStartedHoursAgo: 150,
    decidedHoursAgo: 120,
    versions: [
      {
        hoursAgo: 170,
        fields: {
          placementUrl: "https://brightpath-rates.example.com/personal-loans",
          copy: "Need $5,000 to $40,000? We'll lend you the money at 8.99%–35.99% APR with 24–60 month terms. BrightPath Rates may be paid for referrals.",
        },
        reason: "Just a figure of speech.",
        comments: [
          { author: "hannah", onFlag: "affiliate-implies-lender", body: "ClearPath is the lender here, not BrightPath. Try \"Compare ClearPath personal loans\".", hoursAgo: 148 },
        ],
      },
      {
        hoursAgo: 124,
        changeNote: "Named ClearPath as the lender.",
        fields: {
          placementUrl: "https://brightpath-rates.example.com/personal-loans",
          copy: "Need $5,000 to $40,000? Compare ClearPath Financial personal loans at 8.99%–35.99% APR with 24–60 month terms. ClearPath is the lender; BrightPath Rates may be paid for referrals.",
        },
      },
    ],
  },
  {
    // The clean email that passes on the first try.
    product: "credit_card",
    channel: "email",
    campaign: "Cash Back Card welcome series",
    launchInDays: -1,
    submitter: "maya",
    status: "approved",
    reviewer: "dev",
    reviewStartedHoursAgo: 52,
    decidedHoursAgo: 50,
    versions: [
      {
        hoursAgo: 60,
        fields: {
          subject: "2% cash back on everything, no annual fee",
          preheader: "See if you prequalify in minutes. No impact to your credit score.",
          body: "Earn 2% cash back on every purchase with the ClearPath Cash Back Card. Enjoy 0% intro APR on purchases for 12 months, then a 19.99%–29.99% variable APR based on your credit. No annual fee. See if you prequalify in minutes.",
          footer: FOOTER,
        },
      },
    ],
  },
  {
    product: "mortgage_prequal",
    channel: "paid_search",
    campaign: "Mortgage prequal search",
    launchInDays: 1,
    submitter: "lena",
    status: "approved",
    reviewer: "marcus",
    reviewStartedHoursAgo: 30,
    decidedHoursAgo: 28,
    versions: [
      {
        hoursAgo: 40,
        fields: {
          url: "https://clearpath.example.com/mortgage/prequal",
          copy: `Prequalify for a Home Loan | Rates From 6.42% APR | ${MORTGAGE_BASIS} | ${NMLS} Prequalification is not a commitment to lend.`,
        },
      },
    ],
  },
  {
    product: "credit_card",
    channel: "social",
    campaign: "Everyday spending social",
    launchInDays: 0,
    submitter: "sam",
    status: "approved",
    reviewer: "hannah",
    reviewStartedHoursAgo: 20,
    decidedHoursAgo: 19,
    versions: [
      {
        hoursAgo: 27,
        fields: {
          platform: "Instagram",
          postCopy: "Groceries, gas, streaming: earn 2% cash back on all of it with the ClearPath Cash Back Card. No annual fee. Terms apply.",
          link: "https://clearpath.example.com/cards/cash-back",
        },
      },
    ],
  },
  {
    // Rejected: same partner, repeat issue.
    product: "credit_card",
    channel: "affiliate",
    campaign: "Best cards for fair credit",
    launchInDays: 3,
    submitter: "cardcompass",
    status: "rejected",
    reviewer: "marcus",
    reviewStartedHoursAgo: 50,
    decidedHoursAgo: 48,
    versions: [
      {
        hoursAgo: 72,
        fields: {
          placementUrl: "https://cardcompass.example.com/fair-credit",
          copy: "Fair credit? ClearPath approves everyone. Guaranteed approval and the lowest rate guaranteed on the ClearPath Cash Back Card.",
        },
        reason: "Standard language on our fair-credit pages.",
        comments: [
          {
            author: "marcus",
            body: "Rejecting: this promises approval and a guaranteed lowest rate, the same issues as last month's placement. Please start a new submission that names ClearPath as the issuer and drops the guarantees.",
            hoursAgo: 48,
          },
        ],
      },
    ],
  },
  {
    product: "personal_loan",
    channel: "landing_page",
    campaign: "Debt consolidation landing page",
    launchInDays: 7,
    submitter: "sam",
    status: "in_review",
    reviewer: "hannah",
    reviewStartedHoursAgo: 2,
    versions: [
      {
        hoursAgo: 18,
        fields: {
          url: "https://clearpath.example.com/debt-consolidation",
          copy: "One payment instead of five. Consolidate high-interest credit card debt with a ClearPath personal loan from $2,000 to $40,000. Fixed rates from 8.99% to 35.99% APR, terms from 24 to 60 months. Example: a $10,000 loan at 14.99% APR for 36 months has 36 monthly payments of $347. Checking your rate won't affect your credit score.",
        },
      },
    ],
  },
  {
    // Approved under last month's rate sheet. Still running, but 8.49% is no longer offered.
    product: "personal_loan",
    channel: "email",
    campaign: "Evergreen consolidation email",
    launchInDays: -17,
    submitter: "sam",
    status: "approved",
    approvedUnderOldRates: true,
    reviewer: "hannah",
    reviewStartedHoursAgo: 460,
    decidedHoursAgo: 456,
    versions: [
      {
        hoursAgo: 470,
        fields: {
          subject: "One payment instead of five",
          preheader: "Check your rate in minutes.",
          body: "Combine your credit card balances into one fixed monthly payment. Rates as low as 8.49% APR with autopay, up to 35.99% APR, with 24–60 month terms. Checking your rate won't affect your credit score.",
          footer: FOOTER,
        },
      },
    ],
  },
  {
    // Maya's draft: not yet submitted, so it isn't in the queue.
    product: "credit_card",
    channel: "social",
    campaign: "Holiday cash back push",
    launchInDays: 21,
    submitter: "maya",
    status: "draft",
    versions: [
      {
        hoursAgo: 1,
        fields: {
          platform: "Instagram",
          postCopy: "Holiday shopping, with 2% back on every gift. The ClearPath Cash Back Card has no annual fee.",
          link: "https://clearpath.example.com/cards/cash-back",
        },
      },
    ],
  },
];

// Closed items from the past month so turnaround, first-pass rate and top issues have real history.
// [product, channel, submitter, reviewer, days ago first submitted, hours to decision, v1 issues, outcome]
type HistoryRow = [Product, Channel, SubmitterKey, ReviewerKey, number, number, RuleId[], "approved" | "rejected", string];

// In-house ads show the subtle misses real marketers make; partners account for the blatant claims.
// The older half is slower with more rounds, the recent half faster: the trend the metrics compare.
export const HISTORY: HistoryRow[] = [
  ["personal_loan", "email", "maya", "dev", 29, 70, ["fee-claim", "lowest-rate-conditions"], "approved", "Refinance check-in email"],
  ["credit_card", "social", "sam", "hannah", 28, 40, [], "approved", "Cash back intro social"],
  ["personal_loan", "affiliate", "fundfinder", "marcus", 27, 96, ["guaranteed-approval", "credit-impact"], "rejected", "Bad credit loans listing"],
  ["mortgage_prequal", "email", "lena", "dev", 26, 74, ["mortgage-rate-basis"], "approved", "Rate drop alert"],
  ["credit_card", "affiliate", "cardcompass", "hannah", 24, 110, ["open-end-trigger-terms", "affiliate-implies-lender"], "approved", "Card comparison widget"],
  ["personal_loan", "sms", "sam", "dev", 22, 52, ["funding-speed"], "approved", "Wedding loans SMS"],
  ["credit_card", "email", "maya", "marcus", 21, 70, ["preapproved-claim"], "approved", "Card upgrade offer"],
  ["personal_loan", "affiliate", "brightpath", "dev", 19, 46, ["closed-end-trigger-terms"], "approved", "Loan calculator placement"],
  ["personal_loan", "email", "sam", "marcus", 18, 64, ["credit-impact", "savings-claim"], "approved", "Medical bills email"],
  ["mortgage_prequal", "social", "lena", "hannah", 17, 48, ["terms-off-ad"], "approved", "First-time buyer social"],
  ["personal_loan", "landing_page", "maya", "dev", 16, 58, ["lowest-rate-conditions", "funding-speed"], "approved", "Debt payoff landing page"],
  ["credit_card", "affiliate", "cardcompass", "dev", 13, 40, ["guaranteed-approval"], "rejected", "Instant approval cards list"],
  ["credit_card", "social", "maya", "hannah", 11, 18, [], "approved", "Travel spending social"],
  ["personal_loan", "landing_page", "sam", "dev", 9, 30, ["fee-claim"], "approved", "Auto repair loan page"],
  ["mortgage_prequal", "paid_search", "lena", "marcus", 7, 22, [], "approved", "Prequal search refresh"],
  ["personal_loan", "affiliate", "brightpath", "hannah", 6, 28, [], "approved", "Best loans of the month"],
  ["personal_loan", "email", "maya", "dev", 5, 26, ["lowest-rate-conditions"], "approved", "Home improvement email"],
  ["credit_card", "email", "maya", "dev", 4, 24, [], "approved", "Balance check reminder"],
  ["personal_loan", "social", "sam", "hannah", 3, 20, ["funding-speed"], "approved", "Quick cash social"],
  ["mortgage_prequal", "email", "lena", "marcus", 2, 18, [], "approved", "Rate watch email"],
];

// Compliant copy per product, and the phrase that triggers each rule, used to build history versions.
export const CLEAN_COPY: Record<Product, string> = {
  personal_loan:
    "Consolidate high-interest debt into one fixed monthly payment. Personal loans from $2,000 to $40,000 at 8.99%–35.99% APR with 24–60 month terms. Checking your rate won't affect your credit score.",
  credit_card:
    "Earn 2% cash back on every purchase with the ClearPath Cash Back Card. 0% intro APR on purchases for 12 months, then 19.99%–29.99% variable APR. No annual fee.",
  mortgage_prequal: `See if you prequalify for a home loan in minutes. Rates from 6.42% APR. ${MORTGAGE_BASIS} ${NMLS} Prequalification is not a commitment to lend.`,
};

// Copy without rate terms, used when a history item's first round tripped a trigger-term rule.
export const COPY_WITHOUT_TERMS: Record<Product, string> = {
  personal_loan: "Consolidate high-interest debt into one fixed monthly payment. Checking your rate won't affect your credit score.",
  credit_card: "Earn 2% cash back on every purchase with the ClearPath Cash Back Card. No annual fee.",
  mortgage_prequal: `See if you prequalify for a home loan in minutes. ${NMLS}`,
};

export const SHORT_COPY: Record<Product, string> = {
  personal_loan: "ClearPath: Personal loans at 8.99%-35.99% APR, 24-60 mo terms. Check your rate: clearpath.example.com/r/pl Reply STOP to opt out",
  credit_card: "ClearPath: 2% cash back, no annual fee. 0% intro APR 12 mo, then 19.99%-29.99%. clearpath.example.com/r/cb Reply STOP to opt out",
  mortgage_prequal: `ClearPath: Prequalify for a home loan. 6.42% APR as of ${AS_OF}. NMLS #2045817. clearpath.example.com/r/mp Reply STOP to opt out`,
};

export const VIOLATION_PHRASES: Partial<Record<RuleId, string>> = {
  "fee-claim": "No fees.",
  "lowest-rate-conditions": "Rates as low as 8.99% APR.",
  "funding-speed": "Funds as soon as tomorrow.",
  "credit-impact": "Apply with no impact to your credit score.",
  "savings-claim": "Save $2,400 on interest.",
  "mortgage-rate-basis": "Today's rate: 6.50% APR.",
  "terms-off-ad": "Full terms in bio.",
  "preapproved-claim": "You're preapproved.",
  "guaranteed-approval": "Approval guaranteed.",
  "closed-end-trigger-terms": "Payments as low as $149/month.",
  "open-end-trigger-terms": "0% intro APR!",
  "affiliate-implies-lender": "We are the lender.",
};

export const SUBJECTS: Record<Product, string> = {
  personal_loan: "One payment, one rate, one less thing to manage",
  credit_card: "2% cash back on everything you buy",
  mortgage_prequal: "See what you could prequalify for",
};

export { FOOTER };

// A rule the compliance team added in the app (ClearPath doesn't offer payday loans).
export const TEAM_RULE = {
  title: "Calls it a payday loan or cash advance",
  category: "brand",
  severity: "high" as const,
  kind: "phrases" as const,
  phrases: ["payday loan", "payday loans", "cash advance", "paycheck advance"],
  replacement: "personal loan",
  products: ["personal_loan" as const],
  channels: null,
  whyItMatters:
    "ClearPath doesn't offer payday loans or cash advances. Using those names misdescribes a fixed-rate installment loan and invites regulator attention reserved for short-term, high-cost lenders.",
  fixHint: "Call it a personal loan, and describe the fixed rate and term instead.",
  source: "ClearPath brand and product naming guidelines",
};
