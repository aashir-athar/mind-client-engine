// Pure email-policy helpers — no I/O, fully unit-testable. The stateful engine
// (transport, suppression lookups, DRY_RUN) lives in email.ts.

export function emailDomain(email: string): string | null {
  const at = email.indexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

export function sameDomain(a: string, b: string): boolean {
  const da = emailDomain(a);
  const db = emailDomain(b);
  return !!da && da === db;
}

/**
 * Is `hour` (0–23) within the send window? Supports overnight wrap (e.g. 22→6).
 * start === end means "any time".
 */
export function withinSendWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // wraps past midnight
}

export function dailyCapReached(sentToday: number, cap: number): boolean {
  return sentToday >= cap;
}

/** Randomized human-like delay (ms) used between auto-sends to avoid burst patterns. */
export function randomDelayMs(minSec = 30, maxSec = 120): number {
  const span = Math.max(0, maxSec - minSec);
  return Math.floor((minSec + Math.random() * span) * 1000);
}

const UNSUB_FOOTER = 'Not interested? Just reply "stop" and I won\'t message you again.';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Compose plain-text + minimal-HTML bodies, each with a one-line unsubscribe footer. */
export function composeEmail(input: { body: string }): { text: string; html: string } {
  const text = `${input.body}\n\n—\n${UNSUB_FOOTER}`;
  const htmlBody = input.body.split("\n").map(escapeHtml).join("<br>");
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.5;color:#111">` +
    `${htmlBody}` +
    `<br><br><span style="color:#888;font-size:12px">${escapeHtml(UNSUB_FOOTER)}</span></div>`;
  return { text, html };
}

export { UNSUB_FOOTER };
