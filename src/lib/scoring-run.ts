// Scoring orchestration: load a lead + its latest audit, compute the deterministic
// score, optionally apply an LLM tie-break near a band boundary (graceful — a down
// or absent Ollama changes nothing), and persist score + band. The pure, tested
// logic lives in scoring.ts.
import { logAudit } from "./audit";
import { prisma } from "./db";
import { safeComplete } from "./llm";
import { bandFor, deriveSignals, scoreLead, type ScoreResult } from "./scoring";

const BAND_BOUNDARIES = [70, 45, 25];
const BAND_BASE: Record<string, number> = { HOT: 70, WARM: 45, LOW: 25, NOT_USEFUL: 24 };
const BAND_ORDER = ["NOT_USEFUL", "LOW", "WARM", "HOT"];

function nearBoundary(score: number): boolean {
  return BAND_BOUNDARIES.some((b) => Math.abs(score - b) <= 3);
}

/**
 * LLM tie-break — ONLY when the deterministic score sits within ±3 of a band
 * cutoff. The model may nudge the band by ONE step; anything else (or an
 * unavailable LLM) leaves the deterministic result untouched.
 */
async function maybeTiebreak(result: ScoreResult, businessName: string): Promise<ScoreResult> {
  if (!nearBoundary(result.score)) return result;

  const prompt =
    `A sales lead "${businessName}" scored ${result.score}/100 (band ${result.band}) for a ` +
    `freelance web/app developer & content creator. Signals: ${result.reasons.join("; ") || "none"}. ` +
    `Reply with ONLY one word — the best band: HOT, WARM, LOW, or NOT_USEFUL.`;

  const { text, usedLlm } = await safeComplete(prompt, result.band, { temperature: 0 });
  if (!usedLlm) return result;

  const suggested = (text.match(/HOT|WARM|LOW|NOT_USEFUL/i)?.[0] ?? "").toUpperCase();
  if (!suggested || suggested === result.band) return result;

  const di = BAND_ORDER.indexOf(result.band);
  const si = BAND_ORDER.indexOf(suggested);
  if (si < 0 || Math.abs(si - di) !== 1) return result; // only adjacent bands

  const base = BAND_BASE[suggested];
  const newScore = si > di ? Math.max(result.score, base) : Math.min(result.score, base);

  return {
    ...result,
    score: newScore,
    band: bandFor(newScore),
    reasons: [...result.reasons, `LLM tie-break → ${suggested}`],
  };
}

/** Score one lead (using its latest audit) and persist score + band. */
export async function scoreAndStore(leadId: string): Promise<ScoreResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { audits: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  const result = scoreLead(deriveSignals(lead, lead.audits[0] ?? null));
  const final = await maybeTiebreak(result, lead.businessName);

  await prisma.lead.update({
    where: { id: leadId },
    data: { score: final.score, scoreBand: final.band },
  });
  await logAudit("LEAD_SCORED", `lead=${leadId} score=${final.score} band=${final.band}`);

  return final;
}

/** Rescore every lead (used by the worker after discovery in later phases). */
export async function scoreAllLeads(): Promise<{ scored: number }> {
  const leads = await prisma.lead.findMany({ select: { id: true } });
  for (const { id } of leads) {
    await scoreAndStore(id);
  }
  return { scored: leads.length };
}
