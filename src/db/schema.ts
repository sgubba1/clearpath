import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const productEnum = pgEnum("product", ["personal_loan", "credit_card", "mortgage_prequal"]);
// email, sms, social and affiliate get their own fields and checks; the last two are a generic paste.
export const channelEnum = pgEnum("channel", ["email", "sms", "social", "affiliate", "landing_page", "paid_search"]);
export const submitterTypeEnum = pgEnum("submitter_type", ["in_house", "affiliate"]);
export const statusEnum = pgEnum("status", [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "rejected",
]);
export const severityEnum = pgEnum("severity", ["high", "medium", "low"]);
// open: still in the copy. acknowledged: submitter sent it anyway with a reason. dismissed: reviewer judged it a false positive.
export const flagStatusEnum = pgEnum("flag_status", ["open", "acknowledged", "dismissed"]);

// RLS is on for every table with no policies, which blocks Supabase's auto-generated REST API.
// The app connects as the table owner, so its own queries are unaffected.

export const partners = pgTable("partners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  active: boolean("active").notNull().default(true),
}).enableRLS();

// ClearPath's fictional product terms; the pre-check compares advertised terms against this.
export const rateSheet = pgTable("rate_sheet", {
  product: productEnum("product").primaryKey(),
  aprMin: doublePrecision("apr_min").notNull(),
  aprMax: doublePrecision("apr_max").notNull(),
  termMinMonths: integer("term_min_months"),
  termMaxMonths: integer("term_max_months"),
  annualFee: doublePrecision("annual_fee"),
  introAprMonths: integer("intro_apr_months"),
  nmlsId: text("nmls_id"),
  notes: text("notes").notNull(),
}).enableRLS();

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  product: productEnum("product").notNull(),
  channel: channelEnum("channel").notNull(),
  campaign: text("campaign").notNull(),
  launchDate: date("launch_date", { mode: "string" }).notNull(),
  submitterId: text("submitter_id").notNull(),
  submitterName: text("submitter_name").notNull(),
  submitterType: submitterTypeEnum("submitter_type").notNull(),
  partnerId: text("partner_id").references(() => partners.id),
  status: statusEnum("status").notNull().default("draft"),
  riskScore: integer("risk_score").notNull().default(0),
  currentVersion: integer("current_version").notNull().default(1),
  reviewerId: text("reviewer_id"),
  reviewerName: text("reviewer_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // When it last entered the queue; drives "waiting" time and the SLA flag.
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  firstSubmittedAt: timestamp("first_submitted_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const versions = pgTable(
  "versions",
  {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    // Channel-specific copy, e.g. { subject, preheader, body, footer } for email.
    fields: jsonb("fields").$type<Record<string, string>>().notNull(),
    // Submitter's note on what changed, shown to the reviewer on round 2+.
    changeNote: text("change_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("versions_submission_number_idx").on(t.submissionId, t.number)],
).enableRLS();

export const flags = pgTable("flags", {
  id: serial("id").primaryKey(),
  versionId: integer("version_id")
    .notNull()
    .references(() => versions.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull(),
  field: text("field").notNull(),
  matchText: text("match_text").notNull(),
  // Instance-specific explanation, e.g. which rate is off the rate sheet.
  detail: text("detail"),
  start: integer("start").notNull(),
  end: integer("end").notNull(),
  severity: severityEnum("severity").notNull(),
  status: flagStatusEnum("status").notNull().default("open"),
  reason: text("reason"),
}).enableRLS();

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  versionId: integer("version_id")
    .notNull()
    .references(() => versions.id, { onDelete: "cascade" }),
  // Set when the comment is about a specific flag; null means a general note for the round.
  flagId: integer("flag_id").references(() => flags.id, { onDelete: "set null" }),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number"),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  actorRole: text("actor_role").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  partner: one(partners, { fields: [submissions.partnerId], references: [partners.id] }),
  versions: many(versions),
  auditEvents: many(auditEvents),
}));

export const versionsRelations = relations(versions, ({ one, many }) => ({
  submission: one(submissions, { fields: [versions.submissionId], references: [submissions.id] }),
  flags: many(flags),
  comments: many(comments),
}));

export const flagsRelations = relations(flags, ({ one }) => ({
  version: one(versions, { fields: [flags.versionId], references: [versions.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  version: one(versions, { fields: [comments.versionId], references: [versions.id] }),
  flag: one(flags, { fields: [comments.flagId], references: [flags.id] }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  submission: one(submissions, { fields: [auditEvents.submissionId], references: [submissions.id] }),
}));

export type Product = (typeof productEnum.enumValues)[number];
export type Channel = (typeof channelEnum.enumValues)[number];
export type Status = (typeof statusEnum.enumValues)[number];
export type Severity = (typeof severityEnum.enumValues)[number];
export type Submission = typeof submissions.$inferSelect;
export type Version = typeof versions.$inferSelect;
export type Flag = typeof flags.$inferSelect;
