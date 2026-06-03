// Pure website-audit analysis — NO network, NO env, NO DB. Everything here is a
// deterministic function of its inputs, which keeps the unit tests hermetic.
// The network/persistence orchestration lives in audit-site.ts.
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";

/** Machine-readable issues used by scoring (Phase 4) and outreach (Phase 6). */
export const AUDIT_FLAGS = [
  "NO_HTTPS",
  "NOT_MOBILE_FRIENDLY",
  "NO_TITLE",
  "NO_META_DESCRIPTION",
  "NO_H1",
  "LARGE_PAGE",
] as const;
export type AuditFlag = (typeof AUDIT_FLAGS)[number];

// Higher weight = bigger problem = bigger sales opportunity.
const FLAG_WEIGHTS: Record<AuditFlag, number> = {
  NO_HTTPS: 25,
  NOT_MOBILE_FRIENDLY: 25,
  NO_TITLE: 15,
  NO_META_DESCRIPTION: 15,
  NO_H1: 10,
  LARGE_PAGE: 10,
};

const FLAG_PHRASES: Record<AuditFlag, string> = {
  NO_HTTPS: "no HTTPS",
  NOT_MOBILE_FRIENDLY: "not mobile-friendly (missing viewport)",
  NO_TITLE: "missing <title>",
  NO_META_DESCRIPTION: "no meta description",
  NO_H1: "no H1 heading",
  LARGE_PAGE: "heavy page (>2 MB)",
};

const LARGE_PAGE_KB = 2048;

export interface SiteChecks {
  https: boolean;
  mobileFriendly: boolean;
  pageSizeKb: number;
  hasSeoBasics: boolean;
  // richer detail for outreach personalization
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  ogTitle: string | null;
  ogImage: string | null;
  viewport: string | null;
  flags: AuditFlag[];
  severity: number; // 0–100 (sum of flag weights, capped)
  summary: string;
}

/** 0–100 opportunity severity from the detected flags. */
export function computeSeverity(flags: AuditFlag[]): number {
  const total = flags.reduce((sum, f) => sum + (FLAG_WEIGHTS[f] ?? 0), 0);
  return Math.min(100, total);
}

function buildSummary(flags: AuditFlag[], pageSpeedScore: number | null): string {
  const speed =
    pageSpeedScore != null ? ` PageSpeed (mobile): ${pageSpeedScore}/100.` : "";
  if (flags.length === 0) {
    return `Healthy: HTTPS, mobile-friendly, and SEO basics present.${speed}`;
  }
  const phrases = flags.map((f) => FLAG_PHRASES[f]);
  return `Issues: ${phrases.join("; ")}.${speed}`;
}

/**
 * Analyze a fetched HTML document. `finalUrl` must be the URL AFTER redirects so
 * the HTTPS check reflects what visitors actually land on. `contentLengthHeader`
 * is the transfer size if the server sent one (we fall back to the decoded body).
 */
export function analyzeHtml(
  html: string,
  finalUrl: string,
  contentLengthHeader?: string | null,
  pageSpeedScore: number | null = null,
): SiteChecks {
  const $ = cheerio.load(html);

  let https = false;
  try {
    https = new URL(finalUrl).protocol === "https:";
  } catch {
    https = false;
  }

  const viewport = $('meta[name="viewport"]').attr("content")?.trim() || null;
  const mobileFriendly = !!viewport && /width\s*=\s*device-width/i.test(viewport);

  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const h1Count = $("h1").length;
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim() || null;

  const headerKb = contentLengthHeader ? Math.round(Number(contentLengthHeader) / 1024) : null;
  const decodedKb = Math.round(Buffer.byteLength(html, "utf8") / 1024);
  const pageSizeKb = headerKb && headerKb > 0 ? headerKb : decodedKb;

  const hasSeoBasics = !!title && !!metaDescription;

  const flags: AuditFlag[] = [];
  if (!https) flags.push("NO_HTTPS");
  if (!mobileFriendly) flags.push("NOT_MOBILE_FRIENDLY");
  if (!title) flags.push("NO_TITLE");
  if (!metaDescription) flags.push("NO_META_DESCRIPTION");
  if (h1Count === 0) flags.push("NO_H1");
  if (pageSizeKb > LARGE_PAGE_KB) flags.push("LARGE_PAGE");

  return {
    https,
    mobileFriendly,
    pageSizeKb,
    hasSeoBasics,
    title,
    metaDescription,
    h1Count,
    ogTitle,
    ogImage,
    viewport,
    flags,
    severity: computeSeverity(flags),
    summary: buildSummary(flags, pageSpeedScore),
  };
}

/**
 * robots.txt decision. No robots.txt (null/empty) => allowed. robots-parser
 * returns true | false | undefined; undefined (no matching rule) => allowed.
 */
export function isAllowedByRobots(
  robotsUrl: string,
  robotsTxt: string | null,
  url: string,
  userAgent: string,
): boolean {
  if (!robotsTxt) return true;
  const robots = robotsParser(robotsUrl, robotsTxt);
  return robots.isAllowed(url, userAgent) !== false;
}
