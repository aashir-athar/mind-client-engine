// Allowed string values for the (enum-less) SQLite schema.
//
// Prisma can't use native `enum`s with SQLite, so status/band/channel/etc. are
// stored as plain strings. Defining them here as `as const` tuples gives us typed
// unions + runtime arrays (for validation, dropdowns, and seeding) so the rest of
// the codebase never hand-writes a magic string.

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "FOLLOW_UP_NEEDED",
  "REPLIED",
  "INTERESTED",
  "CALL_BOOKED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
  "IGNORE",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SCORE_BANDS = ["HOT", "WARM", "LOW", "NOT_USEFUL"] as const;
export type ScoreBand = (typeof SCORE_BANDS)[number];

export const CHANNELS = [
  "EMAIL",
  "LINKEDIN",
  "INSTAGRAM",
  "WHATSAPP",
  "TWITTER",
  "UPWORK",
  "REDDIT",
] as const;
export type Channel = (typeof CHANNELS)[number];

/** Channels safe to auto-send. Everything else is human-in-the-loop (draft only). */
export const AUTO_SEND_CHANNELS: readonly Channel[] = ["EMAIL"] as const;

export const MESSAGE_DIRECTIONS = ["OUT", "IN"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const MESSAGE_STATUSES = ["DRAFT", "APPROVED", "SENT", "FAILED"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const FOLLOWUP_STATUSES = ["PENDING", "DONE", "CANCELLED"] as const;
export type FollowUpStatus = (typeof FOLLOWUP_STATUSES)[number];

export const SUPPRESSION_REASONS = ["UNSUBSCRIBE", "SAID_NO", "BOUNCED"] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export const SUPPRESSION_KINDS = ["EMAIL", "HANDLE"] as const;
export type SuppressionKind = (typeof SUPPRESSION_KINDS)[number];

export const SOURCE_TYPES = [
  "OVERPASS",
  "REDDIT",
  "RSS",
  "PASTE",
  "MANUAL",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** The services the user sells (drives service matching + outreach templates). */
export const SERVICES = [
  "Web Development",
  "Mobile App Development (React Native / Expo)",
  "App Rescue / Bug Fixing",
  "Crypto Tools (dashboards, trading journals, landing pages)",
  "Video Editing",
  "Image Editing",
  "Instagram / Short-form Content",
] as const;
export type Service = (typeof SERVICES)[number];

/** Follow-up cadence in days (Day 1 / 3 / 7 / 14) used by the scheduler in Phase 8. */
export const FOLLOWUP_SEQUENCE_DAYS = [1, 3, 7, 14] as const;
