import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import type { Status } from "@/db/schema";
import { formatDate, launchLabel, timeAgo } from "@/lib/format";
import { CHANNEL_FIELDS, CHANNEL_LABELS, PRODUCT_LABELS, submissionRef } from "@/lib/labels";
import { getOwnedAd } from "@/lib/queries";
import { requireRole } from "@/lib/session";

// What the submitter should expect next, in plain language.
const NEXT_STEP: Record<Status, string> = {
  draft: "This draft hasn't been sent yet. Only you can see it.",
  submitted: "Compliance has it. Most ads get a decision within two days, and any feedback will show up here.",
  in_review: "A reviewer is looking at it now.",
  changes_requested: "Compliance asked for changes.",
  approved: "Approved. This version is cleared to run as submitted.",
  rejected: "Rejected. This ad can't run.",
};

export default async function AdPage({ params, searchParams }: PageProps<"/ads/[id]">) {
  const identity = await requireRole(["marketer", "affiliate"]);
  const ad = await getOwnedAd(identity, Number((await params).id));
  if (!ad) notFound();
  const query = await searchParams;

  const version = ad.versions[ad.versions.length - 1];
  const fields = CHANNEL_FIELDS[ad.channel].filter((field) => version.fields[field.key]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Link href="/ads" className="text-sm text-muted-foreground hover:text-foreground">
        ← My ads
      </Link>

      {query.sent && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Sent to compliance. You&apos;ll see the decision and any feedback on this page.
        </p>
      )}
      {query.saved && (
        <p role="status" className="rounded-lg border bg-card px-4 py-3 text-sm">
          Draft saved.
        </p>
      )}

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{ad.campaign}</h1>
          <StatusBadge status={ad.status} />
        </div>
        <p className="text-muted-foreground">{NEXT_STEP[ad.status]}</p>
        {ad.status === "draft" && (
          <Button asChild>
            <Link href={`/ads/${ad.id}/edit`}>Continue editing</Link>
          </Button>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 text-sm sm:grid-cols-4">
        <Meta label="Reference" value={submissionRef(ad.id)} />
        <Meta label="Product" value={PRODUCT_LABELS[ad.product]} />
        <Meta label="Channel" value={CHANNEL_LABELS[ad.channel]} />
        <Meta label="Launch" value={`${formatDate(ad.launchDate)} · ${launchLabel(ad.launchDate).replace("Launches ", "")}`} />
      </dl>

      <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{ad.versions.length > 1 ? `Round ${version.number} copy` : "Copy"}</h2>
          <span className="text-sm text-muted-foreground">
            {ad.status === "draft" ? "Saved" : "Sent"} {timeAgo(version.createdAt)}
          </span>
        </div>
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{field.label}</p>
            <p className="whitespace-pre-wrap break-words">{version.fields[field.key]}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
