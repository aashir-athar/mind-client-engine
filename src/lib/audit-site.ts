// Website auditor — network + persistence orchestration.
//
// Respects robots.txt, fetches the page (built-in fetch + descriptive User-Agent
// + timeout), runs the pure analyzer, optionally enriches with Google PageSpeed
// (only when PSI_KEY is set), and treats DNS/TLS/timeout failures as findings
// rather than crashes. Pure HTML analysis lives in audit-analyze.ts (unit-tested).
import { analyzeHtml, isAllowedByRobots } from "./audit-analyze";
import { logAudit } from "./audit";
import { config } from "./config";
import { prisma } from "./db";

export interface SiteAuditResult {
  url: string; // normalized input
  finalUrl: string; // after redirects
  fetched: boolean;
  statusCode: number | null;
  allowedByRobots: boolean;
  error: string | null;

  https: boolean;
  mobileFriendly: boolean;
  pageSizeKb: number | null;
  hasSeoBasics: boolean;
  pageSpeedScore: number | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  flags: string[];
  severity: number;
  summary: string;
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": config.USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(config.AUDIT_TIMEOUT_MS),
  });
  const text = await res.text();
  return {
    status: res.status,
    finalUrl: res.url || url,
    text,
    contentLength: res.headers.get("content-length"),
  };
}

async function fetchRobots(origin: string): Promise<string | null> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": config.USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null; // 404 / error => no robots => allowed
    const text = await res.text();
    // Some hosts answer 200 with an HTML page for a missing robots.txt; ignore those.
    if ((res.headers.get("content-type") || "").includes("html")) return null;
    return text;
  } catch {
    return null;
  }
}

/** Optional PageSpeed enrichment — only runs when PSI_KEY is configured. */
async function fetchPageSpeed(url: string): Promise<number | null> {
  if (!config.PSI_KEY) return null;
  const api = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
  const qs = new URLSearchParams({
    url,
    strategy: "mobile",
    category: "performance",
    key: config.PSI_KEY,
  });
  try {
    const res = await fetch(`${api}?${qs.toString()}`, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      lighthouseResult?: { categories?: { performance?: { score?: number } } };
    };
    const score = json.lighthouseResult?.categories?.performance?.score;
    return typeof score === "number" ? Math.round(score * 100) : null;
  } catch {
    return null;
  }
}

export async function auditSite(input: string): Promise<SiteAuditResult> {
  const url = normalizeUrl(input);
  const base: SiteAuditResult = {
    url,
    finalUrl: url,
    fetched: false,
    statusCode: null,
    allowedByRobots: true,
    error: null,
    https: url.toLowerCase().startsWith("https:"),
    mobileFriendly: false,
    pageSizeKb: null,
    hasSeoBasics: false,
    pageSpeedScore: null,
    title: null,
    metaDescription: null,
    h1Count: 0,
    flags: [],
    severity: 0,
    summary: "",
  };

  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return { ...base, error: `Invalid URL: ${input}`, summary: `Invalid URL: ${input}` };
  }

  // 1) robots.txt — respected first.
  const robotsTxt = await fetchRobots(origin);
  if (!isAllowedByRobots(`${origin}/robots.txt`, robotsTxt, url, config.USER_AGENT)) {
    return {
      ...base,
      allowedByRobots: false,
      error: "Disallowed by robots.txt",
      summary: "Disallowed by robots.txt — not fetched.",
    };
  }

  // 2) fetch the page (DNS/TLS/timeout errors become findings, not throws).
  let page;
  try {
    page = await fetchText(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, error: msg, summary: `Could not fetch site: ${msg}` };
  }

  // 3) optional PageSpeed enrichment.
  const pageSpeedScore = await fetchPageSpeed(page.finalUrl);

  // 4) analyze.
  const checks = analyzeHtml(page.text, page.finalUrl, page.contentLength, pageSpeedScore);

  return {
    url,
    finalUrl: page.finalUrl,
    fetched: true,
    statusCode: page.status,
    allowedByRobots: true,
    error: page.status >= 400 ? `HTTP ${page.status}` : null,
    https: checks.https,
    mobileFriendly: checks.mobileFriendly,
    pageSizeKb: checks.pageSizeKb,
    hasSeoBasics: checks.hasSeoBasics,
    pageSpeedScore,
    title: checks.title,
    metaDescription: checks.metaDescription,
    h1Count: checks.h1Count,
    flags: checks.flags,
    severity: checks.severity,
    summary: checks.summary,
  };
}

/** Run an audit and persist it as an AuditResult row (optionally linked to a lead). */
export async function runAndStoreAudit(input: { url: string; leadId?: string | null }) {
  const result = await auditSite(input.url);

  const row = await prisma.auditResult.create({
    data: {
      leadId: input.leadId ?? null,
      url: result.finalUrl,
      https: result.https,
      mobileFriendly: result.mobileFriendly,
      pageSizeKb: result.pageSizeKb,
      hasSeoBasics: result.hasSeoBasics,
      pageSpeedScore: result.pageSpeedScore,
      summary: result.summary,
    },
  });

  await logAudit(
    "WEBSITE_AUDIT",
    `lead=${input.leadId ?? "-"} url=${result.finalUrl} severity=${result.severity} flags=${result.flags.join(",") || "none"}`,
  );

  return { row, result };
}
