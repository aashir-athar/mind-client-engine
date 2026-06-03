// Processes follow-up tasks that are due: stop the sequence on a reply/"no",
// otherwise generate the step's message — auto-send it for email (under the same
// caps + DRY_RUN), leave a DRAFT for human-in-the-loop channels — then schedule
// the next step. Called by the node-cron worker.
import { AUTO_SEND_CHANNELS, type Channel } from "./constants";
import { DRY_RUN } from "./config";
import { prisma } from "./db";
import { randomDelayMs } from "./email-policy";
import { cancelFollowUps, scheduleFollowUp, shouldStopSequence } from "./followups";
import { dispatchMessage, generateOutreach } from "./outreach";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface FollowUpRunResult {
  processed: number;
  sent: number;
  drafted: number;
  cancelled: number;
  scheduledNext: number;
}

function isAutoSend(channel: string): boolean {
  return (AUTO_SEND_CHANNELS as readonly string[]).includes(channel);
}

export async function processDueFollowUps(now: Date = new Date()): Promise<FollowUpRunResult> {
  const due = await prisma.followUpTask.findMany({
    where: { status: "PENDING", dueAt: { lte: now } },
    include: { lead: true },
    orderBy: { dueAt: "asc" },
  });

  const result: FollowUpRunResult = {
    processed: 0,
    sent: 0,
    drafted: 0,
    cancelled: 0,
    scheduledNext: 0,
  };

  for (const task of due) {
    // STOP immediately on a reply / "no" / unsubscribe.
    if (shouldStopSequence(task.lead)) {
      result.cancelled += await cancelFollowUps(task.leadId);
      continue;
    }

    const channel = task.channel as Channel;
    const gen = await generateOutreach({
      leadId: task.leadId,
      channel,
      sequenceStep: task.sequenceStep,
      followUp: true,
    });

    if (isAutoSend(channel)) {
      const d = await dispatchMessage(gen.messageId, { manual: false });
      if (d.ok) result.sent++;
      // cap/window → the message stays a DRAFT in the queue for later/manual send.
    } else {
      result.drafted++; // human-in-the-loop channels: leave the draft for approval.
    }

    await prisma.followUpTask.update({ where: { id: task.id }, data: { status: "DONE" } });
    if (await scheduleFollowUp(task.leadId, channel, task.sequenceStep + 1)) {
      result.scheduledNext++;
    }
    result.processed++;

    // Randomized human-like delay between REAL auto-sends (skipped in DRY_RUN).
    if (!DRY_RUN && isAutoSend(channel)) await sleep(randomDelayMs());
  }

  return result;
}
