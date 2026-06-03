// Reply processing — the single choke point that filters, matches a lead, records
// an inbound Message, updates status (advance-only), suppresses on opt-out, and
// stops the follow-up sequence. Shared by the IMAP poller (recordReply, matches by
// sender) and the manual action (recordReplyForLead).
import { logAudit } from "./audit";
import { config } from "./config";
import { prisma } from "./db";
import { emailDomain } from "./email-policy";
import { cancelFollowUps } from "./followups";
import {
  cleanAddress,
  isBounceSender,
  isFreeMailDomain,
  isLikelyAutomated,
  isOptOut,
  stripQuotedAndFooter,
  type ReplyHeaders,
} from "./replies-policy";
import { addSuppression } from "./suppression";

export interface RecordReplyResult {
  recorded: boolean;
  leadId?: string;
  optedOut?: boolean;
  reason?: string;
}

// Statuses early enough in the pipeline to advance to REPLIED. We never regress a
// lead that's already further along (INTERESTED/WON/LOST/…).
const ADVANCEABLE = new Set(["NEW", "CONTACTED", "FOLLOW_UP_NEEDED"]);

type LeadRow = { id: string; status: string; email: string | null };

/** Pull the bare address out of a possibly "Name <addr>" string. */
function addrOf(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/<([^>]+)>/);
  return cleanAddress(m ? m[1] : s);
}

/** Attach an inbound reply to a known lead: record, advance-only status, suppress, cancel. */
async function applyReply(
  lead: LeadRow,
  input: { subject?: string | null; body: string; providerId?: string | null; receivedAt?: Date; fromEmail?: string | null },
): Promise<RecordReplyResult> {
  const cleanText = stripQuotedAndFooter(input.body);
  const optedOut = isOptOut(cleanText);

  await prisma.message.create({
    data: {
      leadId: lead.id,
      channel: "EMAIL",
      direction: "IN",
      subject: input.subject ?? null,
      body: input.body,
      status: "SENT", // inbound = recorded
      sequenceStep: 0,
      providerId: input.providerId ?? null,
      sentAt: input.receivedAt ?? new Date(),
    },
  });

  // Advance-only status. A reply of any kind always stops the sequence.
  let newStatus = lead.status;
  if (optedOut) {
    if (lead.status !== "WON") newStatus = "LOST"; // a paying customer stays WON, just suppressed
  } else if (ADVANCEABLE.has(lead.status)) {
    newStatus = "REPLIED";
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: newStatus, repliesCount: { increment: 1 } },
  });
  await cancelFollowUps(lead.id);

  if (optedOut) {
    const from = cleanAddress(input.fromEmail);
    if (from) await addSuppression(from, "UNSUBSCRIBE"); // exact address only, never the domain
    await logAudit("REPLY_OPTOUT", `lead=${lead.id} from=${from ?? "-"}`);
  } else {
    await logAudit("REPLY_RECORDED", `lead=${lead.id}`);
  }

  return { recorded: true, leadId: lead.id, optedOut };
}

/** Match a sender to a lead: exact email, then a guarded single-active-domain fallback. */
async function matchLead(from: string): Promise<LeadRow | null> {
  const exact = await prisma.lead.findUnique({ where: { email: from } });
  if (exact) return exact;

  const domain = emailDomain(from);
  if (!domain || isFreeMailDomain(domain)) return null; // never guess on free-mail
  const candidates = await prisma.lead.findMany({
    where: { email: { endsWith: `@${domain}` }, status: { notIn: ["LOST", "IGNORE"] } },
    take: 2,
  });
  return candidates.length === 1 ? candidates[0] : null; // accept ONLY a single active lead
}

/** Record a reply received by email (IMAP poller). Filters, matches, dedupes. */
export async function recordReply(input: {
  fromEmail: string;
  subject?: string | null;
  body: string;
  providerId?: string | null;
  receivedAt?: Date;
  headers?: ReplyHeaders;
}): Promise<RecordReplyResult> {
  const from = cleanAddress(input.fromEmail);
  if (!from) {
    await logAudit("REPLY_NO_SENDER");
    return { recorded: false, reason: "no sender" };
  }

  // 1) Never record our own sent mail as an inbound reply.
  const ours = [addrOf(config.SMTP_FROM), addrOf(config.SMTP_USER), cleanAddress(config.IMAP_USER)].filter(
    Boolean,
  ) as string[];
  if (ours.includes(from)) return { recorded: false, reason: "own address" };

  // 2) Auto-replies / out-of-office (BEFORE any keyword scan).
  if (isLikelyAutomated(from, input.subject, input.headers)) {
    await logAudit("REPLY_AUTO", `from=${from}`);
    return { recorded: false, reason: "auto-reply" };
  }

  // 3) Bounces / mailer-daemon (minimum viable: short-circuit, no reply side-effects).
  if (isBounceSender(from)) {
    await logAudit("REPLY_BOUNCE", `from=${from}`);
    return { recorded: false, reason: "bounce" };
  }

  // 4) Idempotency pre-check (the single poll lock prevents concurrent overlap).
  if (input.providerId) {
    const existing = await prisma.message.findFirst({ where: { providerId: input.providerId } });
    if (existing) return { recorded: false, reason: "already recorded", leadId: existing.leadId };
  }

  // 5) Match a lead (no triage bucket in v1 — unknown senders are logged, not stored).
  const lead = await matchLead(from);
  if (!lead) {
    await logAudit("REPLY_NO_LEAD", `from=${from}`);
    return { recorded: false, reason: "no matching lead" };
  }

  return applyReply(lead, { ...input, fromEmail: from });
}

/** Record a reply for a specific lead (manual "log reply" — bypasses filtering). */
export async function recordReplyForLead(
  leadId: string,
  body: string,
  subject?: string | null,
): Promise<RecordReplyResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { recorded: false, reason: "lead not found" };
  return applyReply(lead, { body, subject: subject ?? "(manual reply)", fromEmail: lead.email, providerId: null });
}
