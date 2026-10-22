import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { RuleForm } from "@/components/rule-form";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Add a rule" };

export default async function NewRulePage() {
  await requireRole(["reviewer", "manager"]);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Add a rule"
        description="Team rules run in every pre-check from the moment they're added, alongside the built-in library. Turn one off any time from Ad rules."
      />
      <RuleForm />
    </main>
  );
}
