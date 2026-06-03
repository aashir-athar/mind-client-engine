// Pure reply-classification helpers — no I/O, unit-tested. Used by both the IMAP
// poller and the manual "log reply" action.
import { UNSUB_FOOTER } from "./email-policy";

const OPT_OUT_RE =
  /\b(unsubscribe|opt[-\s]?out|stop|not interested|no thanks|remove me|do not contact|take me off|leave me alone)\b/i;

// Auto-replies / bounces / no-reply senders that are NOT real human replies.
const AUTO_SUBJECT_RE =
  /^(re:\s*)?(out of office|automatic reply|auto[-\s]?reply|autoreply|vacation|undeliverable|delivery status notification|mail delivery failed|returned mail|abwesenheit|automatische antwort)/i;
const AUTO_SENDER_RE = /(mailer-daemon|no-?reply|do-?not-?reply|postmaster|notifications?)@/i;

// Free-mail domains — never use a domain fallback to match these (too ambiguous).
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "yandex.com",
]);

export interface ReplyHeaders {
  autoSubmitted?: string | null;
  precedence?: string | null;
  returnPath?: string | null;
}

/** Normalize an email address for matching/storage. */
export function cleanAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const v = addr.trim().toLowerCase();
  return v || null;
}

export function isFreeMailDomain(domain: string | null | undefined): boolean {
  return !!domain && FREE_MAIL_DOMAINS.has(domain.toLowerCase());
}

/** Mailer-daemon / postmaster bounce sender. */
export function isBounceSender(fromAddress: string): boolean {
  return /(mailer-daemon|postmaster)@/i.test(fromAddress);
}

/** Is this an automated message (out-of-office, bounce, no-reply) rather than a human reply? */
export function isLikelyAutomated(
  fromAddress: string,
  subject: string | null | undefined,
  headers?: ReplyHeaders,
): boolean {
  if (AUTO_SENDER_RE.test(fromAddress)) return true;
  if (subject && AUTO_SUBJECT_RE.test(subject)) return true;
  if (headers) {
    if (headers.autoSubmitted && /auto-(replied|generated|notified)/i.test(headers.autoSubmitted)) {
      return true;
    }
    if (headers.precedence && /(auto_reply|bulk|junk|list)/i.test(headers.precedence)) return true;
    if (headers.returnPath != null && headers.returnPath.trim() === "<>") return true;
  }
  return false;
}

/**
 * Remove quoted history and our own unsubscribe footer BEFORE the opt-out scan —
 * otherwise a quoted footer (which contains the word "stop") would self-trigger
 * opt-out on every threaded reply.
 */
export function stripQuotedAndFooter(body: string | null | undefined): string {
  if (!body) return "";
  let text = body;
  const markers = [
    /^-{2,}\s*Original Message\s*-{2,}/im,
    /^On .+wrote:\s*$/im,
    /^From:\s.+$/im,
    /^_{5,}\s*$/m,
  ];
  for (const re of markers) {
    const m = text.match(re);
    if (m && m.index !== undefined) text = text.slice(0, m.index);
  }
  text = text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
  text = text.split(UNSUB_FOOTER).join(" ");
  return text.trim();
}

/** Does the (already cleaned) reply text indicate the person wants to be left alone? */
export function isOptOut(body: string | null | undefined): boolean {
  return !!body && OPT_OUT_RE.test(body);
}
