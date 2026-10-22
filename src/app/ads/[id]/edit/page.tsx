import { notFound, redirect } from "next/navigation";
import { AdForm, type RevisionFeedback } from "@/components/ad-form";
import { PageHeader } from "@/components/page-header";
import { CHANNELS_FOR, submissionRef } from "@/lib/labels";
import { getOwnedAd } from "@/lib/queries";
import { getRateSheet } from "@/lib/rate-sheet";
import { getRule } from "@/lib/rules/catalog";
import { requireRole } from "@/lib/session";

// Drafts are edited in place; ads compliance sent back are revised into a new round.
export default async function EditAdPage({ params }: PageProps<"/ads/[id]/edit">) {
  const identity = await requireRole(["marketer", "affiliate"]);
  const ad = await getOwnedAd(identity, Number((await params).id));
  if (!ad) notFound();
  if (ad.status !== "draft" && ad.status !== "changes_requested") redirect(`/ads/${ad.id}`);

  const isAffiliate = identity.role === "affiliate";
  const isRevision = ad.status === "changes_requested";
  const version = ad.versions[ad.versions.length - 1];
  const round = version.number + 1;
  const feedback: RevisionFeedback[] = version.comments.map((comment) => ({
    id: comment.id,
    author: comment.authorName,
    body: comment.body,
    about: comment.flag ? getRule(comment.flag.ruleId).title : undefined,
    quote: comment.flag?.matchText || undefined,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={isRevision ? `Revise ${ad.campaign}` : "Edit draft"}
        description={
          isRevision
            ? `${submissionRef(ad.id)} · Make the changes below and resubmit. The reviewer sees exactly what changed.`
            : `${submissionRef(ad.id)} · Not sent to compliance yet.`
        }
      />
      <AdForm
        rateSheet={await getRateSheet()}
        draftId={ad.id}
        channels={CHANNELS_FOR[isAffiliate ? "affiliate" : "in_house"]}
        submitterLabel={isAffiliate ? `${identity.name}, ${identity.organization}` : identity.name}
        minLaunchDate={new Date().toLocaleDateString("en-CA")}
        revision={isRevision ? { round, feedback, cancelHref: `/ads/${ad.id}` } : undefined}
        initial={{
          product: ad.product,
          channel: ad.channel,
          campaign: ad.campaign,
          launchDate: ad.launchDate,
          fields: version.fields,
        }}
      />
    </main>
  );
}
