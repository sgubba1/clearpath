import { switchIdentity } from "@/app/actions";
import { IDENTITIES } from "@/lib/identities";
import { getIdentity } from "@/lib/session";

// Entry point for evaluators: pick who you are. No login, by design.
export default async function Home({ searchParams }: PageProps<"/">) {
  const current = await getIdentity();
  const { reset } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      {reset && (
        <p role="status" className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Demo data reset. Everything is back to its starting state.
        </p>
      )}
      <h1 className="text-3xl font-semibold tracking-tight">Who are you today?</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        ClearPath Compliance Review checks marketing ads before they reach a reviewer, sorts the review queue by risk,
        and keeps a full record of every decision. Pick a role to see its view; you can switch any time from the top
        right.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
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
                {current?.id === identity.id && (
                  <span className="mt-3 text-xs font-medium text-muted-foreground">Current role</span>
                )}
              </button>
            </form>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-muted-foreground">
        ClearPath Financial is a fictional company. All people, partners and data are made up, and the rule library is
        illustrative, not legal advice.
      </p>
    </main>
  );
}
