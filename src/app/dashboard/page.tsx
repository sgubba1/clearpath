import { EmptyState, PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/session";

export default async function DashboardPage() {
  await requireRole(["manager"]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title="Team overview" description="How the review queue is moving." />
      <EmptyState title="No review activity yet" description="Turnaround, first-pass rate and top issues appear here once ads are reviewed." />
    </main>
  );
}
