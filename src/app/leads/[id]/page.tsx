import Link from "next/link";
import { notFound } from "next/navigation";
import { LEAD_STATUSES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate, fmtDateTime, fmtRelative, money } from "@/lib/format";
import { bandClass, statusClass } from "@/lib/ui";
import { CHANNELS } from "@/lib/constants";
import { suggestChannel } from "@/lib/outreach";
import { deriveSignals, scoreLead } from "@/lib/scoring";
import {
  auditLeadWebsite,
  generateOutreachAction,
  logReply,
  rescoreLead,
  suppressLead,
  updateLeadNotes,
  updateLeadStatus,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { messages: true, followUps: true, audits: true },
  });
  if (!lead) notFound();

  const latestAudit = lead.audits.length
    ? [...lead.audits].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    : null;

  // Live, explainable score computed from current data (deterministic, no LLM).
  // The header shows the STORED score; "Rescore" persists this computed one.
  const explained = scoreLead(deriveSignals(lead, latestAudit));

  const drafts = lead.messages.filter((m) => m.status === "DRAFT");
  const suggestedChannel = suggestChannel(lead);

  // Merge every related record into one reverse-chronological timeline.
  const timeline = [
    ...lead.messages.map((m) => ({
      ts: (m.sentAt ?? m.createdAt).getTime(),
      date: m.sentAt ?? m.createdAt,
      label: `${m.direction === "IN" ? "Inbound" : "Outbound"} ${m.channel} · ${m.status}${
        m.sequenceStep ? ` · step ${m.sequenceStep}` : ""
      }`,
      body: `${m.subject ? `Subject: ${m.subject}\n` : ""}${m.body}`,
    })),
    ...lead.followUps.map((f) => ({
      ts: f.dueAt.getTime(),
      date: f.dueAt,
      label: `Follow-up · ${f.channel} · step ${f.sequenceStep} · ${f.status}`,
      body: f.status === "PENDING" ? `Scheduled for ${fmtDate(f.dueAt)}` : f.status,
    })),
    ...lead.audits.map((a) => ({
      ts: a.createdAt.getTime(),
      date: a.createdAt,
      label: "Website audit",
      body:
        `${a.url}\n` +
        `HTTPS: ${a.https ? "yes" : "no"} · Mobile-friendly: ${a.mobileFriendly ? "yes" : "no"} · ` +
        `SEO basics: ${a.hasSeoBasics ? "yes" : "no"}` +
        `${a.pageSizeKb != null ? ` · ${a.pageSizeKb} KB` : ""}` +
        `${a.pageSpeedScore != null ? ` · PageSpeed ${a.pageSpeedScore}` : ""}\n${a.summary}`,
    })),
  ].sort((a, b) => b.ts - a.ts);

  return (
    <>
      <div className="breadcrumb">
        <Link href="/leads">← Leads</Link>
      </div>

      <div className="row-actions" style={{ marginBottom: 18 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {lead.businessName}
        </h1>
        <span className={bandClass(lead.scoreBand)}>{lead.scoreBand}</span>
        <span className={statusClass(lead.status)}>{lead.status}</span>
        <span className="muted">score {lead.score}</span>
      </div>

      <div className="detail-grid">
        {/* LEFT: contact + timeline */}
        <div>
          <div className="section">
            <h3>Contact</h3>
            <dl className="kv">
              <dt>Contact</dt>
              <dd>{lead.contactName ?? "—"}</dd>
              <dt>Website</dt>
              <dd>
                {lead.website ? (
                  <a href={lead.website} target="_blank" rel="noreferrer">
                    {lead.website}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Email</dt>
              <dd>{lead.email ?? "—"}</dd>
              <dt>Instagram</dt>
              <dd>{lead.instagram ?? "—"}</dd>
              <dt>LinkedIn</dt>
              <dd>{lead.linkedin ?? "—"}</dd>
              <dt>Twitter / X</dt>
              <dd>{lead.twitter ?? "—"}</dd>
              <dt>WhatsApp</dt>
              <dd>{lead.whatsapp ?? "—"}</dd>
              <dt>Location</dt>
              <dd>{lead.location ?? "—"}</dd>
              <dt>Industry</dt>
              <dd>{lead.industry ?? "—"}</dd>
              <dt>Source</dt>
              <dd>
                {lead.sourceType ?? "—"}
                {lead.sourceUrl ? (
                  <>
                    {" · "}
                    <a href={lead.sourceUrl} target="_blank" rel="noreferrer">
                      link
                    </a>
                  </>
                ) : null}
              </dd>
              <dt>Discovered</dt>
              <dd>{fmtDateTime(lead.discoveredAt)}</dd>
            </dl>
          </div>

          <div className="section">
            <h3>Timeline</h3>
            {timeline.length === 0 ? (
              <p className="muted">No messages, follow-ups, or audits yet.</p>
            ) : (
              <ul className="timeline">
                {timeline.map((t, i) => (
                  <li key={i}>
                    <div className="t-meta">
                      {t.label} · {fmtDateTime(t.date)} ({fmtRelative(t.date)})
                    </div>
                    <div className="t-body">{t.body}</div>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
              Approve &amp; send + AI assistant actions arrive in Phases 7–9.
            </p>
          </div>

          <div className="section">
            <h3>Outreach</h3>
            <form action={generateOutreachAction} className="row-actions" style={{ marginBottom: 12 }}>
              <input type="hidden" name="id" value={lead.id} />
              <select name="channel" defaultValue={suggestedChannel}>
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
              <button className="btn" type="submit">
                Generate draft
              </button>
            </form>
            {drafts.length === 0 ? (
              <p className="muted">No drafts yet. Generate one to add it to the Outreach Queue.</p>
            ) : (
              <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {drafts.map((m) => (
                  <li key={m.id} className="t-body">
                    <div className="t-meta">
                      {m.channel}
                      {m.subject ? ` · ${m.subject}` : ""} · DRAFT
                    </div>
                    {m.body}
                  </li>
                ))}
              </ul>
            )}
            <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              Every channel is a draft you approve. Email becomes auto-sendable (under caps) in Phase 7.
            </p>
          </div>
        </div>

        {/* RIGHT: qualification + editors */}
        <div>
          <div className="section">
            <h3>Qualification</h3>
            <dl className="kv">
              <dt>Matched service</dt>
              <dd>{lead.matchedService ?? "—"}</dd>
              <dt>Pain point</dt>
              <dd>{lead.painPoint ?? "—"}</dd>
              <dt>Replies</dt>
              <dd>{lead.repliesCount}</dd>
              <dt>Won value</dt>
              <dd>{money(lead.wonValue)}</dd>
              <dt>Last contacted</dt>
              <dd>{lead.lastContactedAt ? fmtDate(lead.lastContactedAt) : "—"}</dd>
              <dt>Next follow-up</dt>
              <dd>{lead.nextFollowUpAt ? fmtDate(lead.nextFollowUpAt) : "—"}</dd>
            </dl>
          </div>

          <div className="section">
            <h3>Score breakdown</h3>
            <div className="row-actions" style={{ marginBottom: 10 }}>
              <span className={bandClass(explained.band)}>{explained.band}</span>
              <strong style={{ fontSize: 18 }}>{explained.score}/100</strong>
              <span className="muted">
                stored: {lead.score} ({lead.scoreBand})
              </span>
            </div>
            <table>
              <tbody>
                {explained.contributions.map((c) => (
                  <tr key={c.rule}>
                    <td>{c.detail}</td>
                    <td className="num" style={{ color: c.points > 0 ? "var(--green)" : "var(--muted)" }}>
                      {c.points > 0 ? `+${c.points}` : c.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={rescoreLead} style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={lead.id} />
              <button className="btn" type="submit">
                Rescore &amp; save
              </button>
            </form>
            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
              Rules are deterministic; an LLM tie-break only nudges scores near a band edge (skipped if Ollama is offline).
            </p>
          </div>

          <div className="section">
            <h3>Website audit</h3>
            {latestAudit ? (
              <dl className="kv">
                <dt>HTTPS</dt>
                <dd>{latestAudit.https ? "yes" : "no"}</dd>
                <dt>Mobile-friendly</dt>
                <dd>{latestAudit.mobileFriendly ? "yes" : "no"}</dd>
                <dt>SEO basics</dt>
                <dd>{latestAudit.hasSeoBasics ? "yes" : "no"}</dd>
                <dt>Page size</dt>
                <dd>{latestAudit.pageSizeKb != null ? `${latestAudit.pageSizeKb} KB` : "—"}</dd>
                <dt>PageSpeed</dt>
                <dd>{latestAudit.pageSpeedScore != null ? `${latestAudit.pageSpeedScore}/100` : "—"}</dd>
                <dt>Summary</dt>
                <dd>{latestAudit.summary}</dd>
              </dl>
            ) : (
              <p className="muted">No audit run yet.</p>
            )}
            {lead.website ? (
              <form action={auditLeadWebsite} style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={lead.id} />
                <button className="btn" type="submit">
                  Run website audit
                </button>
              </form>
            ) : (
              <p className="muted" style={{ marginTop: 12 }}>
                Add a website to enable auditing.
              </p>
            )}
          </div>

          <div className="section">
            <h3>Status</h3>
            <form action={updateLeadStatus} className="row-actions">
              <input type="hidden" name="id" value={lead.id} />
              <select name="status" defaultValue={lead.status}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button className="btn" type="submit">
                Update
              </button>
            </form>
            <form action={suppressLead} style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={lead.id} />
              <button className="btn btn-ghost" type="submit">
                Mark not interested (suppress)
              </button>
            </form>
          </div>

          <div className="section">
            <h3>Notes</h3>
            <form action={updateLeadNotes} className="stack">
              <input type="hidden" name="id" value={lead.id} />
              <textarea name="notes" defaultValue={lead.notes ?? ""} placeholder="Private notes…" />
              <div>
                <button className="btn" type="submit">
                  Save notes
                </button>
              </div>
            </form>
          </div>

          <div className="section">
            <h3>Log a reply</h3>
            <form action={logReply} className="stack">
              <input type="hidden" name="id" value={lead.id} />
              <textarea name="body" placeholder="Paste the lead's reply…" />
              <div>
                <button className="btn" type="submit">
                  Log reply
                </button>
              </div>
            </form>
            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
              Sets the lead to REPLIED and cancels pending follow-ups. A "stop" / "unsubscribe"
              reply also suppresses the address.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
