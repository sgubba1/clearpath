import type { partners, rateSheet } from "@/db/schema";

// Fictional reference data. The seed loads these into the database.

export const RATE_SHEET: (typeof rateSheet.$inferInsert)[] = [
  {
    product: "personal_loan",
    aprMin: 8.99,
    aprMax: 35.99,
    termMinMonths: 24,
    termMaxMonths: 60,
    notes: "Fixed rate. APR depends on credit, income and loan amount.",
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
    notes: "Rates may be shown only with the APR and NMLS ID. Prequalification is not a commitment to lend.",
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
