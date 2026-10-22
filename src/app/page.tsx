import { goToTourStep, switchIdentity } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { findIdentity, IDENTITIES } from "@/lib/identities";
import { getIdentity } from "@/lib/session";
import { TOUR } from "@/lib/tour";

// Entry point for evaluators: a guided tour of one ad's journey, or pick anyone and explore.
// No login, by design.
export default async function Home({ searchParams }: PageProps<"/">) {
  const current = await getIdentity();
  const { reset, tour } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      {reset && (
        <p role="status" className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Demo data reset. Everything is back to its starting state.
        </p>
      )}
      {tour === "done" && (
        <p role="status" className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          That&apos;s the whole loop. Explore as anyone below, or reset the demo data from the role menu to start fresh.
        </p>
      )}

      <h1 className="text-3xl font-semibold tracking-tight">Compliance review that moves at the speed of marketing</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        ClearPath&apos;s compliance team reviews every ad before it runs. This tool catches the predictable problems while
        the ad is being written, sends reviewers the riskiest work first, and turns resubmissions into a quick check of
        what changed.
      </p>

      <section aria-labelledby="tour-title" className="mt-8 rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="tour-title" className="text-lg font-semibold">
              Take the 3-minute tour
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Follow one ad from first draft to approval. A bar at the top tells you what to do at each step.</p>
          </div>
          <form action={goToTourStep.bind(null, 0)}>
            <Button type="submit">Start the tour</Button>
          </form>
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-5">
          {TOUR.map((step, index) => (
            <li key={step.title} className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                {index + 1} · {findIdentity(step.identity)?.name.split(" ")[0]}
              </span>
              <p className="mt-1 font-medium leading-snug">{step.title}</p>
            </li>
          ))}
        </ol>
      </section>

      <h2 className="mt-10 font-semibold">Or explore as anyone</h2>
      <p className="mt-1 text-sm text-muted-foreground">Switch people any time from the menu at the top right.</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {IDENTITIES.map((identity) => (
          <li key={identity.id}>
            <form action={switchIdentity.bind(null, identity.id)} className="h-full">
              <button
                type="submit"
                className="flex h-full w-full flex-col items-start rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/60 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="text-sm font-medium text-primary">{identity.roleLabel}</span>
                <span className="mt-1 text-lg font-semibold">{identity.name}</span>
                <span className="text-sm text-muted-foreground">{identity.organization}</span>
                <span className="mt-3 text-sm">{identity.summary}</span>
                {current?.id === identity.id && <span className="mt-3 text-xs font-medium text-muted-foreground">Current role</span>}
              </button>
            </form>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-muted-foreground">
        ClearPath Financial is not a real company. All people, partners and data are made up, and the rule library is illustrative, not legal advice.
      </p>
    </main>
  );
}
