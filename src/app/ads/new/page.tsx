import { AdForm } from "@/components/ad-form";
import { PageHeader } from "@/components/page-header";
import { EXAMPLE_ADS } from "@/lib/example-ads";
import { aiReviewEnabled } from "@/lib/ai-review";
import { getRateSheet } from "@/lib/rate-sheet";
import { CHANNELS_FOR } from "@/lib/labels";
import { requireRole } from "@/lib/session";

function isoDate(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}

export default async function NewAdPage() {
  const identity = await requireRole(["marketer", "affiliate"]);
  const isAffiliate = identity.role === "affiliate";
  const channels = CHANNELS_FOR[isAffiliate ? "affiliate" : "in_house"];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={isAffiliate ? "Submit a placement" : "New ad"}
        description="Fill in the details and paste your copy exactly as people will see it."
      />
      <AdForm
        rateSheet={await getRateSheet()}
        aiEnabled={aiReviewEnabled()}
        examples={EXAMPLE_ADS.filter((example) => example.for === (isAffiliate ? "affiliate" : "in_house"))}
        channels={channels}
        submitterLabel={isAffiliate ? `${identity.name}, ${identity.organization}` : identity.name}
        minLaunchDate={isoDate(0)}
        initial={{
          product: "",
          // Partners only submit placements, so there's nothing to choose.
          channel: channels.length === 1 ? channels[0] : "",
          campaign: "",
          // Default to a week out: enough time for review without asking.
          launchDate: isoDate(7),
          fields: {},
        }}
      />
    </main>
  );
}
