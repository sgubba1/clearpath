import type { Metadata } from "next";
import Link from "next/link";
import { SEVERITY_BADGE, Tag } from "@/components/badges";
import { PageHeader } from "@/components/page-header";
import { TimeAgo } from "@/components/time-ago";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABELS, PRODUCT_LABELS } from "@/lib/labels";
import { isTeamRule, RULE_CATEGORIES, RULES, type RuleMeta } from "@/lib/rules/catalog";
import { requireRole } from "@/lib/session";
import { getTeamRules } from "@/lib/team-rules";
import { cn } from "@/lib/utils";
import { setTeamRuleActive } from "./actions";

export const metadata: Metadata = { title: "Ad rules" };

export default async function RulesPage({ searchParams }: PageProps<"/rules">) {
  const identity = await requireRole(["marketer", "affiliate", "reviewer", "manager"]);
  const canEdit = identity.role === "reviewer" || identity.role === "manager";
  const { added } = await searchParams;
  const teamRules = await getTeamRules();
  const all: RuleMeta[] = [...RULES, ...teamRules];
  const active = all.filter((rule) => !isTeamRule(rule) || rule.team.active);
  const turnedOff = teamRules.filter((rule) => !rule.team.active);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      {added && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Rule added. It now runs in every pre-check, for new ads and revisions.
        </p>
      )}
      <PageHeader
        title="Ad rules"
        description={`Every ad is checked against these ${active.length} rules as it's written. Each one explains why it exists and how to fix it. Illustrative, not legal advice.`}
        action={
          canEdit ? (
            <Button asChild>
              <Link href="/rules/new">Add a rule</Link>
            </Button>
          ) : undefined
        }
      />

      <nav aria-label="Rule categories" className="flex flex-wrap gap-2">
        {RULE_CATEGORIES.map((category) => {
          const count = active.filter((rule) => rule.category === category.id).length;
          if (count === 0) return null;
          return (
            <a key={category.id} href={`#${category.id}`} className="rounded-full border bg-card px-3 py-1 text-sm hover:border-primary/60 hover:bg-accent/40">
              {category.label} <span className="text-muted-foreground">({count})</span>
            </a>
          );
        })}
      </nav>

      {RULE_CATEGORIES.map((category) => {
        const rules = active.filter((rule) => rule.category === category.id);
        if (rules.length === 0) return null;
        return (
          <section key={category.id} id={category.id} aria-labelledby={`${category.id}-title`} className="scroll-mt-6 space-y-3">
            <div>
              <h2 id={`${category.id}-title`} className="font-semibold">
                {category.label}
              </h2>
              <p className="text-sm text-muted-foreground">{category.description}</p>
            </div>
            <ul className="space-y-3">
              {rules.map((rule) => (
                <RuleCard key={rule.id} rule={rule} canEdit={canEdit} />
              ))}
            </ul>
          </section>
        );
      })}

      {turnedOff.length > 0 && (
        <section aria-labelledby="off-title" className="space-y-3">
          <h2 id="off-title" className="font-semibold text-muted-foreground">
            Turned off ({turnedOff.length})
          </h2>
          <ul className="space-y-3 opacity-75">
            {turnedOff.map((rule) => (
              <RuleCard key={rule.id} rule={rule} canEdit={canEdit} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function RuleCard({ rule, canEdit }: { rule: RuleMeta; canEdit: boolean }) {
  const team = isTeamRule(rule) ? rule.team : undefined;
  const numericId = team ? Number(rule.id.replace("team-", "")) : 0;

  return (
    <li id={rule.id} className="scroll-mt-6 rounded-xl border bg-card p-5 target:ring-2 target:ring-primary">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-medium">{rule.title}</h3>
        <div className="flex items-center gap-2">
          {team && <Tag tone="partner">Team rule</Tag>}
          <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", SEVERITY_BADGE[rule.severity])}>
            {rule.severity === "high" ? "High" : rule.severity === "medium" ? "Medium" : "Low"}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm">{rule.whyItMatters}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">How to fix: </span>
        {rule.fixHint}
      </p>
      {team && (
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{team.kind === "required" ? "Requires: " : "Flags: "}</span>
          {team.kind === "required" ? `“${team.requiredText}”` : team.phrases.map((phrase) => `“${phrase}”`).join(", ")}
          {team.replacement && <> · suggests &ldquo;{team.replacement}&rdquo;</>}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {rule.products === "all" ? "All products" : rule.products.map((product) => PRODUCT_LABELS[product]).join(", ")}
            {" · "}
            {rule.channels === "all" ? "All channels" : rule.channels.map((channel) => CHANNEL_LABELS[channel]).join(", ")}
          </span>
          {rule.sourceUrl ? (
            <a href={rule.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">
              {rule.regulation}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            rule.regulation !== "Team rule" && <span>{rule.regulation}</span>
          )}
          {"exampleOnly" in rule && rule.exampleOnly && <span>Example check, not verified against the regulation</span>}
          {team && (
            <span>
              Added by {team.createdByName} <TimeAgo date={new Date(team.createdAt)} />
            </span>
          )}
        </p>
        {team && canEdit && (
          <form action={setTeamRuleActive.bind(null, numericId, !team.active)}>
            <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs">
              {team.active ? "Turn off" : "Turn back on"}
            </Button>
          </form>
        )}
      </div>
    </li>
  );
}
