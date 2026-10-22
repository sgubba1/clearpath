import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SEVERITY_BADGE } from "@/components/precheck-panel";
import { CHANNEL_LABELS, PRODUCT_LABELS } from "@/lib/labels";
import { RULES, type RuleMeta } from "@/lib/rules/catalog";
import { requireRole } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ad rules" };

// Partner-only rules and the blatant claims partners tend to make are grouped apart from
// the omissions careful in-house copy still misses.
const PARTNER_RISK = new Set(["guaranteed-approval", "affiliate-implies-lender", "affiliate-disclosure"]);

export default async function RulesPage() {
  await requireRole(["marketer", "affiliate", "reviewer", "manager"]);
  const groups: { title: string; description: string; rules: RuleMeta[] }[] = [
    {
      title: "What careful copy still misses",
      description: "Missing conditions and claims that are only true sometimes. Most of what compliance sends back.",
      rules: RULES.filter((rule) => !PARTNER_RISK.has(rule.id)),
    },
    {
      title: "Higher-risk claims, mostly from partners",
      description: "Rare in ClearPath's own ads, more common in comparison sites and lead generators.",
      rules: RULES.filter((rule) => PARTNER_RISK.has(rule.id)),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Ad rules"
        description="Every ad is checked against these as it's written. Each rule explains why it exists and how to fix it. Illustrative, not legal advice."
      />
      {groups.map((group) => (
        <section key={group.title} aria-labelledby={group.title} className="space-y-3">
          <div>
            <h2 id={group.title} className="font-semibold">
              {group.title}
            </h2>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </div>
          <ul className="space-y-3">
            {group.rules.map((rule) => (
              <li key={rule.id} id={rule.id} className="scroll-mt-6 rounded-xl border bg-card p-5 target:ring-2 target:ring-primary">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-medium">{rule.title}</h3>
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", SEVERITY_BADGE[rule.severity])}>
                    {rule.severity === "high" ? "High" : rule.severity === "medium" ? "Medium" : "Low"}
                  </span>
                </div>
                <p className="mt-2 text-sm">{rule.whyItMatters}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">How to fix: </span>
                  {rule.fixHint}
                </p>
                <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {rule.products === "all" ? "All products" : rule.products.map((product) => PRODUCT_LABELS[product]).join(", ")}
                    {" · "}
                    {rule.channels === "all" ? "All channels" : rule.channels.map((channel) => CHANNEL_LABELS[channel]).join(", ")}
                  </span>
                  <a href={rule.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">
                    {rule.regulation}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  {"exampleOnly" in rule && rule.exampleOnly && <span>Example check, not verified against the regulation</span>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
