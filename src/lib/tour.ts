import type { IdentityId } from "@/lib/identities";

// The guided path evaluators can follow without anyone explaining the product: one
// marketer's ad from first draft to approval, then the manager's view of the team.
export type TourStep = { identity: IdentityId; href: string; title: string; body: string };

export const TOUR: TourStep[] = [
  {
    identity: "maya",
    href: "/ads/new",
    title: "Maya writes an email",
    body: "Load the “Debt consolidation email” example. It reads like normal copy, yet the pre-check flags five issues as you watch. Apply the fixes, try the AI second opinion, then submit.",
  },
  {
    identity: "dev",
    href: "/queue",
    title: "Dev reviews the riskiest ad first",
    body: "The queue is sorted by risk. Open the partner ad at the top: the flags, the partner's reason and the rate sheet are all on one screen. Comment on a flag and request changes.",
  },
  {
    identity: "brightpath",
    href: "/ads",
    title: "A partner fixes what was sent back",
    body: "Jordan's “Top cash back cards roundup” came back with comments. Open it, choose Revise and resubmit, apply the fix the reviewer asked for and resubmit.",
  },
  {
    identity: "dev",
    href: "/queue",
    title: "Round 2 takes seconds",
    body: "Open the roundup, now marked Round 2. Dev sees only what changed and that the flag is fixed, so there's nothing to re-read. Approve it.",
  },
  {
    identity: "priya",
    href: "/dashboard",
    title: "Priya sees the whole team",
    body: "Turnaround, first-time approvals and the most common issues, plus an approved ad that went stale when rates changed. The Audit log tab has every step you just took.",
  },
];

export const TOUR_COOKIE = "cp_tour";
