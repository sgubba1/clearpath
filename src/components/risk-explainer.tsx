"use client";

import { InfoIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { riskLevel, SEVERITY_POINTS, type RiskPart } from "@/lib/risk";

// Why each factor raises the score, in the reviewer's terms.
const WHY: Record<RiskPart["kind"], string> = {
  flags: "",
  partner: "Partners are less supervised than ClearPath's own marketers, and ClearPath is accountable for what they publish.",
  mortgage: "Mortgage ads carry extra licensing and disclosure rules.",
  "launch-soon": "Less time to fix it before it runs.",
  live: "It's already running, so any problem is reaching people now.",
};

const FLAG_WHY = {
  high: "Problems regulators treat as deceptive, such as promising approval or leaving out the APR.",
  medium: "Missing conditions or disclosures that need fixing before launch.",
  low: "Minor wording issues.",
} as const;

const LEVEL_LABEL = { high: "High risk", medium: "Medium risk", low: "Low risk" } as const;

// A small window that explains the risk score: each factor, why it matters and its points,
// then how the total maps to a level.
export function RiskExplainer({ score, parts }: { score: number; parts: RiskPart[] }) {
  const level = riskLevel(score);

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <InfoIcon aria-hidden className="size-4" />
        Why {LEVEL_LABEL[level].toLowerCase()}?
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] space-y-3 text-sm">
        <div>
          <p className="font-semibold">Why this is {LEVEL_LABEL[level].toLowerCase()}</p>
          <p className="mt-1 text-muted-foreground">
            The queue puts the ads most likely to harm a customer, or get ClearPath in trouble, first. Points add up from:
          </p>
        </div>

        {parts.length === 0 ? (
          <p className="rounded-md bg-muted/60 p-2.5">No open flags and nothing else that raises the risk.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {parts.map((part) => (
              <li key={part.label} className="flex gap-3 p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{part.label}</p>
                  <p className="text-muted-foreground">
                    {part.kind === "flags" && part.severity
                      ? `${FLAG_WHY[part.severity]} ${SEVERITY_POINTS[part.severity]} points each.`
                      : WHY[part.kind]}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">+{part.points}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 bg-muted/40 p-2.5 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {score} · {LEVEL_LABEL[level]}
              </span>
            </li>
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Low is 0–2 points, medium 3–5, high 6 or more. The weights are a starting policy that compliance would tune; the AI second opinion
          never changes them.
        </p>
      </PopoverContent>
    </Popover>
  );
}
