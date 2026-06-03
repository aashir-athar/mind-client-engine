// Email engine (Phase 7). Nodemailer over SMTP from env, with HARD safety rails:
//   - suppression list (never contact suppressed addresses/domains)
//   - daily send cap
//   - send window (skippable for human-approved manual sends)
//   - plain-text + minimal-HTML body with a one-line unsubscribe footer
//   - DRY_RUN (default): nothing leaves the machine — the send is logged + audited
//     and treated as sent so the rest of the pipeline can be exercised safely.
import nodemailer, { type Transporter } from "nodemailer";
import { logAudit } from "./audit";
import { config, DRY_RUN } from "./config";
import { prisma } from "./db";
import { composeEmail, dailyCapReached, withinSendWindow } from "./email-policy";
import { isSuppressed } from "./suppression";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!config.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
  return transporter;
}

/** Count of emails actually marked SENT today (used for the daily cap). */
async function dailySentCount(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.message.count({
    where: { channel: "EMAIL", direction: "OUT", status: "SENT", sentAt: { gte: start } },
  });
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  /** Human-approved manual sends may bypass the send-window guard. */
  ignoreWindow?: boolean;
}

export interface SendEmailResult {
  sent: boolean;
  dryRun: boolean;
  reason?: string;
  /** true only for cap/window — the message should stay queued, not failed. */
  retryable?: boolean;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim();
  if (!to) return { sent: false, dryRun: DRY_RUN, reason: "no recipient" };

  // 1) Suppression — never contact a suppressed address/domain.
  if (await isSuppressed(to)) {
    await logAudit("EMAIL_SUPPRESSED", `to=${to}`, DRY_RUN);
    return { sent: false, dryRun: DRY_RUN, reason: "suppressed" };
  }

  // 2) Hard daily cap.
  if (dailyCapReached(await dailySentCount(), config.EMAIL_DAILY_CAP)) {
    await logAudit("EMAIL_CAP_REACHED", `to=${to} cap=${config.EMAIL_DAILY_CAP}`, DRY_RUN);
    return { sent: false, dryRun: DRY_RUN, reason: "daily cap reached", retryable: true };
  }

  // 3) Send window — gates REAL sends only (a human-approved manual send, or
  // DRY_RUN simulation, bypasses it so the safe end-to-end flow is time-independent).
  if (!input.ignoreWindow && !DRY_RUN) {
    const hour = new Date().getHours();
    if (!withinSendWindow(hour, config.SEND_WINDOW_START, config.SEND_WINDOW_END)) {
      return { sent: false, dryRun: DRY_RUN, reason: "outside send window", retryable: true };
    }
  }

  const { text, html } = composeEmail({ body: input.body });

  // 4) DRY_RUN — log + audit, do NOT send, but treat as sent.
  if (DRY_RUN) {
    console.log(`[DRY_RUN] EMAIL → ${to} | ${input.subject}\n${text}\n`);
    await logAudit("EMAIL_DRY_RUN_SEND", `to=${to} subject=${input.subject}`, true);
    return { sent: true, dryRun: true };
  }

  // 5) Real send.
  const tx = getTransporter();
  if (!tx) return { sent: false, dryRun: false, reason: "SMTP not configured" };
  const from = config.SMTP_FROM || config.SMTP_USER || "";
  try {
    await tx.sendMail({
      from,
      to,
      subject: input.subject,
      text,
      html,
      headers: { "List-Unsubscribe": `<mailto:${from}?subject=unsubscribe>` },
    });
    await logAudit("EMAIL_SENT", `to=${to} subject=${input.subject}`, false);
    return { sent: true, dryRun: false };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await logAudit("EMAIL_FAILED", `to=${to} err=${reason}`, false);
    return { sent: false, dryRun: false, reason };
  }
}
