// Standalone worker process (separate from Next.js). Started with `npm run worker`.
// Runs the follow-up scheduler on node-cron: every minute it processes any due
// follow-up tasks (email auto-sends under caps + DRY_RUN, other channels draft,
// next step scheduled, sequences stopped on replies).
//
// NOTE: load-env MUST be the first import so DATABASE_URL is set before any module
// that reads it (db/config) is evaluated.
import "./load-env";

import cron from "node-cron";

import { config, DRY_RUN } from "../src/lib/config";
import { imapConfigured } from "../src/lib/imap";
import { runFollowUps } from "./jobs/follow-ups";
import { runImapPoll } from "./jobs/imap-poll";
import { runSampleJob } from "./jobs/sample-job";

const imapOn = imapConfigured();

console.log("─".repeat(56));
console.log("  MiND Client Engine — worker");
console.log(`  DRY_RUN : ${DRY_RUN}  (true = nothing is actually sent)`);
console.log(`  LLM     : ${config.LLM_PROVIDER} (${config.OLLAMA_MODEL})`);
console.log(`  Email   : cap ${config.EMAIL_DAILY_CAP}/day, window ${config.SEND_WINDOW_START}-${config.SEND_WINDOW_END}h`);
console.log(`  IMAP    : ${imapOn ? `ON (${config.IMAP_USER}, every ${config.IMAP_POLL_MINUTES}m)` : "OFF (log replies manually)"}`);
console.log("─".repeat(56));

// Startup: prove DB connectivity, then process anything already due.
runSampleJob().catch((err) => console.error("[worker] startup check failed:", err));
runFollowUps();
runImapPoll();

// Follow-up scheduler — every minute.
cron.schedule("* * * * *", () => {
  runFollowUps();
}, { name: "follow-ups" });

// Reply poller — every IMAP_POLL_MINUTES (no-op when IMAP is unconfigured).
cron.schedule(`*/${config.IMAP_POLL_MINUTES} * * * *`, () => {
  runImapPoll();
}, { name: "imap-poll" });

console.log(
  `Scheduled: follow-ups (every minute)${imapOn ? `, IMAP poll (every ${config.IMAP_POLL_MINUTES}m)` : ""}. ` +
    `Worker running — press Ctrl+C to stop.`,
);

const shutdown = (signal: string) => {
  console.log(`\n[worker] received ${signal}, shutting down.`);
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
