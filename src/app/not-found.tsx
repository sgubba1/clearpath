import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted-foreground">
        The ad or page may have been removed when the demo data was reset, or it belongs to another partner.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to the start</Link>
      </Button>
    </main>
  );
}
