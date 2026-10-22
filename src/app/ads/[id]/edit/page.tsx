import { notFound, redirect } from "next/navigation";
import { AdForm } from "@/components/ad-form";
import { PageHeader } from "@/components/page-header";
import { CHANNELS_FOR, submissionRef } from "@/lib/labels";
import { getOwnedAd } from "@/lib/queries";
import { requireRole } from "@/lib/session";

export default async function EditDraftPage({ params }: PageProps<"/ads/[id]/edit">) {
  const identity = await requireRole(["marketer", "affiliate"]);
  const ad = await getOwnedAd(identity, Number((await params).id));
  if (!ad) notFound();
  // Only drafts are editable here; submitted ads change through a new round.
  if (ad.status !== "draft") redirect(`/ads/${ad.id}`);

  const isAffiliate = identity.role === "affiliate";
  const version = ad.versions[0];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title="Edit draft" description={`${submissionRef(ad.id)} · Not sent to compliance yet.`} />
      <AdForm
        draftId={ad.id}
        channels={CHANNELS_FOR[isAffiliate ? "affiliate" : "in_house"]}
        submitterLabel={isAffiliate ? `${identity.name}, ${identity.organization}` : identity.name}
        minLaunchDate={new Date().toLocaleDateString("en-CA")}
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
