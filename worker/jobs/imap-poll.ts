// node-cron job: poll IMAP for replies. No-op when IMAP_* is unset (pollImap
// self-gates), so it's safe to schedule unconditionally. Logs only when it did work.
import { pollImap } from "../../src/lib/imap";

export async function runImapPoll(): Promise<void> {
  try {
    const r = await pollImap();
    if (r.polled && (r.processed > 0 || r.errors > 0)) {
      console.log(
        `[worker ${new Date().toISOString()}] imap → processed=${r.processed} ` +
          `recorded=${r.recorded} skipped=${r.skipped} errors=${r.errors}`,
      );
    }
  } catch (err) {
    console.error("[worker] imap poll failed:", err);
  }
}
