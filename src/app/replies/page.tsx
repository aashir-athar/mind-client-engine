import Link from "next/link";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { fmtDateTime, fmtRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RepliesPage() {
  const imapOn = !!(config.IMAP_HOST && config.IMAP_USER && config.IMAP_PASS);

  const replies = await prisma.message.findMany({
    where: { direction: "IN" },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    include: { lead: true },
    take: 100,
  });

  return (
    <>
      <h1 className="page-title">Replies</h1>
      <p className="page-sub">Inbound replies. A reply stops that lead's follow-up sequence.</p>

      <div
        className="section"
        style={{ borderColor: imapOn ? "var(--green)" : "var(--border)", marginBottom: 16 }}
      >
        <strong style={{ color: imapOn ? "var(--green)" : "var(--muted)" }}>
          {imapOn ? "IMAP polling is ON" : "IMAP polling is OFF"}
        </strong>
        <div className="muted" style={{ marginTop: 4 }}>
          {imapOn
            ? `The worker checks ${config.IMAP_USER} every ${config.IMAP_POLL_MINUTES} min and auto-logs replies.`
            : "Set IMAP_* in .env.local to auto-detect replies, or log them manually from a lead's “Log a reply”."}
        </div>
      </div>

      {replies.length === 0 ? (
        <div className="section">
          <p className="muted">No replies recorded yet.</p>
        </div>
      ) : (
        <div className="stack">
          {replies.map((m) => (
            <div className="section" key={m.id}>
              <div className="row-actions" style={{ marginBottom: 8 }}>
                <Link href={`/leads/${m.leadId}`}>
                  <strong>{m.lead.businessName}</strong>
                </Link>
                <span className={`pill status-${m.lead.status}`}>{m.lead.status}</span>
                {m.lead.email && <span className="muted">{m.lead.email}</span>}
                <span className="muted">{fmtRelative(m.sentAt ?? m.createdAt)}</span>
              </div>
              {m.subject && (
                <div style={{ marginBottom: 6 }}>
                  <span className="muted">Subject: </span>
                  {m.subject}
                </div>
              )}
              <div className="t-body">{m.body}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                {fmtDateTime(m.sentAt ?? m.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
