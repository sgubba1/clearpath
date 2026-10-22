import { timeAgo } from "@/lib/format";

// "2h ago", with the exact date and time on hover.
export function TimeAgo({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}>
      {timeAgo(date)}
    </time>
  );
}
