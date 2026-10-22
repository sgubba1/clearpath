export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </main>
  );
}
