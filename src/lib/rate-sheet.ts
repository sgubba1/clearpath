import { getDb } from "@/db";
import { rateSheet } from "@/db/schema";
import type { RateSheet } from "@/lib/rules/engine";

type RateRow = Pick<typeof rateSheet.$inferInsert, "product" | "aprMin" | "aprMax" | "termMinMonths" | "termMaxMonths" | "introAprMonths" | "nmlsId">;

export function toRateSheet(rows: RateRow[]): RateSheet {
  return Object.fromEntries(
    rows.map((row) => [
      row.product,
      {
        aprMin: row.aprMin,
        aprMax: row.aprMax,
        termMinMonths: row.termMinMonths ?? null,
        termMaxMonths: row.termMaxMonths ?? null,
        introAprMonths: row.introAprMonths ?? null,
        nmlsId: row.nmlsId ?? null,
      },
    ]),
  ) as RateSheet;
}

// The live rate sheet the pre-check compares against.
export async function getRateSheet(): Promise<RateSheet> {
  return toRateSheet(await getDb().select().from(rateSheet));
}
