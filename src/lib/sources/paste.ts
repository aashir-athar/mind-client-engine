// Paste-&-Enrich (pure). For ToS-restricted platforms (LinkedIn/Instagram/X/
// Upwork) we NEVER scrape — the user pastes a URL and/or text, and we parse it
// into a lead. Network-free, so it is unit-testable.
import { detectPainPoint } from "../keywords";
import type { DiscoveredLead } from "./types";

type SocialField = "instagram" | "linkedin" | "twitter";

interface Platform {
  platform: string;
  field?: SocialField;
  handle?: string;
}

function detectPlatform(url: string): Platform | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const seg = u.pathname.split("/").filter(Boolean);
    if (host.includes("instagram.com")) {
      return { platform: "Instagram", field: "instagram", handle: seg[0] ? `@${seg[0]}` : undefined };
    }
    if (host.includes("linkedin.com")) {
      return { platform: "LinkedIn", field: "linkedin", handle: seg[1] ?? seg[0] };
    }
    if (host.includes("twitter.com") || host.includes("x.com")) {
      return { platform: "X", field: "twitter", handle: seg[0] ? `@${seg[0]}` : undefined };
    }
    if (host.includes("upwork.com")) {
      return { platform: "Upwork", handle: seg[seg.length - 1] };
    }
    return { platform: host };
  } catch {
    return null;
  }
}

export function parsePasted(input: {
  url?: string | null;
  text?: string | null;
}): DiscoveredLead | { error: string } {
  const url = (input.url ?? "").trim();
  const text = (input.text ?? "").trim();
  if (!url && !text) return { error: "Provide a URL or some text to enrich." };

  const platform = url ? detectPlatform(url) : null;
  const rawText = [text, url].filter(Boolean).join(" ");

  const firstLine = text.split("\n").map((s) => s.trim()).find(Boolean);
  const businessName =
    (firstLine ? firstLine.slice(0, 90) : "") ||
    platform?.handle ||
    platform?.platform ||
    "Pasted lead";

  const lead: DiscoveredLead = {
    businessName,
    sourceType: "PASTE",
    sourceUrl: url || null,
    painPoint: detectPainPoint(rawText) ?? (text ? text.slice(0, 160) : null),
    rawText,
  };

  if (url && platform?.field) {
    // Instagram keeps the @handle; LinkedIn/X keep the full URL.
    lead[platform.field] =
      platform.field === "instagram" ? platform.handle ?? url : url;
  }

  return lead;
}
