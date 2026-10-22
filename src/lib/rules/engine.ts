import type { Channel, Product, Severity } from "@/db/schema";
import { CHANNEL_FIELDS } from "@/lib/labels";
import { getRule, RULES, type RuleId, type RuleMeta, type TeamRule } from "./catalog";

// The pre-check. Pure and synchronous so the same code runs live in the browser as
// people type and again on the server when they submit.

export type RateTerms = {
  aprMin: number;
  aprMax: number;
  termMinMonths: number | null;
  termMaxMonths: number | null;
  introAprMonths: number | null;
  nmlsId: string | null;
  autopayDiscount: number | null;
  originationFeeMin: number | null;
  originationFeeMax: number | null;
  ratesAsOf: string | null;
  rateAssumptions: string | null;
};
export type RateSheet = Record<Product, RateTerms>;

export type Finding = {
  // A built-in rule id, or "team-<n>" for a rule compliance added.
  ruleId: string;
  severity: Severity;
  field: string;
  // Character range in the field. Equal start and end means something is missing.
  start: number;
  end: number;
  matchText: string;
  // Specific explanation for this instance, e.g. which rate is off and by how much.
  detail?: string;
  // A compliant replacement for [replaceStart ?? start, replaceEnd ?? end). For missing items this is text to append.
  replacement?: string;
  // Set when the fix rewrites more than the highlight, e.g. the whole sentence.
  replaceStart?: number;
  // Set when the fix needs to rewrite past the highlight, e.g. adding the APR at the end of the sentence.
  replaceEnd?: number;
};

export type AdInput = { product: Product; channel: Channel; fields: Record<string, string> };

type Ctx = AdInput & { rates: RateTerms; allText: string; mainField: string };
type Detector = (ctx: Ctx) => Omit<Finding, "ruleId" | "severity">[];

const pct = (n: number) => `${n.toFixed(2)}%`;
const range = (r: RateTerms) => `${pct(r.aprMin)}–${pct(r.aprMax)} APR`;

// Keep the first letter's case when swapping a phrase, so "Guaranteed approval" -> "Fast decisions".
function matchCase(original: string, replacement: string) {
  return original[0] === original[0]?.toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
}

function* matches(text: string, pattern: RegExp) {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  for (let m = re.exec(text); m; m = re.exec(text)) {
    yield { index: m.index, text: m[0], groups: m };
    if (m[0].length === 0) re.lastIndex++;
  }
}

// Each copy field the rules should read (URLs, platform and consent source are skipped).
function copyFields(ctx: Ctx) {
  return CHANNEL_FIELDS[ctx.channel]
    .filter((field) => field.kind === "text" || field.kind === "textarea")
    .filter((field) => field.key !== "consentSource")
    .map((field) => ({ key: field.key, text: ctx.fields[field.key] ?? "" }));
}

// Phrase rules: find each phrase and offer a mapped rewrite.
function phraseRule(pattern: RegExp, rewrite: (match: string, ctx: Ctx, text: string, index: number) => string | null | undefined): Detector {
  return (ctx) =>
    copyFields(ctx).flatMap(({ key, text }) =>
      [...matches(text, pattern)].flatMap(({ index, text: found }) => {
        const replacement = rewrite(found, ctx, text, index);
        if (replacement === null) return []; // the rewrite function can veto false positives
        return [{ field: key, start: index, end: index + found.length, matchText: found, replacement: replacement && matchCase(found, replacement) }];
      }),
    );
}

// Phrase rules are lists of [pattern, rewrite]. Adding a new wording is one line here plus a
// test ad in test-ads.ts. A null rewrite flags the phrase without suggesting a fix; a function
// can pick wording from context.
type Rewrite = string | null | ((context: { atSentenceStart: boolean }) => string);
type PhraseList = [RegExp, Rewrite][];

function phraseList(list: PhraseList, veto?: (found: string, text: string, index: number) => boolean): Detector {
  const pattern = new RegExp(list.map(([re]) => `(?:${re.source})`).join("|"), "i");
  return phraseRule(pattern, (found, _ctx, text, index) => {
    if (veto?.(found, text, index)) return null;
    const rewrite = list.find(([re]) => new RegExp(`^(?:${re.source})$`, "i").test(found))?.[1];
    if (typeof rewrite === "function") return rewrite({ atSentenceStart: /(?:^|[.!?]\s+)$/.test(text.slice(0, index)) });
    return rewrite ?? undefined;
  });
}

const APPROVAL_PHRASES: PhraseList = [
  [/\bapproves (?:everyone|anyone|all applicants)\b/, "reviews every application"],
  [/\b(?:get )?approved no matter(?: what)?\b/, "get a decision no matter what"],
  [/\byou(?:'|’)?re (?:basically |already |pretty much )?approved(?: already)?\b/, "you could qualify"],
  [/\b(?:never|won(?:'|’)t) (?:says? no|turns? (?:anyone|you) down|decline you|deny you)\b/, "makes fast decisions"],
  [/\beveryone (?:gets|is) approved\b|\beveryone(?:'|’)s approved\b/, "fast decisions for every application"],
  [/100% approval(?: rate)?\b/, "fast decisions"],
  [/\bguaranteed approval\b|\bapproval guaranteed\b|\bguaranteed to be approved\b|\binstant approval\b/, "fast decisions"],
];

const NO_CREDIT_CHECK_PHRASES: PhraseList = [
  [/\b(?:we )?(?:never|don(?:'|’)t|do not) check (?:your )?credit\b/, "we use a soft credit check to show your rate"],
  [/\bwithout a credit check\b/, "with a soft credit check to see your rate"],
  [
    /\bno credit (?:checks?|pulls?|inquiry)(?: required| needed)?\b|\bno credit needed\b/,
    ({ atSentenceStart }) => (atSentenceStart ? "checking your rate won't affect your credit score" : "a soft credit check to see your rate"),
  ],
];

const LENDER_PHRASES: PhraseList = [
  [/\bwe(?:'|’)?re (?:the|a|your) (?:direct )?lender\b|\bwe are (?:the|a|your) (?:direct )?lender\b/, "ClearPath Financial is the lender"],
  [/\bwe(?:'|’)ll lend\b/, "ClearPath Financial can lend"],
  [/\bwe lend\b/, "ClearPath Financial lends"],
  [/\bis the lender\b/, "partners with ClearPath Financial, a lender"],
  // A partner naming itself as the one lending, e.g. "BrightPath lends up to $40,000".
  [/\b[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)? lends\b/, "ClearPath Financial lends"],
  [/\b(?:best|lowest) (?:rates?|APRs?)\b[^.!?\n]{0,30}?\bguaranteed\b|\bguaranteed (?:best|lowest) (?:rates?|APRs?)\b/, "competitive rates"],
  [/\bour (?:loans?|rates?)\b/, null],
];

const CREDIT_IMPACT = /\b(?:no|zero|without any|without) (?:impact|effect) (?:on|to) your credit(?: score)?\b|\bwon(?:'|’)t (?:affect|hurt|impact|ding) your credit(?: score)?\b/i;
// "as low as 8.99% APR", "starting at 8.99% APR", "from 8.99% APR" (but not "from 8.99% to 35.99%").
const TEASER_RATE = /\b(?:as low as|starting at|starts at|from|low)\s+(\d{1,2}(?:\.\d{1,2})?)%(?!\s?(?:-|–|to)\s?\d)\s?APR\b/i;
const FEE_CLAIM = /\bno (?:hidden |upfront |origination |surprise )?fees?\b|\bfee-free\b|\bzero fees\b|\bwithout (?:any )?fees\b/;
const FUNDING_SPEED = /\b(?:as soon as (?:today|tomorrow|the next (?:business )?day)|same[- ]day|next[- ]day|overnight|within 24 hours|in 24 hours|by tomorrow)\b(?: funding)?/i;
const TERMS_OFF_AD = /\b(?:terms|rates|details|disclosures?)(?: are)? (?:in|at) (?:(?:our|the) )?(?:bio|link|site|website)\b|\bsee (?:the )?(?:link|bio|site|website) for (?:terms|details|rates|disclosures)\b|\blink in bio\b/;
// "Best rates guaranteed" is left to the affiliate rule so one phrase isn't flagged twice.
const RANKING = /#1\b|\bnumber one\b|\bbest (?:personal loans?|lenders?|cards?|credit cards?|mortgages?|rates?)\b(?![^.!?]{0,30}\bguaranteed\b)|\btop[- ]rated\b|\bAmerica(?:'|’)s (?:favorite|best|top)\b/;

function sentenceAround(text: string, index: number) {
  const before = text.slice(0, index);
  let start = Math.max(before.search(/[^.!?]*$/), 0);
  while (/\s/.test(text[start] ?? "") && start < index) start++;
  const after = text.slice(index).search(/[.!?](?:\s|$)/);
  const end = after < 0 ? text.length : index + after + 1;
  return { start, end, text: text.slice(start, end) };
}

function formatAsOf(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Matches "$199/month", "$199 per month", "$1,200 monthly".
const PAYMENT = /\$\s?\d[\d,]*(?:\.\d{2})?\s?(?:\/\s?mo(?:nth)?\b|per month\b|a month\b|monthly\b)/i;
// Matches "60 months", "30-year", "24-60 month".
const TERM = /\b\d{1,3}(?:\s?[-–]\s?\d{1,3})?[- ]?(?:months?|mos?|years?|yrs?)\b/i;
const APR_MENTION = /\bAPR\b|annual percentage rate/i;
// "4.99% APR", "8.99% to 35.99% APR", "19.99%–29.99% variable APR". Intro rates have "intro" in between, so they don't match.
const RATE = /(\d{1,2}(?:\.\d{1,2})?)%(?:\s?(?:-|–|to)\s?(\d{1,2}(?:\.\d{1,2})?)%)?\s?(?:variable\s|fixed\s)?(?:APR\b|annual percentage rate)/gi;
const INTRO = /\b\d{1,2}(?:\.\d{1,2})?%\s?intro(?:ductory)?(?:\s(?:APR|rate))?/i;
const ONGOING_APR = /(?<!0)\b(?:[1-9]\d?(?:\.\d{1,2})?)%(?:\s?(?:-|–|to)\s?\d{1,2}(?:\.\d{1,2})?%)?\s?(?:variable\s|fixed\s)?APR/i;

const DETECTORS: Record<RuleId, Detector> = {
  "guaranteed-approval": phraseList(APPROVAL_PHRASES),

  "credit-impact": (ctx) => [
    ...phraseList(NO_CREDIT_CHECK_PHRASES)(ctx),
    // "No impact to your credit" is fine about checking a rate, not about applying.
    ...copyFields(ctx).flatMap(({ key, text }) =>
      [...matches(text, CREDIT_IMPACT)].flatMap(({ index, text: found }) => {
        const sentence = sentenceAround(text, index);
        if (!/\bappl(?:y|ying|ication)\b/i.test(sentence.text)) return [];
        return [
          {
            field: key,
            start: index,
            end: index + found.length,
            matchText: found,
            replacement: "Checking your rate won't affect your credit score. If you apply, we'll do a hard credit inquiry.",
            replaceStart: sentence.start,
            replaceEnd: sentence.end,
          },
        ];
      }),
    ),
  ],

  "lowest-rate-conditions": (ctx) => {
    const r = ctx.rates;
    if (!r.autopayDiscount || /\bauto-?pay\b|automatic payments?/i.test(ctx.allText)) return [];
    return copyFields(ctx).flatMap(({ key, text }) =>
      [...matches(text, TEASER_RATE)].flatMap(({ index, text: found, groups }) => {
        // Only the real lowest rate; a rate below the sheet is the rate rule's problem.
        if (Math.abs(Number(groups[1]) - r.aprMin) > 0.001) return [];
        return [{ field: key, start: index, end: index + found.length, matchText: found, replacement: `${found} with autopay` }];
      }),
    );
  },

  "fee-claim": (ctx) => {
    const r = ctx.rates;
    const detail =
      ctx.product === "personal_loan" && r.originationFeeMax
        ? `ClearPath charges an origination fee of ${r.originationFeeMin ?? 0}%–${r.originationFeeMax}% on personal loans.`
        : "Mortgages carry closing costs and other fees.";
    return phraseList([[FEE_CLAIM, ctx.product === "personal_loan" ? "no prepayment penalty" : null]])(ctx).map((finding) => ({ ...finding, detail }));
  },

  "funding-speed": (ctx) =>
    copyFields(ctx).flatMap(({ key, text }) =>
      [...matches(text, FUNDING_SPEED)].flatMap(({ index, text: found }) => {
        if (/\b(?:if|after|once|upon) approv/i.test(sentenceAround(text, index).text)) return [];
        return [{ field: key, start: index, end: index + found.length, matchText: found, replacement: "as soon as the next business day after approval" }];
      }),
    ),

  "savings-claim": phraseList([
    [
      /\bsave (?:up to |over |more than )?\$[\d,]+(?:\s(?:on|in) interest)?/,
      // Without the example behind it, the safe fix drops the number.
      ({ atSentenceStart }) => (atSentenceStart ? "consolidating could lower what you pay in interest" : "could lower what you pay in interest"),
    ],
  ]),

  "terms-off-ad": phraseList([[TERMS_OFF_AD, null]]),

  "mortgage-rate-basis": (ctx) => {
    if (/\bas of\b|\brates? (?:effective|accurate)\b/i.test(ctx.allText)) return [];
    const r = ctx.rates;
    const asOf = r.ratesAsOf ? formatAsOf(r.ratesAsOf) : "today";
    const basis = `rate as of ${asOf}${r.rateAssumptions ? `; assumes ${r.rateAssumptions}` : ""}`;
    return copyFields(ctx).flatMap(({ key, text }) =>
      [...matches(text, RATE)].map(({ index, text: found }) => {
        // The basis goes at the end of the sentence so it doesn't split the offer.
        const replaceEnd = index + found.length + text.slice(index + found.length).search(/[.!?](?:\s|$)|$/);
        return {
          field: key,
          start: index,
          end: index + found.length,
          matchText: found,
          replacement: `${text.slice(index, replaceEnd)} (${basis})`,
          replaceEnd,
        };
      }),
    );
  },

  "ranking-claim": phraseList([[RANKING, null]]),

  "affiliate-disclosure": (ctx) => {
    if (/compensat|paid (?:for|by)|advertis(?:er|ing) disclosure|\bsponsored\b|\bpaid partner|may (?:be paid|earn)/i.test(ctx.allText)) return [];
    const text = ctx.fields[ctx.mainField] ?? "";
    return [
      {
        field: ctx.mainField,
        start: text.length,
        end: text.length,
        matchText: "",
        replacement: `${spacer(text)}We may be compensated when you apply through our links.`,
      },
    ];
  },

  "closed-end-trigger-terms": (ctx) => {
    if (APR_MENTION.test(ctx.allText)) return [];
    return copyFields(ctx).flatMap(({ key, text }) => {
      const hits = [...matches(text, PAYMENT), ...matches(text, TERM)].sort((a, b) => a.index - b.index);
      // Merge triggers close together ("$208/month for 60 months") into one highlight.
      const spans: { start: number; end: number; hasTerm: boolean }[] = [];
      for (const hit of hits) {
        const last = spans.at(-1);
        const isTerm = TERM.test(hit.text);
        if (last && hit.index - last.end <= 12) {
          last.end = Math.max(last.end, hit.index + hit.text.length);
          last.hasTerm ||= isTerm;
        } else spans.push({ start: hit.index, end: hit.index + hit.text.length, hasTerm: isTerm });
      }
      const r = ctx.rates;
      const terms = r.termMinMonths && r.termMaxMonths ? `, ${r.termMinMonths}–${r.termMaxMonths} month terms` : "";
      return spans.map((span) => {
        // Add the disclosure at the end of the sentence so it doesn't split a phrase like "30-year fixed".
        const stop = text.slice(span.end).search(/[.!?](?:\s|$)|$/);
        const replaceEnd = span.end + stop;
        return {
          field: key,
          start: span.start,
          end: span.end,
          matchText: text.slice(span.start, span.end),
          replacement: `${text.slice(span.start, replaceEnd)} (${range(r)}${span.hasTerm ? "" : terms})`,
          replaceEnd,
        };
      });
    });
  },

  "open-end-trigger-terms": (ctx) => {
    if (ONGOING_APR.test(ctx.allText)) return [];
    const r = ctx.rates;
    return phraseRule(INTRO, () => {
      const months = r.introAprMonths ? ` on purchases for ${r.introAprMonths} months` : "";
      return `0% intro APR${months}, then ${pct(r.aprMin)}–${pct(r.aprMax)} variable APR`;
    })(ctx);
  },

  "rate-not-offered": (ctx) => {
    const r = ctx.rates;
    return copyFields(ctx).flatMap(({ key, text }) =>
      [...matches(text, RATE)].flatMap(({ index, text: found, groups }) => {
        const low = Number(groups[1]);
        const high = groups[2] ? Number(groups[2]) : low;
        if (low >= r.aprMin && high <= r.aprMax) return [];
        const offending = low < r.aprMin ? low : high;
        const detail =
          offending < r.aprMin
            ? `${pct(offending)} is below the lowest APR ClearPath offers on this product (${pct(r.aprMin)}).`
            : `${pct(offending)} is above the highest APR on ClearPath's rate sheet (${pct(r.aprMax)}).`;
        // Swap only the numbers that are off, keeping the ad's own wording ("from X% to Y% APR").
        const fixedLow = Math.min(Math.max(low, r.aprMin), r.aprMax).toFixed(2);
        const fixedHigh = Math.min(Math.max(high, r.aprMin), r.aprMax).toFixed(2);
        let replacement = found;
        if (groups[2]) {
          const highAt = replacement.lastIndexOf(`${groups[2]}%`);
          replacement = replacement.slice(0, highAt) + `${fixedHigh}%` + replacement.slice(highAt + groups[2].length + 1);
        }
        replacement = replacement.replace(`${groups[1]}%`, `${fixedLow}%`);
        return [{ field: key, start: index, end: index + found.length, matchText: found, detail, replacement }];
      }),
    );
  },

  "preapproved-claim": (ctx) => {
    // A prescreened firm offer with the opt-out notice may say preapproved.
    if (/prescreen(?:ed)?[^.]{0,80}opt[- ]?out/i.test(ctx.allText)) return [];
    return phraseRule(/\b(?:(?:you(?:'|’)re|you are)\s)?pre-?approved\b/i, (found) =>
      /^you/i.test(found) ? "see if you prequalify" : "prequalified",
    )(ctx);
  },

  "missing-nmls": (ctx) => {
    if (/NMLS\s?(?:ID)?\s?#?\s?\d{4,}/i.test(ctx.allText)) return [];
    const text = ctx.fields[ctx.mainField] ?? "";
    const id = ctx.rates.nmlsId ?? "2045817";
    return [{ field: ctx.mainField, start: text.length, end: text.length, matchText: "", replacement: `${spacer(text)}ClearPath Financial, NMLS ID #${id}.` }];
  },

  "affiliate-implies-lender": phraseList(LENDER_PHRASES, (found, text, index) => {
    // ClearPath naming itself as the lender is the compliant version, not a violation.
    if (/^clearpath/i.test(found)) return true;
    return /^is the lender/i.test(found) && /clearpath(?: financial)?\s*$/i.test(text.slice(Math.max(0, index - 25), index));
  }),

  "sms-opt-out": (ctx) => {
    const text = ctx.fields.message ?? "";
    if (!text.trim() || /\b(?:reply|text)\s+stop\b|\bstop to (?:opt out|unsubscribe|end|cancel)\b/i.test(text)) return [];
    return [{ field: "message", start: text.length, end: text.length, matchText: "", replacement: `${spacer(text)}Reply STOP to opt out.` }];
  },

  "email-unsubscribe": (ctx) => {
    const text = ctx.fields.footer ?? "";
    const hasUnsubscribe = /unsubscribe|opt[- ]out/i.test(text);
    const hasAddress = /\b\d{1,6}\s+\w+(?:\s\w+)*\s(?:st(?:reet)?|ave(?:nue)?|way|rd|road|blvd|suite|drive|dr)\b|\b[A-Z]{2}\s\d{5}\b/i.test(text);
    if (hasUnsubscribe && hasAddress) return [];
    const missing = [!hasUnsubscribe && "Unsubscribe: clearpath.example.com/unsubscribe", !hasAddress && "ClearPath Financial, 100 Example Way, Suite 400, Columbus, OH 43215"]
      .filter(Boolean)
      .join(" · ");
    const detail = !hasUnsubscribe && !hasAddress ? "Missing both an unsubscribe link and a mailing address." : !hasUnsubscribe ? "Missing an unsubscribe link." : "Missing a mailing address.";
    const separator = text.trim() ? (/\s$/.test(text) ? "· " : " · ") : "";
    return [{ field: "footer", start: text.length, end: text.length, matchText: "", detail, replacement: `${separator}${missing}` }];
  },
};

function spacer(text: string) {
  if (!text) return "";
  return /\s$/.test(text) ? "" : " ";
}

function applies(rule: RuleMeta, input: AdInput) {
  return (rule.products === "all" || rule.products.includes(input.product)) && (rule.channels === "all" || rule.channels.includes(input.channel));
}

const MAIN_FIELD: Record<Channel, string> = {
  email: "body",
  sms: "message",
  social: "postCopy",
  affiliate: "copy",
  landing_page: "copy",
  paid_search: "copy",
};

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

// Team rules: flag any listed phrase (whole words, any case), or flag when required text is missing.
function teamRuleFindings(rule: TeamRule, ctx: Ctx): Omit<Finding, "ruleId" | "severity">[] {
  const { kind, phrases, requiredText, replacement } = rule.team;
  if (kind === "required") {
    if (!requiredText || ctx.allText.toLowerCase().includes(requiredText.toLowerCase())) return [];
    const text = ctx.fields[ctx.mainField] ?? "";
    return [{ field: ctx.mainField, start: text.length, end: text.length, matchText: "", replacement: `${spacer(text)}${requiredText}` }];
  }
  const usable = phrases.map((phrase) => phrase.trim()).filter(Boolean);
  if (usable.length === 0) return [];
  const escaped = usable.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
  const pattern = new RegExp(`(?<![\\w])(?:${escaped.join("|")})(?![\\w])`, "i");
  return phraseRule(pattern, () => replacement ?? undefined)(ctx);
}

export function precheck(input: AdInput, rateSheet: RateSheet, teamRules: TeamRule[] = []): Finding[] {
  const fieldOrder = CHANNEL_FIELDS[input.channel].map((field) => field.key);
  const ctx: Ctx = {
    ...input,
    rates: rateSheet[input.product],
    allText: fieldOrder.map((key) => input.fields[key] ?? "").join("\n"),
    mainField: MAIN_FIELD[input.channel],
  };
  // Nothing to check until there's copy.
  if (!ctx.allText.trim()) return [];

  const findings: Finding[] = [
    ...RULES.filter((rule) => applies(rule, input)).flatMap((rule) =>
      DETECTORS[rule.id](ctx).map((finding) => ({ ...finding, ruleId: rule.id, severity: getRule(rule.id).severity })),
    ),
    ...teamRules
      .filter((rule) => rule.team.active && applies(rule, input))
      .flatMap((rule) => teamRuleFindings(rule, ctx).map((finding) => ({ ...finding, ruleId: rule.id, severity: rule.severity }))),
  ];

  // Highest severity first, then in reading order.
  return findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      fieldOrder.indexOf(a.field) - fieldOrder.indexOf(b.field) ||
      a.start - b.start,
  );
}

// Applies a finding's rewrite to the fields and returns the new fields.
export function applyFix(fields: Record<string, string>, finding: Finding): Record<string, string> {
  if (finding.replacement === undefined) return fields;
  const text = fields[finding.field] ?? "";
  const from = finding.replaceStart ?? finding.start;
  return { ...fields, [finding.field]: text.slice(0, from) + finding.replacement + text.slice(finding.replaceEnd ?? finding.end) };
}

// Runs one team rule against sample text, for the "Test it" box when compliance writes a rule.
export function testTeamRule(rule: TeamRule, sample: string): Finding[] {
  const ctx: Ctx = {
    product: "personal_loan",
    channel: "landing_page",
    fields: { copy: sample },
    rates: { aprMin: 0, aprMax: 0, termMinMonths: null, termMaxMonths: null, introAprMonths: null, nmlsId: null, autopayDiscount: null, originationFeeMin: null, originationFeeMax: null, ratesAsOf: null, rateAssumptions: null },
    allText: sample,
    mainField: "copy",
  };
  if (!sample.trim()) return [];
  return teamRuleFindings(rule, ctx).map((finding) => ({ ...finding, ruleId: rule.id, severity: rule.severity }));
}
