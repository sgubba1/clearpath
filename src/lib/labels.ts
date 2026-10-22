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

export type ChannelField = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "url" | "select";
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: string[];
  rows?: number;
};

// Fields each channel collects, in display order. Landing page and paid search are a generic paste.
export const CHANNEL_FIELDS: Record<Channel, ChannelField[]> = {
  email: [
    { key: "subject", label: "Subject line", kind: "text", required: true, placeholder: "e.g. 2% cash back on everything you buy" },
    { key: "preheader", label: "Preview text", kind: "text", help: "The line shown after the subject in most inboxes." },
    { key: "body", label: "Email body", kind: "textarea", required: true, rows: 8 },
    {
      key: "footer",
      label: "Footer",
      kind: "textarea",
      required: true,
      rows: 3,
      help: "Include the unsubscribe link and ClearPath's mailing address.",
    },
  ],
  sms: [
    { key: "message", label: "Text message", kind: "textarea", required: true, rows: 4, help: "Keep it to 160 characters to send as one message." },
    {
      key: "consentSource",
      label: "Where recipients agreed to get texts",
      kind: "text",
      required: true,
      placeholder: "e.g. Opt-in checkbox at checkout",
    },
  ],
  social: [
    { key: "platform", label: "Platform", kind: "select", required: true, options: ["Facebook", "Instagram", "LinkedIn", "TikTok", "X"] },
    { key: "postCopy", label: "Post copy", kind: "textarea", required: true, rows: 6, help: "Everything people will read, including text shown after \"See more\"." },
    { key: "link", label: "Link", kind: "url", placeholder: "https://clearpath.example.com/..." },
  ],
  affiliate: [
    { key: "placementUrl", label: "Page where the ad will appear", kind: "url", required: true, placeholder: "https://your-site.example.com/..." },
    { key: "copy", label: "Ad copy", kind: "textarea", required: true, rows: 8, help: "Paste exactly what visitors will see, including any fine print." },
  ],
  landing_page: [
    { key: "url", label: "Page URL", kind: "url", required: true, placeholder: "https://clearpath.example.com/..." },
    { key: "copy", label: "Page copy", kind: "textarea", required: true, rows: 10, help: "Paste all of the page's text, including fine print." },
  ],
  paid_search: [
    { key: "url", label: "Landing page URL", kind: "url", required: true, placeholder: "https://clearpath.example.com/..." },
    { key: "copy", label: "Headlines and descriptions", kind: "textarea", required: true, rows: 6, help: "One per line." },
  ],
};

export const CHANNEL_HINTS: Record<Channel, string> = {
  email: "Subject, preview text, body and footer",
  sms: "One text message",
  social: "A post on Facebook, Instagram and others",
  affiliate: "Your placement promoting a ClearPath offer",
  landing_page: "A page on clearpath.example.com",
  paid_search: "Search ad headlines and descriptions",
};

// Which channels each kind of submitter can use. Partners submit their own placements only.
export const CHANNELS_FOR: Record<"in_house" | "affiliate", Channel[]> = {
  in_house: ["email", "sms", "social", "landing_page", "paid_search"],
  affiliate: ["affiliate"],
};

export function submissionRef(id: number) {
  return `CP-${1000 + id}`;
}
