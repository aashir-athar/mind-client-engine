// Pure keyword + service matching used by every lead source. No I/O, so it is
// fully unit-testable. The deterministic service match here is a fast first pass;
// Phase 6 can refine it with the LLM.
import { SERVICES, type Service } from "./constants";

/** The buying-intent phrases we scan source text for. */
export const KEYWORDS = [
  "need website",
  "need app developer",
  "react native developer",
  "expo help",
  "mobile app developer",
  "website redesign",
  "need video editor",
  "need photo editor",
  "looking for designer",
  "need landing page",
  "saas founder",
  "startup mvp",
  "app bugs",
  "firebase",
  "supabase",
  "ai app not working",
  "need social media content",
] as const;

/** Return the canonical keywords found in the given text (case-insensitive). */
export function matchKeywords(text: string | null | undefined): string[] {
  if (!text) return [];
  const haystack = text.toLowerCase();
  return KEYWORDS.filter((k) => haystack.includes(k));
}

// Most-specific rules first so e.g. "fix my app" beats the generic mobile rule.
const SERVICE_RULES: { service: Service; pattern: RegExp }[] = [
  {
    service: "App Rescue / Bug Fixing",
    pattern:
      /\b(app bugs?|not working|crash(es|ing)?|broken build|production build fail|firebase|supabase|fix(ing)?\s+(my|the|our)\s+app|navigation bug|white screen|eas build fail)\b/i,
  },
  {
    service: "Crypto Tools (dashboards, trading journals, landing pages)",
    pattern: /\b(crypto|web3|trading journal|trading dashboard|defi|token launch|nft)\b/i,
  },
  {
    service: "Mobile App Development (React Native / Expo)",
    pattern:
      /\b(react native|expo|mobile app|app developer|startup mvp|build an app|ios app|android app)\b/i,
  },
  {
    service: "Video Editing",
    pattern: /\b(video edit(or|ing)?|edit(ing)?\s+(my|our)?\s*videos?|reels editing|youtube edit)\b/i,
  },
  {
    service: "Image Editing",
    pattern: /\b(photo edit(or|ing)?|image edit(or|ing)?|photoshop|retouch(ing)?|thumbnail design)\b/i,
  },
  {
    service: "Instagram / Short-form Content",
    pattern:
      /\b(instagram|reels?|short-?form|social media content|content creat(or|ion)|tiktok|ugc)\b/i,
  },
  {
    service: "Web Development",
    pattern:
      /\b(website|web ?site|landing page|web design|redesign|web dev|wordpress|next\.?js|need a site|web app)\b/i,
  },
];

/** Deterministic best-fit service for some text, or null if nothing matches. */
export function matchService(text: string | null | undefined): Service | null {
  if (!text) return null;
  for (const rule of SERVICE_RULES) {
    if (rule.pattern.test(text)) return rule.service;
  }
  return null;
}

/** Type guard for a stored matchedService string. */
export function isKnownService(s: string | null | undefined): s is Service {
  return !!s && (SERVICES as readonly string[]).includes(s);
}

/** Extract a short pain-point snippet from text if it shows buying intent. */
export function detectPainPoint(text: string | null | undefined): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const hasIntent = matchKeywords(clean).length > 0 || matchService(clean) !== null;
  if (!hasIntent) return null;
  // First sentence, capped to a reasonable length.
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}…` : firstSentence;
}
