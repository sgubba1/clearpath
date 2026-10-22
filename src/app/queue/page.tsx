import { EmptyState, PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/session";

export default async function QueuePage() {
  await requireRole(["reviewer"]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title="Review queue" description="Ads waiting for review, riskiest first." />
      <EmptyState title="Nothing waiting for review" description="New submissions appear here as soon as they're sent." />
    </main>
  );
}
