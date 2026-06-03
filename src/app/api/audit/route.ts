// POST /api/audit { url, leadId? } → run a website audit (respecting robots.txt),
// store an AuditResult, and return the row + full detail. Programmatic entry point
// for the auditor; the dashboard uses the server action on the lead detail page.
import { NextResponse } from "next/server";
import { runAndStoreAudit } from "@/lib/audit-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: unknown; leadId?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const leadId = typeof body.leadId === "string" ? body.leadId : null;

  if (!url) {
    return NextResponse.json({ ok: false, error: "Provide a 'url'." }, { status: 400 });
  }

  try {
    const { row, result } = await runAndStoreAudit({ url, leadId });
    return NextResponse.json({ ok: true, audit: row, detail: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
