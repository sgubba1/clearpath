import type { Severity, Status } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/labels";
import { riskLevel } from "@/lib/risk";
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

export function RiskBadge({ score }: { score: number }) {
  const level = riskLevel(score);
  return (
    <span
      title={`Risk score ${score}`}
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

// Plain-language reasons behind a risk score, e.g. "5 high-severity flags +15 · Partner submission +2".
export function RiskReasons({ parts, className }: { parts: { label: string; points: number }[]; className?: string }) {
  return (
    <span className={cn("block text-xs text-muted-foreground", className)}>
      {parts.length === 0 ? "No open flags or risk factors" : parts.map((part) => `${part.label} +${part.points}`).join(" · ")}
    </span>
  );
}
