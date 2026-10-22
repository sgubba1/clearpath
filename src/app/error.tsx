"use client";

import { Button } from "@/components/ui/button";

// Server error details are hidden in production, so this stays generic; a missing
// DATABASE_URL is explained by the setup notice in the layout instead.
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-xl font-semibold">This page didn&apos;t load</h1>
      <p className="mt-2 text-muted-foreground">
        Usually this is a brief problem reaching the database. Try again in a moment.
      </p>
      <Button className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
