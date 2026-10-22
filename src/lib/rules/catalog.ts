import type { Channel, Product, Severity } from "@/db/schema";

// The rule library. Each rule explains itself in plain language first; the citation is
// there for reviewers who want it. Detection logic lives in the pre-check engine and
// refers to rules by id. Illustrative only, not legal advice.

export type RuleMeta = {
  id: string;
  title: string; // plain-language name shown on the flag
  severity: Severity;
  regulation: string; // short citation for reviewers
  sourceUrl: string;
  products: Product[] | "all";
  channels: Channel[] | "all";
  whyItMatters: string; // one line on the consumer harm
  fixHint: string; // how to fix, shown with the suggested rewrite
  // Channel rules from general knowledge rather than a verified source are labeled as examples.
  exampleOnly?: boolean;
};

const ALL_PRODUCTS = "all" as const;
const ALL_CHANNELS = "all" as const;

export const RULES = [
  {
    id: "guaranteed-approval",
    title: "Promises approval",
    severity: "high",
    regulation: "UDAAP / FTC Act §5 (deceptive claims)",
    sourceUrl: "https://lashback.com/4-real-udaap-compliance-violations-found-in-marketing-emails",
    products: ALL_PRODUCTS,
    channels: ALL_CHANNELS,
    whyItMatters:
      "Every application is underwritten, so promising approval misleads people who may be declined, and a decline can still cost them a hard inquiry. Rare in ClearPath's own copy; common in partner placements.",
    fixHint: "Describe the process instead of the outcome, e.g. \"Check your rate in minutes.\"",
  },
  {
    id: "credit-impact",
    title: "Overstates how little applying affects credit",
    severity: "high",
    regulation: "UDAAP / FTC Act §5 (deceptive claims)",
    sourceUrl: "https://lashback.com/4-real-udaap-compliance-violations-found-in-marketing-emails",
    products: ALL_PRODUCTS,
    channels: ALL_CHANNELS,
    whyItMatters:
      "Checking a rate uses a soft inquiry, but applying means a hard inquiry that can lower a credit score. Copy that blurs the two (\"apply with no impact to your credit\") leads people to apply expecting no effect.",
    fixHint: "Tie \"no impact\" to checking your rate only, and say that applying results in a hard inquiry.",
  },
  {
    id: "closed-end-trigger-terms",
    title: "Payment or term mentioned without the APR",
    severity: "high",
    regulation: "Reg Z §1026.24(d) (closed-end triggering terms)",
    sourceUrl: "https://nafcu.org/node/35796",
    products: ["personal_loan", "mortgage_prequal"],
    channels: ALL_CHANNELS,
    whyItMatters:
      "A monthly payment or loan length on its own makes a loan look cheaper than it is. People need the APR and repayment terms to compare offers.",
    fixHint: "Add the APR range and repayment terms next to the payment amount.",
  },
  {
    id: "open-end-trigger-terms",
    title: "Card rate or fee mentioned without full rate terms",
    severity: "high",
    regulation: "Reg Z §1026.16(b) (open-end triggering terms)",
    sourceUrl: "https://nafcu.org/node/35796",
    products: ["credit_card"],
    channels: ALL_CHANNELS,
    whyItMatters:
      "An intro rate or \"no annual fee\" without the ongoing APR hides what the card costs once the promotion ends.",
    fixHint: "State the intro period and the ongoing APR range alongside the promotion.",
  },
  {
    id: "rate-not-offered",
    title: "Rate isn't on the current rate sheet",
    severity: "high",
    regulation: "Reg Z §1026.24(a) (advertise only terms actually available)",
    sourceUrl:
      "https://ncua.gov/regulation-supervision/manuals-guides/federal-consumer-financial-protection-guide/truth-lending-act-checklist",
    products: ALL_PRODUCTS,
    channels: ALL_CHANNELS,
    whyItMatters:
      "Advertising a rate nobody can get draws people in with an offer that doesn't exist. It usually happens innocently: copy written when rates were different gets reused after the rate sheet changes.",
    fixHint: "Use the current range from ClearPath's rate sheet.",
  },
  {
    id: "preapproved-claim",
    title: "Says \"pre-approved\" where it means prequalified",
    severity: "high",
    regulation: "FCRA §615(d) (prescreened offers)",
    sourceUrl:
      "https://www.ftc.gov/news-events/news/press-releases/1999/10/marketer-federally-insured-home-improvement-loans-agrees-pay-civil-penalty-violations-federal-law",
    products: ["credit_card", "personal_loan"],
    channels: ALL_CHANNELS,
    whyItMatters:
      "\"Pre-approved\" tells people credit is already theirs. Checking a rate is prequalification, not approval; only a prescreened firm offer with the opt-out notice can say pre-approved.",
    fixHint: "Use \"prequalified\" or \"See if you prequalify\" unless this is a prescreened campaign with the opt-out notice attached.",
  },
  {
    id: "missing-nmls",
    title: "Mortgage ad missing the NMLS ID",
    severity: "medium",
    regulation: "State licensing rules (e.g. 10 VAC 5-160-60)",
    sourceUrl: "https://law.lis.virginia.gov/admincode/title10/agency5/chapter160/section60/",
    products: ["mortgage_prequal"],
    channels: ALL_CHANNELS,
    whyItMatters: "The NMLS ID lets people look up the lender's license and complaint history before they apply.",
    fixHint: "Add \"ClearPath Financial, NMLS ID #2045817\" to the ad.",
  },
  {
    id: "affiliate-implies-lender",
    title: "Partner implies it's the lender or guarantees the best rate",
    severity: "high",
    regulation: "CFPB lead-generator enforcement (UDAAP)",
    sourceUrl:
      "https://www.consumerfinance.gov/about-us/newsroom/cfpb-takes-action-against-zero-parallel-steering-consumers-toward-bad-deals",
    products: ALL_PRODUCTS,
    channels: ["affiliate"],
    whyItMatters:
      "People should know who will actually lend to them. A comparison site posing as the lender, or promising the best rate, steers them on false terms.",
    fixHint: "Name ClearPath as the lender and describe the partner as a comparison or referral site.",
  },
  {
    id: "sms-opt-out",
    title: "Text message has no opt-out",
    severity: "medium",
    regulation: "TCPA (example check, not verified)",
    sourceUrl: "https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts",
    products: ALL_PRODUCTS,
    channels: ["sms"],
    whyItMatters: "People must be able to stop texts easily. Without \"Reply STOP\" they're stuck receiving them.",
    fixHint: "End the message with \"Reply STOP to opt out.\"",
    exampleOnly: true,
  },
  {
    id: "email-unsubscribe",
    title: "Email footer missing unsubscribe link or mailing address",
    severity: "medium",
    regulation: "CAN-SPAM (example check, not verified)",
    sourceUrl: "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business",
    products: ALL_PRODUCTS,
    channels: ["email"],
    whyItMatters: "People need a clear way to stop marketing emails and to know who is sending them.",
    fixHint: "Add an unsubscribe link and ClearPath's mailing address to the footer.",
    exampleOnly: true,
  },
  {
    id: "lowest-rate-conditions",
    title: "Lowest rate shown without its conditions",
    severity: "medium",
    regulation: "Reg Z §1026.24(a); UDAAP (net impression)",
    sourceUrl:
      "https://ncua.gov/regulation-supervision/manuals-guides/federal-consumer-financial-protection-guide/truth-lending-act-checklist",
    products: ["personal_loan"],
    channels: ALL_CHANNELS,
    whyItMatters:
      "ClearPath's lowest APR includes an autopay discount and needs excellent credit. \"As low as\" without that condition makes the teaser rate look like what most people will get.",
    fixHint: "Add \"with autopay\" next to the lowest rate, or show the full APR range.",
  },
  {
    id: "fee-claim",
    title: "Says \"no fees\" but a fee applies",
    severity: "high",
    regulation: "UDAAP / FTC Act §5; Reg Z finance charge disclosure",
    sourceUrl: "https://nafcu.org/node/35796",
    products: ["personal_loan", "mortgage_prequal"],
    channels: ALL_CHANNELS,
    whyItMatters:
      "ClearPath personal loans carry an origination fee of up to 8%, and mortgages have closing costs. \"No fees\" is one of the most common claims that turns out false in the fine print.",
    fixHint: "Drop the fee claim or name the fee. A true alternative for personal loans: \"no prepayment penalty\".",
  },
  {
    id: "funding-speed",
    title: "Promises funding speed without conditions",
    severity: "medium",
    regulation: "UDAAP / FTC Act §5 (net impression)",
    sourceUrl: "https://lashback.com/4-real-udaap-compliance-violations-found-in-marketing-emails",
    products: ["personal_loan"],
    channels: ALL_CHANNELS,
    whyItMatters:
      "Money arrives only after approval and verification, and on business days. \"Funds tomorrow\" sets an expectation ClearPath can't promise to everyone.",
    fixHint: "Say \"as soon as the next business day after approval\".",
  },
  {
    id: "savings-claim",
    title: "Specific savings claim with no basis shown",
    severity: "medium",
    regulation: "FTC Act §5 (substantiation)",
    sourceUrl: "https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation",
    products: ALL_PRODUCTS,
    channels: ALL_CHANNELS,
    whyItMatters:
      "\"Save $3,000\" depends on someone's current debt, rates and term. A specific figure needs the example behind it, or it promises a result most people won't see.",
    fixHint: "Say \"could\" and show the example, e.g. a $15,000 balance moved from 24.99% to 12.99% APR over 36 months.",
  },
  {
    id: "terms-off-ad",
    title: "Required terms pushed outside the ad",
    severity: "medium",
    regulation: "Reg Z §1026.24 (clear and conspicuous disclosure)",
    sourceUrl: "https://nafcu.org/node/35796",
    products: ALL_PRODUCTS,
    channels: ["social", "sms", "paid_search"],
    whyItMatters:
      "Disclosures have to be in the ad itself. \"Terms in bio\" or \"see site for details\" means most people never see them.",
    fixHint: "Put the APR range and key terms in the post or message itself.",
  },
  {
    id: "mortgage-rate-basis",
    title: "Mortgage rate shown without its date and assumptions",
    severity: "medium",
    regulation: "MAP Rule (Reg N) / Reg Z §1026.24",
    sourceUrl: "https://www.ifrahlaw.com/ftc-beat/cfpb-ftc-announce-crackdown-on-deceptive-mortgage-advertising/paged-3/3",
    products: ["mortgage_prequal"],
    channels: ALL_CHANNELS,
    whyItMatters:
      "Mortgage rates change daily and depend on credit score, down payment and points. A bare rate implies anyone can get it, any day.",
    fixHint: "Add the date and the assumptions behind the rate.",
  },
  {
    id: "ranking-claim",
    title: "Ranking or \"best\" claim without a source",
    severity: "medium",
    regulation: "FTC Act §5 (substantiation)",
    sourceUrl: "https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation",
    products: ALL_PRODUCTS,
    channels: ALL_CHANNELS,
    whyItMatters: "\"#1\" and \"best\" read as facts. Without a named source and date, they can't be backed up if challenged.",
    fixHint: "Cite the source and date, or describe the basis (\"Our pick for debt consolidation\").",
  },
  {
    id: "affiliate-disclosure",
    title: "Partner doesn't say it's paid for referrals",
    severity: "medium",
    regulation: "FTC Endorsement Guides (material connections)",
    sourceUrl: "https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking",
    products: ALL_PRODUCTS,
    channels: ["affiliate"],
    whyItMatters:
      "People weigh a comparison site's recommendation differently once they know it's paid. The relationship has to be disclosed near the recommendation.",
    fixHint: "Add \"We may be compensated when you apply through our links.\"",
  },
] as const satisfies readonly RuleMeta[];

export type RuleId = (typeof RULES)[number]["id"];

const byId = new Map<string, RuleMeta>(RULES.map((rule) => [rule.id, rule]));

export function getRule(id: string): RuleMeta {
  const rule = byId.get(id);
  if (!rule) throw new Error(`Unknown rule: ${id}`);
  return rule;
}

// Judgment calls stay with the reviewer as a checklist rather than automated verdicts.
export const REVIEWER_CHECKLIST = [
  "Does the fine print contradict or walk back the headline?",
  "Does the overall impression match the actual offer?",
  "Does anything imply a government program or affiliation?",
  "For partners: is it clear ClearPath is the lender?",
] as const;
