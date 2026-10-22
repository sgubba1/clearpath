import { Bar, LoadingPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <LoadingPage>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Bar key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Bar className="h-32 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Bar className="h-64 rounded-xl" />
        <Bar className="h-64 rounded-xl" />
      </div>
    </LoadingPage>
  );
}
