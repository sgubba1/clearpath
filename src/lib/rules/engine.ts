import type { Channel, Product, Severity } from "@/db/schema";
import { CHANNEL_FIELDS } from "@/lib/labels";
import { getRule, RULES, type RuleId, type RuleMeta } from "./catalog";

// The pre-check. Pure and synchronous so the same code runs live in the browser as
// people type and again on the server when they submit.

export type RateTerms = {
  aprMin: number;
  aprMax: number;
  termMinMonths: number | null;
  termMaxMonths: number | null;
  introAprMonths: number | null;
  nmlsId: string | null;
};
export type RateSheet = Record<Product, RateTerms>;

export type Finding = {
  ruleId: RuleId;
  severity: Severity;
  field: string;
  // Character range in the field. Equal start and end means something is missing.
  start: number;
  end: number;
  matchText: string;
  // Specific explanation for this instance, e.g. which rate is off and by how much.
  detail?: string;
  // A compliant replacement for [start, replaceEnd ?? end). For missing items this is text to append.
  replacement?: string;
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

const APPROVAL_REWRITES: [RegExp, string][] = [
  [/approves everyone/i, "reviews every application"],
  [/.*/, "fast decisions"],
];

const LENDER_REWRITES: [RegExp, string | null][] = [
  [/^we('|’)?re the lender|^we are the lender/i, "ClearPath Financial is the lender"],
  [/^we('|’)ll lend/i, "ClearPath Financial can lend"],
  [/^we lend/i, "ClearPath Financial lends"],
  [/^is the lender/i, "partners with ClearPath Financial, a lender"],
  [/rates? guaranteed|guaranteed (best|lowest)/i, "competitive rates"],
];

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
  "guaranteed-approval": phraseRule(
    /\b(?:guaranteed approval|approval guaranteed|guaranteed to be approved|instant approval|100% approval|approves everyone|everyone is approved)\b/i,
    (found) => APPROVAL_REWRITES.find(([re]) => re.test(found))![1],
  ),

  "no-credit-check": phraseRule(/\b(?:no credit check(?:s)?(?: required| needed)?|without a credit check|no credit needed)\b/i, (found) =>
    /^without/i.test(found) ? "with a soft credit check to see your rate" : "a soft credit check to see your rate",
  ),

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

  "affiliate-implies-lender": phraseRule(
    /\b(?:we(?:'|’)?re the lender|we are the lender|we(?:'|’)ll lend|we lend|is the lender|best rates? guaranteed|lowest rates? guaranteed|guaranteed (?:best|lowest) rates?)\b/i,
    (found, _ctx, text, index) => {
      // "ClearPath Financial is the lender" is the compliant version, not a violation.
      if (/^is the lender/i.test(found) && /clearpath(?: financial)?\s*$/i.test(text.slice(Math.max(0, index - 25), index))) return null;
      return LENDER_REWRITES.find(([re]) => re.test(found))?.[1];
    },
  ),

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

export function precheck(input: AdInput, rateSheet: RateSheet): Finding[] {
  const fieldOrder = CHANNEL_FIELDS[input.channel].map((field) => field.key);
  const ctx: Ctx = {
    ...input,
    rates: rateSheet[input.product],
    allText: fieldOrder.map((key) => input.fields[key] ?? "").join("\n"),
    mainField: MAIN_FIELD[input.channel],
  };
  // Nothing to check until there's copy.
  if (!ctx.allText.trim()) return [];

  const findings = RULES.filter((rule) => applies(rule, input)).flatMap((rule) =>
    DETECTORS[rule.id](ctx).map((finding) => ({ ...finding, ruleId: rule.id, severity: getRule(rule.id).severity })),
  );

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
  return { ...fields, [finding.field]: text.slice(0, finding.start) + finding.replacement + text.slice(finding.replaceEnd ?? finding.end) };
}
