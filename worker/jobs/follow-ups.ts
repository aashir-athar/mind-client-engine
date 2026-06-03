// node-cron job: process due follow-up tasks. Auto-sends email steps (under caps
// + DRY_RUN), drafts other channels, schedules the next step, and stops sequences
// on a reply. Logs only when it did something.
import { processDueFollowUps } from "../../src/lib/followups-run";

export async function runFollowUps(): Promise<void> {
  try {
    const r = await processDueFollowUps();
    if (r.processed > 0 || r.cancelled > 0) {
      console.log(
        `[worker ${new Date().toISOString()}] follow-ups → processed=${r.processed} ` +
          `sent=${r.sent} drafted=${r.drafted} cancelled=${r.cancelled} next=${r.scheduledNext}`,
      );
    }
  } catch (err) {
    console.error("[worker] follow-up job failed:", err);
  }
}
