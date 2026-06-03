// Scoring engine — PURE, deterministic, explainable. No I/O, no env, no LLM, so
// it is fully unit-testable and every score can be explained in the lead detail
// view. The persistence + optional LLM tie-break live in scoring-run.ts.
import type { ScoreBand } from "./constants";

export interface ScoreSignals {
  hasWebsite: boolean;
  websiteAudited: boolean;
  websiteIssues: number; // 0–100 audit severity (0 when healthy or not audited)
  nicheMatch: boolean;
  matchedService: string | null;
  painPoint: boolean;
  hiringSignal: boolean;
  weakSocial: boolean;
  affordability: boolean;
  hasContact: boolean;
}

export interface ScoreContribution {
  rule: string;
  detail: string;
  points: number;
}

export interface ScoreResult {
  score: number; // 0–100
  band: ScoreBand;
  contributions: ScoreContribution[];
  reasons: string[]; // human-readable, only the contributing rules
}

/** Band thresholds — the single place the cutoffs are defined. */
export function bandFor(score: number): ScoreBand {
  if (score >= 70) return "HOT";
  if (score >= 45) return "WARM";
  if (score >= 25) return "LOW";
  return "NOT_USEFUL";
}

/** Re-derive an audit severity (0–100) from a stored AuditResult's columns. */
export function auditSeverityFromResult(a: {
  https: boolean;
  mobileFriendly: boolean;
  hasSeoBasics: boolean;
  pageSpeedScore?: number | null;
  pageSizeKb?: number | null;
}): number {
  let s = 0;
  if (!a.https) s += 25;
  if (!a.mobileFriendly) s += 25;
  if (!a.hasSeoBasics) s += 20;
  if (a.pageSpeedScore != null && a.pageSpeedScore < 50) s += 15;
  if (a.pageSizeKb != null && a.pageSizeKb > 2048) s += 10;
  return Math.min(100, s);
}

const HIRING_RE =
  /\b(hiring|looking for|looking to hire|seeking|recruit(?:ing|er)?|freelancer|contractor|need(?:s|ing)?\s+(?:a\s+|an\s+)?(?:developer|designer|dev|engineer|website|app))\b/i;
const SOCIAL_RE =
  /\b(instagram|insta|social media|content|engagement|reels?|tiktok|posts?|followers?)\b/i;

export interface LeadLike {
  website?: string | null;
  email?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  whatsapp?: string | null;
  matchedService?: string | null;
  painPoint?: string | null;
  notes?: string | null;
  industry?: string | null;
  sourceType?: string | null;
}

export interface AuditLike {
  https: boolean;
  mobileFriendly: boolean;
  hasSeoBasics: boolean;
  pageSpeedScore?: number | null;
  pageSizeKb?: number | null;
}

/** Map a Lead (+ its latest audit) to the signal set scoreLead consumes. */
export function deriveSignals(lead: LeadLike, audit: AuditLike | null): ScoreSignals {
  const text = `${lead.painPoint ?? ""} ${lead.notes ?? ""}`.trim();
  const serviceIsContent = /content|instagram/i.test(lead.matchedService ?? "");
  const hasSocialHandle = !!(lead.instagram || lead.twitter);

  return {
    hasWebsite: !!lead.website,
    websiteAudited: !!audit,
    websiteIssues: audit ? auditSeverityFromResult(audit) : 0,
    nicheMatch: !!lead.matchedService,
    matchedService: lead.matchedService ?? null,
    painPoint: !!lead.painPoint,
    hiringSignal: lead.sourceType === "RSS" || HIRING_RE.test(text),
    weakSocial: serviceIsContent || (hasSocialHandle && SOCIAL_RE.test(text)),
    affordability: !!lead.website || !!lead.industry,
    hasContact: !!(
      lead.email ||
      lead.whatsapp ||
      lead.instagram ||
      lead.linkedin ||
      lead.twitter
    ),
  };
}

/**
 * Deterministic weighted score. Each rule adds an explainable contribution.
 * Weights are tuned so a strong, reachable, niche-matched lead with a fixable
 * website lands in HOT, while junk (no signals) lands in NOT_USEFUL.
 */
export function scoreLead(s: ScoreSignals): ScoreResult {
  const c: ScoreContribution[] = [];

  // Niche match to the services I sell (strongest single signal).
  c.push(
    s.nicheMatch
      ? {
          rule: "nicheMatch",
          detail: `Matches your service${s.matchedService ? `: ${s.matchedService}` : ""}`,
          points: 25,
        }
      : { rule: "nicheMatch", detail: "No clear service match", points: 0 },
  );

  // Stated pain point.
  c.push({
    rule: "painPoint",
    detail: s.painPoint ? "Has a clear pain point" : "No stated pain point",
    points: s.painPoint ? 20 : 0,
  });

  // Website opportunity.
  if (!s.hasWebsite) {
    const pts = s.nicheMatch || s.hasContact ? 10 : 0; // don't reward pure junk
    c.push({
      rule: "website",
      detail: pts ? "No website — possible web-build opportunity" : "No website and no other signal",
      points: pts,
    });
  } else if (s.websiteAudited && s.websiteIssues > 0) {
    c.push({
      rule: "website",
      detail: `Website has fixable issues (severity ${s.websiteIssues})`,
      points: Math.round((20 * s.websiteIssues) / 100),
    });
  } else if (s.websiteAudited) {
    c.push({ rule: "website", detail: "Website already solid (less to fix)", points: 4 });
  } else {
    c.push({ rule: "website", detail: "Website not yet audited", points: 0 });
  }

  // Active hiring / need signal.
  if (s.hiringSignal) {
    c.push({ rule: "hiring", detail: "Active hiring / need signal", points: 15 });
  }

  // Weak social presence (content/editing opportunity).
  if (s.weakSocial) {
    c.push({ rule: "weakSocial", detail: "Weak social presence — content opportunity", points: 10 });
  }

  // Reachability.
  c.push({
    rule: "contact",
    detail: s.hasContact ? "Reachable (contact on file)" : "No contact channel",
    points: s.hasContact ? 7 : 0,
  });

  // Affordability (an active business with a site/industry can likely pay).
  if (s.affordability) {
    c.push({ rule: "affordability", detail: "Affordability signal (active business)", points: 5 });
  }

  const raw = c.reduce((sum, x) => sum + x.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  const band = bandFor(score);
  const reasons = c.filter((x) => x.points !== 0).map((x) => `${x.detail} (+${x.points})`);

  return { score, band, contributions: c, reasons };
}
