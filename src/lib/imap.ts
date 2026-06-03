// IMAP poller — OPTIONAL. Polls INBOX for UNSEEN messages, parses each, hands it
// to recordReply (which owns all filtering/matching/idempotency), and marks it
// \Seen. Config-gated: a no-op when IMAP_* is unset, so the worker keeps running.
// Never throws into the cron tick — every error is caught + logged.
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { logAudit } from "./audit";
import { config } from "./config";
import { recordReply } from "./replies";
import type { ReplyHeaders } from "./replies-policy";

let polling = false; // in-process lock: the cron must never overlap a slow poll

export interface ImapPollResult {
  polled: boolean;
  processed: number;
  recorded: number;
  skipped: number;
  errors: number;
}

export function imapConfigured(): boolean {
  return !!(config.IMAP_HOST && config.IMAP_USER && config.IMAP_PASS);
}

function rawHeader(parsed: ParsedMail, key: string): string | null {
  const line = parsed.headerLines?.find((h) => h.key === key.toLowerCase());
  if (!line) return null;
  const idx = line.line.indexOf(":");
  return idx >= 0 ? line.line.slice(idx + 1).trim() : null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function pollImap(): Promise<ImapPollResult> {
  const result: ImapPollResult = { polled: false, processed: 0, recorded: 0, skipped: 0, errors: 0 };
  if (!imapConfigured() || polling) return result;
  polling = true;

  try {
    const client = new ImapFlow({
      host: config.IMAP_HOST!,
      port: config.IMAP_PORT,
      secure: config.IMAP_SECURE,
      auth: { user: config.IMAP_USER!, pass: config.IMAP_PASS! },
      logger: false,
      connectionTimeout: 90_000,
      socketTimeout: 300_000,
    });

    let connError: Error | undefined;
    client.on("error", (err: Error) => {
      connError = err;
    });

    try {
      await client.connect();
    } catch (err) {
      const e = err as Error & { authenticationFailed?: boolean };
      await logAudit(
        e.authenticationFailed ? "IMAP_AUTH_FAILED" : "IMAP_CONNECT_FAILED",
        `${config.IMAP_USER}: ${e.message}`,
      );
      result.errors++;
      return result;
    }
    result.polled = true;

    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      if (uids && uids.length) {
        // fetchAll buffers up front so it's safe to messageFlagsAdd afterwards
        // (issuing commands inside a fetch stream deadlocks the connection).
        const messages = await client.fetchAll(uids, { uid: true, source: true, envelope: true }, { uid: true });
        for (const msg of messages) {
          try {
            const parsed = await simpleParser(msg.source as Buffer);
            const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase() ?? null;
            const subject = parsed.subject ?? "";
            const messageId = (parsed.messageId ?? "").replace(/^<|>$/g, "").trim() || null;
            let body = parsed.text ?? "";
            if (!body && parsed.html) body = htmlToText(parsed.html);

            const headers: ReplyHeaders = {
              autoSubmitted: rawHeader(parsed, "auto-submitted"),
              precedence: rawHeader(parsed, "precedence"),
              returnPath: rawHeader(parsed, "return-path"),
            };
            const providerId = messageId ?? `synth:${msg.uid}:${(parsed.date ?? new Date()).toISOString()}`;

            if (fromEmail) {
              const r = await recordReply({
                fromEmail,
                subject,
                body,
                providerId,
                receivedAt: parsed.date ?? undefined,
                headers,
              });
              if (r.recorded) result.recorded++;
              else result.skipped++;
            } else {
              result.skipped++;
            }
            result.processed++;
          } catch {
            await logAudit("IMAP_PARSE_FAILED", `uid=${msg.uid}`);
            result.errors++;
          } finally {
            // Mark \Seen regardless so an unparseable/duplicate message isn't re-fetched forever.
            try {
              await client.messageFlagsAdd(String(msg.uid), ["\\Seen"], { uid: true });
            } catch {
              /* flag write failed — providerId dedupe still prevents double-record */
            }
          }
        }
      }
    } finally {
      lock.release();
    }

    try {
      await client.logout();
    } catch {
      client.close();
    }
    if (connError) {
      await logAudit("IMAP_SESSION_ERROR", connError.message);
      result.errors++;
    }
    return result;
  } finally {
    polling = false;
  }
}
