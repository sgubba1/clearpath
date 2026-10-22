import type { partners, rateSheet } from "@/db/schema";

// Mortgage rates are quoted "as of" a recent date; two days before the seed runs.
export function ratesAsOfDate(now = new Date()) {
  const date = new Date(now.getTime() - 2 * 24 * 3_600_000);
  return date.toISOString().slice(0, 10);
}

// Fictional reference data. The seed loads these into the database.

export const RATE_SHEET: (typeof rateSheet.$inferInsert)[] = [
  {
    product: "personal_loan",
    aprMin: 8.99,
    aprMax: 35.99,
    termMinMonths: 24,
    termMaxMonths: 60,
    autopayDiscount: 0.5,
    originationFeeMin: 0,
    originationFeeMax: 8,
    notes: "Fixed rate. Lowest APR includes a 0.50% autopay discount. Origination fee 0%–8% of the loan amount. Funds as soon as the next business day after approval.",
  },
  {
    product: "credit_card",
    aprMin: 19.99,
    aprMax: 29.99,
    annualFee: 0,
    introAprMonths: 12,
    notes: "0% intro APR on purchases for 12 months, then the variable APR applies. No annual fee.",
  },
  {
    product: "mortgage_prequal",
    aprMin: 6.42,
    aprMax: 7.85,
    termMinMonths: 180,
    termMaxMonths: 360,
    nmlsId: "2045817",
    ratesAsOf: ratesAsOfDate(),
    rateAssumptions: "740 credit score, 20% down, 30-year fixed, no points",
    notes: "Rates may be shown only with the APR, the date, the assumptions and the NMLS ID. Prequalification is not a commitment to lend.",
  },
];

export const PARTNERS: (typeof partners.$inferInsert)[] = [
  {
    id: "brightpath",
    name: "BrightPath Rates",
    website: "https://brightpath-rates.example.com",
    contactName: "Jordan Reyes",
    contactEmail: "jordan@brightpath-rates.example.com",
  },
  {
    id: "fundfinder",
    name: "FundFinder Daily",
    website: "https://fundfinder-daily.example.com",
    contactName: "Chris Novak",
    contactEmail: "chris@fundfinder-daily.example.com",
  },
  {
    id: "cardcompass",
    name: "CardCompass Reviews",
    website: "https://cardcompass.example.com",
    contactName: "Ana Ruiz",
    contactEmail: "ana@cardcompass.example.com",
  },
];
