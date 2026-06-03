import Link from "next/link";
import {
  LEAD_STATUSES,
  SCORE_BANDS,
  SERVICES,
  SOURCE_TYPES,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate, fmtRelative } from "@/lib/format";
import { bandClass, param, statusClass, withParams, type SearchParamsObj } from "@/lib/ui";

export const dynamic = "force-dynamic";

const ORDER_BY: Record<string, "businessName" | "score" | "status" | "createdAt" | "nextFollowUpAt"> = {
  name: "businessName",
  score: "score",
  status: "status",
  created: "createdAt",
  followup: "nextFollowUpAt",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsObj>;
}) {
  const sp = await searchParams;

  const status = param(sp, "status");
  const band = param(sp, "band");
  const source = param(sp, "source");
  const service = param(sp, "service");
  const q = param(sp, "q");

  const sort = param(sp, "sort") || "score";
  const dir = param(sp, "dir") === "asc" ? "asc" : "desc";
  const orderField = ORDER_BY[sort] ?? "score";

  // Banner shown after a discovery run redirects here.
  const ingested = param(sp, "ingested");
  const updated = param(sp, "updated");
  const discoverNote = param(sp, "note");

  const leads = await prisma.lead.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(band ? { scoreBand: band } : {}),
      ...(source ? { sourceType: source } : {}),
      ...(service ? { matchedService: service } : {}),
      ...(q
        ? {
            OR: [
              { businessName: { contains: q } },
              { contactName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { [orderField]: dir },
  });

  function SortTh({ label, col, numeric }: { label: string; col: string; numeric?: boolean }) {
    const active = sort === col;
    const nextDir = active && dir === "asc" ? "desc" : "asc";
    const arrow = active ? (dir === "asc" ? " ↑" : " ↓") : "";
    return (
      <th className={numeric ? "num" : undefined}>
        <Link href={`/leads${withParams(sp, { sort: col, dir: nextDir })}`}>
          {label}
          {arrow}
        </Link>
      </th>
    );
  }

  return (
    <>
      <h1 className="page-title">Leads</h1>
      <p className="page-sub">
        {leads.length} lead{leads.length === 1 ? "" : "s"}
        {status || band || source || service || q ? " (filtered)" : ""}
      </p>

      {ingested !== "" && (
        <div className="section" style={{ borderColor: "var(--green)" }}>
          <strong style={{ color: "var(--green)" }}>
            Discovery complete{source ? ` (${source})` : ""}: {ingested} new lead
            {ingested === "1" ? "" : "s"}
            {updated && updated !== "0" ? `, ${updated} updated` : ""}.
          </strong>
          {discoverNote && (
            <div className="muted" style={{ marginTop: 6 }}>
              {discoverNote}
            </div>
          )}
        </div>
      )}

      <form className="filters" method="get">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />

        <div className="field">
          <label>Search</label>
          <input type="text" name="q" defaultValue={q} placeholder="name, contact, email" />
        </div>
        <div className="field">
          <label>Status</label>
          <select name="status" defaultValue={status}>
            <option value="">All</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Band</label>
          <select name="band" defaultValue={band}>
            <option value="">All</option>
            {SCORE_BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Source</label>
          <select name="source" defaultValue={source}>
            <option value="">All</option>
            {SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Service</label>
          <select name="service" defaultValue={service}>
            <option value="">All</option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" type="submit">
          Apply
        </button>
        <Link className="btn btn-ghost" href="/leads" style={{ padding: "8px 14px" }}>
          Reset
        </Link>
      </form>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <SortTh label="Business" col="name" />
              <th>Band</th>
              <SortTh label="Score" col="score" numeric />
              <SortTh label="Status" col="status" />
              <th>Service</th>
              <th>Source</th>
              <SortTh label="Next follow-up" col="followup" />
              <SortTh label="Updated" col="created" />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <Link href={`/leads/${lead.id}`}>
                    <strong>{lead.businessName}</strong>
                  </Link>
                  {lead.email && <div className="muted">{lead.email}</div>}
                </td>
                <td>
                  <span className={bandClass(lead.scoreBand)}>{lead.scoreBand}</span>
                </td>
                <td className="num">{lead.score}</td>
                <td>
                  <span className={statusClass(lead.status)}>{lead.status}</span>
                </td>
                <td className="muted">{lead.matchedService ?? "—"}</td>
                <td className="muted">{lead.sourceType ?? "—"}</td>
                <td className="muted">{lead.nextFollowUpAt ? fmtDate(lead.nextFollowUpAt) : "—"}</td>
                <td className="muted">{fmtRelative(lead.updatedAt)}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty">No leads match these filters.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
