import { Bar, LoadingPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <LoadingPage width="max-w-4xl">
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Bar key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </LoadingPage>
  );
}
