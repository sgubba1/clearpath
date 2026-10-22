import type { Severity, Status } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/labels";
import { riskLevel, type RiskPart } from "@/lib/risk";
import { cn } from "@/lib/utils";

// Color is never the only signal: every badge carries a text label.
const STATUS_STYLES: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  submitted: "bg-sky-50 text-sky-800 border-sky-200",
  in_review: "bg-indigo-50 text-indigo-800 border-indigo-200",
  changes_requested: "bg-amber-50 text-amber-900 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-red-50 text-red-800 border-red-200",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const RISK_STYLES = {
  high: "bg-red-600 text-white",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-muted text-muted-foreground",
} as const;

export function RiskBadge({ score, parts }: { score: number; parts?: RiskPart[] }) {
  const level = riskLevel(score);
  // Hover shows the arithmetic; the visible text stays short.
  const detail = parts?.length ? `: ${parts.map((part) => `${part.label} +${part.points}`).join(", ")}` : "";
  return (
    <span
      title={`Risk score ${score}${detail}`}
      className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap", RISK_STYLES[level])}
    >
      {level === "high" ? "High risk" : level === "medium" ? "Medium risk" : "Low risk"}
    </span>
  );
}

export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warning" | "partner" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "neutral" && "border-border text-muted-foreground",
        tone === "warning" && "border-red-200 bg-red-50 text-red-800",
        tone === "partner" && "border-violet-200 bg-violet-50 text-violet-800",
      )}
    >
      {children}
    </span>
  );
}

// Severity colors for flags. Kept here, not in a client component, so server pages can use them too.
export const SEVERITY_BADGE: Record<Severity, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-sky-100 text-sky-900",
};

// Plain-language reasons behind a risk score. "compact" is for scanning the queue: just the flags,
// since partner status and launch timing are already visible on the row (hover the badge for the
// arithmetic). The full form, with points, is for the review screen.
export function RiskReasons({ parts, compact = false, className }: { parts: RiskPart[]; compact?: boolean; className?: string }) {
  if (!compact) {
    return (
      <span className={cn("block text-xs text-muted-foreground", className)}>
        {parts.length === 0 ? "No open flags or risk factors" : parts.map((part) => `${part.label} +${part.points}`).join(" · ")}
      </span>
    );
  }
  const flagCount = parts.reduce((sum, part) => sum + (part.kind === "flags" ? (part.count ?? 0) : 0), 0);
  const highCount = parts.find((part) => part.kind === "flags" && part.severity === "high")?.count ?? 0;
  const plural = (n: number) => (n === 1 ? "" : "s");
  const summary =
    flagCount === 0
      ? "No open flags"
      : highCount === flagCount
        ? `${flagCount} high-severity flag${plural(flagCount)}`
        : highCount
          ? `${flagCount} flags, ${highCount} high-severity`
          : `${flagCount} flag${plural(flagCount)}`;
  return <span className={cn("block text-xs text-muted-foreground", className)}>{summary}</span>;
}
