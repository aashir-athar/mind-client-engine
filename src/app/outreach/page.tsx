import Link from "next/link";
import { config, DRY_RUN } from "@/lib/config";
import { prisma } from "@/lib/db";
import { fmtRelative } from "@/lib/format";
import { approveMessage, discardMessage, editMessage, sendMessage } from "./actions";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const messages = await prisma.message.findMany({
    where: { direction: "OUT", status: { in: ["DRAFT", "APPROVED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { lead: true },
  });

  return (
    <>
      <h1 className="page-title">Outreach Queue</h1>
      <p className="page-sub">
        Approve, edit, and send drafts. {messages.length} in the queue.
      </p>

      <div
        className="section"
        style={{ borderColor: DRY_RUN ? "var(--green)" : "var(--red)", marginBottom: 16 }}
      >
        <strong style={{ color: DRY_RUN ? "var(--green)" : "var(--red)" }}>
          {DRY_RUN ? "DRY_RUN is ON" : "LIVE SENDING ENABLED"}
        </strong>
        <div className="muted" style={{ marginTop: 4 }}>
          {DRY_RUN
            ? "Email sends are simulated (logged + audited) — nothing leaves your machine. Set DRY_RUN=false to send for real."
            : "Emails will actually be sent via SMTP."}{" "}
          Daily cap: {config.EMAIL_DAILY_CAP}. Send window: {config.SEND_WINDOW_START}:00–
          {config.SEND_WINDOW_END}:00. Suppressed addresses are never contacted.
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="section">
          <p className="muted">
            Queue is empty. Open a lead and click <strong>Generate draft</strong>.
          </p>
        </div>
      ) : (
        <div className="stack">
          {messages.map((m) => (
            <div className="section" key={m.id}>
              <div className="row-actions" style={{ marginBottom: 10 }}>
                <span className="pill">{m.channel}</span>
                <Link href={`/leads/${m.leadId}`}>
                  <strong>{m.lead.businessName}</strong>
                </Link>
                <span className={`pill status-${m.status}`}>{m.status}</span>
                {m.channel === "EMAIL" && !m.lead.email && (
                  <span className="pill" style={{ color: "var(--red)" }}>
                    no email
                  </span>
                )}
                <span className="muted">{fmtRelative(m.createdAt)}</span>
              </div>

              <form action={editMessage} className="stack">
                <input type="hidden" name="id" value={m.id} />
                {m.channel === "EMAIL" && (
                  <input type="text" name="subject" defaultValue={m.subject ?? ""} placeholder="Subject" />
                )}
                <textarea name="body" defaultValue={m.body} style={{ minHeight: 110 }} />
                <div>
                  <button className="btn btn-ghost" type="submit">
                    Save edits
                  </button>
                </div>
              </form>

              <div className="row-actions" style={{ marginTop: 12 }}>
                {m.status === "DRAFT" && (
                  <form action={approveMessage}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="btn btn-ghost" type="submit">
                      Approve
                    </button>
                  </form>
                )}
                <form action={sendMessage}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="btn" type="submit">
                    {m.channel === "EMAIL" ? (DRY_RUN ? "Send (DRY_RUN)" : "Send") : "Mark sent"}
                  </button>
                </form>
                <form action={discardMessage}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="btn btn-ghost" type="submit">
                    Discard
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
