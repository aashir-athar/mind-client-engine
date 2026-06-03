// Lead ingestion: dedupe (by email, then website domain, then sourceUrl, then
// name+source), upsert, deterministic service match, and score. Never clobbers
// fields a human may have edited — only fills blanks on an existing lead.
import { logAudit } from "../audit";
import { prisma } from "../db";
import { detectPainPoint, matchService } from "../keywords";
import { scoreAndStore } from "../scoring-run";
import type { DiscoveredLead, IngestResult } from "./types";

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

async function findExisting(d: DiscoveredLead) {
  if (d.email) {
    const byEmail = await prisma.lead.findUnique({ where: { email: d.email } });
    if (byEmail) return byEmail;
  }
  const host = hostOf(d.website);
  if (host) {
    const byHost = await prisma.lead.findFirst({ where: { website: { contains: host } } });
    if (byHost) return byHost;
  }
  if (d.sourceUrl) {
    const bySource = await prisma.lead.findFirst({ where: { sourceUrl: d.sourceUrl } });
    if (bySource) return bySource;
  }
  return prisma.lead.findFirst({
    where: { businessName: d.businessName, sourceType: d.sourceType },
  });
}

export async function upsertLead(d: DiscoveredLead): Promise<IngestResult> {
  const rawText = [d.rawText, d.painPoint, d.businessName].filter(Boolean).join(" ");
  const matchedService = matchService(rawText);
  const painPoint = d.painPoint ?? detectPainPoint(rawText);

  const existing = await findExisting(d);

  if (existing) {
    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        contactName: existing.contactName ?? d.contactName ?? null,
        website: existing.website ?? d.website ?? null,
        instagram: existing.instagram ?? d.instagram ?? null,
        linkedin: existing.linkedin ?? d.linkedin ?? null,
        twitter: existing.twitter ?? d.twitter ?? null,
        whatsapp: existing.whatsapp ?? d.whatsapp ?? null,
        location: existing.location ?? d.location ?? null,
        industry: existing.industry ?? d.industry ?? null,
        sourceUrl: existing.sourceUrl ?? d.sourceUrl ?? null,
        painPoint: existing.painPoint ?? painPoint ?? null,
        matchedService: existing.matchedService ?? matchedService ?? null,
      },
    });
    await scoreAndStore(lead.id);
    return { leadId: lead.id, businessName: lead.businessName, created: false };
  }

  const lead = await prisma.lead.create({
    data: {
      businessName: d.businessName,
      contactName: d.contactName ?? null,
      website: d.website ?? null,
      email: d.email ?? null,
      instagram: d.instagram ?? null,
      linkedin: d.linkedin ?? null,
      twitter: d.twitter ?? null,
      whatsapp: d.whatsapp ?? null,
      location: d.location ?? null,
      industry: d.industry ?? null,
      sourceType: d.sourceType,
      sourceUrl: d.sourceUrl ?? null,
      painPoint: painPoint ?? null,
      matchedService,
      status: "NEW",
    },
  });
  await scoreAndStore(lead.id);
  await logAudit("LEAD_DISCOVERED", `source=${d.sourceType} name=${d.businessName} lead=${lead.id}`);
  return { leadId: lead.id, businessName: lead.businessName, created: true };
}

export async function ingestMany(
  leads: DiscoveredLead[],
): Promise<{ created: number; updated: number; leadIds: string[] }> {
  let created = 0;
  let updated = 0;
  const leadIds: string[] = [];
  for (const d of leads) {
    try {
      const r = await upsertLead(d);
      if (r.created) created++;
      else updated++;
      leadIds.push(r.leadId);
    } catch (err) {
      // A single malformed record must not abort the whole batch.
      console.error("[ingest] failed for", d.businessName, err);
    }
  }
  return { created, updated, leadIds };
}
