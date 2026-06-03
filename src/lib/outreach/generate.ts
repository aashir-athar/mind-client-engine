// Outreach generation: pick the channel, build the deterministic template, then
// try to personalize it with the local LLM. If Ollama is offline the template IS
// the draft (safeComplete never throws). Every generated message is a DRAFT for
// the approval queue — including email (auto-send under caps comes in Phase 7).
import { logAudit } from "../audit";
import type { Channel } from "../constants";
import { prisma } from "../db";
import { matchService } from "../keywords";
import { safeComplete } from "../llm";
import { buildTemplateDraft, suggestChannel, type OutreachContext, type TemplateDraft } from "./templates";

async function personalize(
  ctx: OutreachContext,
  template: TemplateDraft,
): Promise<{ subject?: string; body: string; usedLlm: boolean }> {
  const channelStyle =
    ctx.channel === "EMAIL"
      ? "a short cold EMAIL with a subject line"
      : `a short ${ctx.channel} direct message (no subject line)`;

  const system =
    `You are a freelance web/app developer and content creator writing ${channelStyle} to a prospect. ` +
    `Rules: be specific to THIS lead and reference their real pain point; keep it under 90 words; ` +
    `friendly and human; no spam, no emojis; include exactly one soft free-value offer; end with a light question. ` +
    (ctx.channel === "EMAIL"
      ? `Return the subject on the first line as "Subject: ..." then a blank line then the body.`
      : `Return only the message text.`);

  const facts = [
    `Business: ${ctx.businessName}`,
    ctx.contactName ? `Contact name: ${ctx.contactName}` : "",
    ctx.matchedService ? `Service to pitch: ${ctx.matchedService}` : "",
    ctx.painPoint ? `Pain point: ${ctx.painPoint}` : "",
    ctx.auditSummary ? `Website audit: ${ctx.auditSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const user =
    `Lead facts:\n${facts}\n\n` +
    `Here is a draft to improve (keep its intent and the free offer):\n` +
    `${template.subject ? `Subject: ${template.subject}\n` : ""}${template.body}`;

  const fallback = template.subject ? `Subject: ${template.subject}\n\n${template.body}` : template.body;

  const { text, usedLlm } = await safeComplete(user, fallback, { system, temperature: 0.6 });
  if (!usedLlm) return { subject: template.subject, body: template.body, usedLlm: false };

  if (ctx.channel === "EMAIL") {
    const m = text.match(/^\s*subject:\s*(.+?)\n+([\s\S]+)$/i);
    if (m) return { subject: m[1].trim(), body: m[2].trim(), usedLlm: true };
    return { subject: template.subject, body: text.trim(), usedLlm: true };
  }
  return { body: text.trim(), usedLlm: true };
}

export async function generateOutreach(input: {
  leadId: string;
  channel?: Channel;
  sequenceStep?: number;
  followUp?: boolean;
}): Promise<{ messageId: string; channel: Channel; usedLlm: boolean }> {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    include: { audits: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!lead) throw new Error(`Lead not found: ${input.leadId}`);

  const channel = input.channel ?? suggestChannel(lead);
  const sequenceStep = input.sequenceStep ?? 0;
  const followUp = input.followUp ?? sequenceStep > 0;
  const matchedService =
    lead.matchedService ??
    matchService([lead.painPoint, lead.businessName, lead.notes].filter(Boolean).join(" "));

  const ctx: OutreachContext = {
    businessName: lead.businessName,
    contactName: lead.contactName,
    painPoint: lead.painPoint,
    matchedService,
    auditSummary: lead.audits[0]?.summary ?? null,
    channel,
    followUp,
  };

  const template = buildTemplateDraft(ctx);
  const draft = await personalize(ctx, template);

  // Backfill a computed service match if the lead didn't have one.
  if (!lead.matchedService && matchedService) {
    await prisma.lead.update({ where: { id: lead.id }, data: { matchedService } });
  }

  const msg = await prisma.message.create({
    data: {
      leadId: lead.id,
      channel,
      direction: "OUT",
      status: "DRAFT",
      subject: draft.subject ?? null,
      body: draft.body,
      sequenceStep,
    },
  });

  await logAudit(
    "OUTREACH_DRAFTED",
    `lead=${lead.id} channel=${channel} step=${sequenceStep} llm=${draft.usedLlm}`,
  );
  return { messageId: msg.id, channel, usedLlm: draft.usedLlm };
}
