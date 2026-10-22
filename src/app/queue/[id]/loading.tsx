import { Bar, LoadingPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <LoadingPage>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Bar className="h-72 rounded-xl" />
        <Bar className="h-96 rounded-xl" />
      </div>
    </LoadingPage>
  );
}
