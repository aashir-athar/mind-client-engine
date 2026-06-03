// Dispatch a queued Message: dedupe the step, send (email via the engine, other
// channels are human-sent → just marked sent), update statuses. Used by the
// Outreach Queue "Send" action and (Phase 8) the follow-up scheduler.
import { logAudit } from "../audit";
import { prisma } from "../db";
import { sendEmail } from "../email";
import { enrollFollowUps } from "../followups";

export interface DispatchResult {
  ok: boolean;
  status: string;
  reason?: string;
  dryRun?: boolean;
  retryable?: boolean;
}

// Don't downgrade a lead that's already further along the pipeline.
function statusAfterContact(current: string): string {
  const advanced = ["REPLIED", "INTERESTED", "CALL_BOOKED", "PROPOSAL_SENT", "WON", "LOST"];
  return advanced.includes(current) ? current : "CONTACTED";
}

async function markSent(msg: {
  id: string;
  leadId: string;
  channel: string;
  sequenceStep: number;
  lead: { status: string };
}) {
  await prisma.message.update({ where: { id: msg.id }, data: { status: "SENT", sentAt: new Date() } });
  await prisma.lead.update({
    where: { id: msg.leadId },
    data: { status: statusAfterContact(msg.lead.status), lastContactedAt: new Date() },
  });
  // The initial outreach (step 0) enrolls the lead into the follow-up sequence.
  if (msg.sequenceStep === 0) {
    await enrollFollowUps(msg.leadId, msg.channel);
  }
}

export async function dispatchMessage(
  messageId: string,
  opts?: { manual?: boolean },
): Promise<DispatchResult> {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    include: { lead: true },
  });
  if (!msg) return { ok: false, status: "FAILED", reason: "message not found" };
  if (msg.direction !== "OUT") return { ok: false, status: msg.status, reason: "not outbound" };
  if (msg.status === "SENT") return { ok: true, status: "SENT", reason: "already sent" };

  // Dedupe: never send the same lead + channel + sequence step twice.
  const dupe = await prisma.message.findFirst({
    where: {
      leadId: msg.leadId,
      channel: msg.channel,
      sequenceStep: msg.sequenceStep,
      status: "SENT",
      id: { not: msg.id },
    },
  });
  if (dupe) {
    await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } });
    return { ok: false, status: "FAILED", reason: "duplicate step already sent" };
  }

  if (msg.channel === "EMAIL") {
    const to = msg.lead.email ?? "";
    if (!to) {
      await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } });
      return { ok: false, status: "FAILED", reason: "lead has no email" };
    }
    const r = await sendEmail({
      to,
      subject: msg.subject ?? `Quick idea for ${msg.lead.businessName}`,
      body: msg.body,
      ignoreWindow: opts?.manual,
    });
    if (!r.sent) {
      if (r.retryable) {
        // cap/window — keep it queued for a later attempt, don't fail it.
        return { ok: false, status: msg.status, reason: r.reason, dryRun: r.dryRun, retryable: true };
      }
      await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } });
      return { ok: false, status: "FAILED", reason: r.reason, dryRun: r.dryRun };
    }
    await markSent(msg);
    return { ok: true, status: "SENT", dryRun: r.dryRun };
  }

  // Non-email channels are sent manually by the user; "send" just records it.
  await markSent(msg);
  await logAudit("MESSAGE_MARKED_SENT", `lead=${msg.leadId} channel=${msg.channel}`);
  return { ok: true, status: "SENT" };
}
