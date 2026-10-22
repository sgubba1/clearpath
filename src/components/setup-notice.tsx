// Shown on every page until the database is configured, so a fresh clone or a
// misconfigured deploy explains what is missing instead of failing later.
export function SetupNotice() {
  if (process.env.DATABASE_URL) return null;

  return (
    <div role="alert" className="border-b border-amber-300 bg-amber-50 text-amber-950">
      <p className="mx-auto max-w-6xl px-4 py-2 text-sm sm:px-6">
        <strong>Database not configured.</strong> Copy <code>.env.example</code> to <code>.env</code> and set{" "}
        <code>DATABASE_URL</code> to your Postgres connection string, then restart the app. On Vercel, add it under
        Project Settings → Environment Variables.
      </p>
    </div>
  );
}
