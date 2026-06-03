"use server";

import { revalidatePath } from "next/cache";
import { LEAD_STATUSES } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { runAndStoreAudit } from "@/lib/audit-site";
import { CHANNELS, type Channel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { cancelFollowUps } from "@/lib/followups";
import { generateOutreach } from "@/lib/outreach";
import { recordReplyForLead } from "@/lib/replies";
import { scoreAndStore } from "@/lib/scoring-run";
import { addSuppression } from "@/lib/suppression";

// Lead statuses that stop the follow-up sequence (reply / "no" / closed).
const STOP_STATUSES = [
  "REPLIED",
  "INTERESTED",
  "CALL_BOOKED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
  "IGNORE",
];

export async function updateLeadStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) throw new Error("Missing lead id");
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  await prisma.lead.update({ where: { id }, data: { status } });
  await logAudit("LEAD_STATUS_CHANGE", `lead=${id} → ${status}`);

  // A reply / "no" / closed status stops any pending follow-up sequence.
  if (STOP_STATUSES.includes(status)) await cancelFollowUps(id);

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

export async function updateLeadNotes(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) throw new Error("Missing lead id");

  await prisma.lead.update({ where: { id }, data: { notes: notes || null } });
  revalidatePath(`/leads/${id}`);
}

export async function auditLeadWebsite(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing lead id");

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead?.website) throw new Error("This lead has no website to audit.");

  await runAndStoreAudit({ url: lead.website, leadId: id });
  revalidatePath(`/leads/${id}`);
}

export async function rescoreLead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing lead id");

  await scoreAndStore(id);
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

export async function generateOutreachAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing lead id");
  const raw = String(formData.get("channel") ?? "");
  const channel = (CHANNELS as readonly string[]).includes(raw) ? (raw as Channel) : undefined;

  await generateOutreach({ leadId: id, channel });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/outreach");
}

export async function suppressLead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing lead id");

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (lead?.email) await addSuppression(lead.email, "SAID_NO");
  if (lead?.instagram) await addSuppression(lead.instagram, "SAID_NO", "HANDLE");

  await prisma.lead.update({ where: { id }, data: { status: "LOST" } });
  await cancelFollowUps(id);
  await logAudit("LEAD_SUPPRESSED", `lead=${id}`);

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

export async function logReply(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing lead id");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Reply text is required");

  await recordReplyForLead(id, body);

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  revalidatePath("/replies");
}
