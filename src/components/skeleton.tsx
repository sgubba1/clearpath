import { cn } from "@/lib/utils";

// Placeholder blocks shaped like the page that's loading, so nothing jumps when it arrives.
export function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function LoadingPage({ width = "max-w-6xl", children }: { width?: string; children: React.ReactNode }) {
  return (
    <main className={cn("mx-auto w-full space-y-6 px-4 py-8 sm:px-6", width)} aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Bar className="h-8 w-56" />
        <Bar className="h-4 w-80 max-w-full" />
      </div>
      {children}
    </main>
  );
}
