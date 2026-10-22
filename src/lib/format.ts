const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(date: Date, now = new Date()) {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  const days = Math.floor(diff / DAY);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function hoursSince(date: Date, now = new Date()) {
  return (now.getTime() - date.getTime()) / HOUR;
}

// Short waiting time for the queue: "45m", "9h", "2d 4h".
export function waitingFor(date: Date, now = new Date()) {
  const diff = now.getTime() - date.getTime();
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MINUTE))}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  return `${Math.floor(diff / DAY)}d ${Math.floor((diff % DAY) / HOUR)}h`;
}

// Launch dates are calendar days (YYYY-MM-DD), compared in local time.
export function daysUntil(isoDate: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / DAY);
}

export function launchLabel(isoDate: string, now = new Date()) {
  const days = daysUntil(isoDate, now);
  if (days < -1) return `Launched ${-days} days ago`;
  if (days === -1) return "Launched yesterday";
  if (days === 0) return "Launches today";
  if (days === 1) return "Launches tomorrow";
  return `Launches in ${days} days`;
}

export function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// When a submitter can expect a decision, from the review target. Says so plainly if it's late.
export function decisionExpectation(
  status: "submitted" | "in_review",
  submittedAt: Date | null,
  reviewerName: string | null,
  targetHours: number,
  now = new Date(),
) {
  const who = status === "in_review" && reviewerName ? `In review with ${reviewerName}` : "Waiting for a reviewer";
  if (!submittedAt) return who;
  const due = new Date(submittedAt.getTime() + targetHours * HOUR);
  if (due < now) return `${who} · taking longer than the usual two days, so it's marked overdue in the review queue`;
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(now.getTime() + DAY);
  const when = sameDay(due, now)
    ? "today"
    : sameDay(due, tomorrow)
      ? "tomorrow"
      : `by ${due.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
  return `${who} · decision expected ${when}`;
}
