import { EmptyState, PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/session";

export default async function MyAdsPage() {
  const identity = await requireRole(["marketer", "affiliate"]);
  const isAffiliate = identity.role === "affiliate";

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="My ads"
        description={
          isAffiliate
            ? "Ads you've sent to ClearPath for approval, and where each one stands."
            : "Ads you've sent to compliance, and where each one stands."
        }
      />
      <EmptyState
        title="No ads yet"
        description="When you submit an ad, it shows up here with its status and any feedback from compliance."
      />
    </main>
  );
}
