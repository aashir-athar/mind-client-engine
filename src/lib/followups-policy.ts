// Pure follow-up policy — no I/O, unit-tested. The DB-backed scheduling lives in
// followups.ts (which re-exports these).
import { FOLLOWUP_SEQUENCE_DAYS } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_FOLLOWUP_STEP = FOLLOWUP_SEQUENCE_DAYS.length; // 4

// Lead statuses (or any inbound reply) that immediately STOP the sequence.
const STOP_STATUSES = new Set([
  "REPLIED",
  "INTERESTED",
  "CALL_BOOKED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
  "IGNORE",
]);

/** Should the follow-up sequence stop for this lead? */
export function shouldStopSequence(lead: { status: string; repliesCount: number }): boolean {
  return STOP_STATUSES.has(lead.status) || lead.repliesCount > 0;
}

/** Due date for follow-up `step` (1-based) measured from the initial contact. */
export function followUpDueDate(base: Date, step: number): Date {
  const idx = Math.min(Math.max(step, 1), FOLLOWUP_SEQUENCE_DAYS.length) - 1;
  return new Date(base.getTime() + FOLLOWUP_SEQUENCE_DAYS[idx] * DAY_MS);
}
