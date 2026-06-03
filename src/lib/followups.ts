// DB-backed follow-up scheduling. Pure policy (cadence, stop rules) is in
// followups-policy.ts and re-exported here for convenience.
import { prisma } from "./db";
import { followUpDueDate, MAX_FOLLOWUP_STEP, shouldStopSequence } from "./followups-policy";

export { followUpDueDate, MAX_FOLLOWUP_STEP, shouldStopSequence };

/** Cancel all pending follow-ups for a lead (on reply / "no" / unsubscribe). */
export async function cancelFollowUps(leadId: string): Promise<number> {
  const r = await prisma.followUpTask.updateMany({
    where: { leadId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: null } });
  return r.count;
}

/** The sequence base = the lead's first sent outbound message (or now). */
async function sequenceBase(leadId: string): Promise<Date> {
  const first = await prisma.message.findFirst({
    where: { leadId, direction: "OUT", status: "SENT" },
    orderBy: { sentAt: "asc" },
  });
  return first?.sentAt ?? new Date();
}

/** Schedule follow-up `step` if the lead is still active and it isn't already queued. */
export async function scheduleFollowUp(
  leadId: string,
  channel: string,
  step: number,
  base?: Date,
): Promise<boolean> {
  if (step < 1 || step > MAX_FOLLOWUP_STEP) return false;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || shouldStopSequence(lead)) return false;

  const existing = await prisma.followUpTask.findFirst({
    where: { leadId, sequenceStep: step, status: { in: ["PENDING", "DONE"] } },
  });
  if (existing) return false;

  const dueAt = followUpDueDate(base ?? (await sequenceBase(leadId)), step);
  await prisma.followUpTask.create({
    data: { leadId, channel, sequenceStep: step, dueAt, status: "PENDING" },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: dueAt } });
  return true;
}

/** Enroll a lead into the sequence right after the initial outreach is sent. */
export async function enrollFollowUps(leadId: string, channel: string): Promise<void> {
  await scheduleFollowUp(leadId, channel, 1);
}
