// Pure outreach templates — per-service copy assembled per-channel. These are
// BOTH the deterministic fallback (when the LLM is offline) and the seed draft
// the LLM personalizes. No I/O, so fully unit-testable. Short, specific,
// non-spammy, with exactly one soft free-value offer.
import type { Channel } from "../constants";

export interface OutreachContext {
  businessName: string;
  contactName?: string | null;
  painPoint?: string | null;
  matchedService?: string | null;
  auditSummary?: string | null;
  channel: Channel;
  /** When true, phrase it as a follow-up to a previous message. */
  followUp?: boolean;
}

export interface TemplateDraft {
  subject?: string; // email only
  body: string;
}

interface ServiceCopy {
  pitch: string; // full sentence (email)
  pitchShort: string; // compact (DM)
  offer: string; // the one-line free value offer
}

const SERVICE_COPY: Record<string, ServiceCopy> = {
  "Web Development": {
    pitch: "I design and build fast, modern websites that turn visitors into customers.",
    pitchShort: "I build fast, modern websites.",
    offer: "a free 5-point audit of your current site",
  },
  "Mobile App Development (React Native / Expo)": {
    pitch: "I build polished cross-platform apps with React Native / Expo, fast.",
    pitchShort: "I build React Native / Expo apps.",
    offer: "a free scoping call and a fixed quote",
  },
  "App Rescue / Bug Fixing": {
    pitch:
      "I rescue React Native / Expo apps — build failures, crashes, Firebase/Supabase issues, and navigation bugs.",
    pitchShort: "I fix broken React Native / Expo apps.",
    offer: "a free look at your build logs",
  },
  "Crypto Tools (dashboards, trading journals, landing pages)": {
    pitch: "I build crypto dashboards, trading journals, and high-converting landing pages.",
    pitchShort: "I build crypto dashboards and landing pages.",
    offer: "a free mockup of your dashboard idea",
  },
  "Video Editing": {
    pitch: "I edit short-form videos and reels that keep people watching to the end.",
    pitchShort: "I edit punchy short-form videos.",
    offer: "one free sample edit",
  },
  "Image Editing": {
    pitch: "I do clean product photo edits, retouching, and scroll-stopping thumbnails.",
    pitchShort: "I do clean photo edits and thumbnails.",
    offer: "two free sample edits",
  },
  "Instagram / Short-form Content": {
    pitch: "I create short-form content and reels that actually grow engagement.",
    pitchShort: "I make reels that grow engagement.",
    offer: "a free 3-reel content plan",
  },
};

const GENERIC: ServiceCopy = {
  pitch: "I help small businesses and founders ship better web, app, and content work.",
  pitchShort: "I help with web, apps, and content.",
  offer: "a free quick audit",
};

function copyFor(service?: string | null): ServiceCopy {
  return (service && SERVICE_COPY[service]) || GENERIC;
}

function hook(ctx: OutreachContext): string {
  const name = ctx.businessName;
  const isWeb = /web|site/i.test(ctx.matchedService ?? "");
  if (ctx.auditSummary && isWeb) {
    return `a quick look at ${name}'s site showed ${ctx.auditSummary.replace(/\.$/, "")}`;
  }
  if (ctx.painPoint) {
    return `I saw ${name} might be dealing with: ${ctx.painPoint.replace(/\.$/, "")}`;
  }
  return `I came across ${name} and had an idea`;
}

/** The free-value offer for a lead's matched service (used by the queue UI too). */
export function offerFor(service?: string | null): string {
  return copyFor(service).offer;
}

export function buildTemplateDraft(ctx: OutreachContext): TemplateDraft {
  const c = copyFor(ctx.matchedService);
  const greetName = ctx.contactName?.trim() || "there";

  // Follow-up phrasing: brief, references the earlier message.
  if (ctx.followUp) {
    if (ctx.channel === "EMAIL") {
      return {
        subject: `Following up — ${ctx.businessName}`,
        body:
          `Hi ${greetName},\n\n` +
          `Just following up on my last note. ${c.pitchShort} ` +
          `Still happy to send over ${c.offer} if useful — worth a quick chat?\n\n` +
          `Best,`,
      };
    }
    return {
      body:
        `Hi ${greetName}! Following up on my last message — still happy to share ${c.offer} ` +
        `if useful. Worth a quick chat?`,
    };
  }

  const h = hook(ctx);

  if (ctx.channel === "EMAIL") {
    const subject = `Quick idea for ${ctx.businessName}`;
    const body =
      `Hi ${greetName},\n\n` +
      `${capitalize(h)}. ${c.pitch}\n\n` +
      `I'd be glad to send over ${c.offer} — no obligation. Want me to?\n\n` +
      `Best,`;
    return { subject, body };
  }

  // Direct-message channels: shorter, no subject.
  const body = `Hi ${greetName}! ${capitalize(h)}. ${c.pitchShort} Happy to share ${c.offer} if useful — interested?`;
  return { body };
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

interface ChannelLeadLike {
  email?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  whatsapp?: string | null;
  twitter?: string | null;
  sourceType?: string | null;
}

/** Best channel for a lead, by which contact info is available. */
export function suggestChannel(lead: ChannelLeadLike): Channel {
  if (lead.email) return "EMAIL";
  if (lead.instagram) return "INSTAGRAM";
  if (lead.linkedin) return "LINKEDIN";
  if (lead.whatsapp) return "WHATSAPP";
  if (lead.twitter) return "TWITTER";
  if (lead.sourceType === "REDDIT") return "REDDIT";
  return "EMAIL";
}
