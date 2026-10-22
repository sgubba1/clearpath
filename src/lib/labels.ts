import type { Channel, Product, Severity, Status } from "@/db/schema";

export const PRODUCT_LABELS: Record<Product, string> = {
  personal_loan: "Personal loan",
  credit_card: "Credit card",
  mortgage_prequal: "Mortgage prequal",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  sms: "SMS",
  social: "Social",
  affiliate: "Affiliate",
  landing_page: "Landing page",
  paid_search: "Paid search",
};

export const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  submitted: "Waiting for review",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

// Fields each channel collects, in display order. Landing page and paid search are a generic paste.
export const CHANNEL_FIELDS: Record<Channel, { key: string; label: string }[]> = {
  email: [
    { key: "subject", label: "Subject line" },
    { key: "preheader", label: "Preheader" },
    { key: "body", label: "Body" },
    { key: "footer", label: "Footer" },
  ],
  sms: [
    { key: "message", label: "Message" },
    { key: "consentSource", label: "Where recipients opted in" },
  ],
  social: [
    { key: "platform", label: "Platform" },
    { key: "postCopy", label: "Post copy" },
    { key: "link", label: "Link" },
  ],
  affiliate: [
    { key: "placementUrl", label: "Where it will appear" },
    { key: "copy", label: "Ad copy" },
  ],
  landing_page: [
    { key: "url", label: "Page URL" },
    { key: "copy", label: "Page copy" },
  ],
  paid_search: [
    { key: "url", label: "Landing page URL" },
    { key: "copy", label: "Headlines and descriptions" },
  ],
};

export function submissionRef(id: number) {
  return `CP-${1000 + id}`;
}
