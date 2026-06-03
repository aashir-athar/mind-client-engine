// POST /api/sources/rss { feeds? } → parse RSS/job feeds, keep buying-intent
// items, dedupe + score + store.
import { NextResponse } from "next/server";
import { discoverFromRss, ingestMany } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { feeds?: string[] };
  try {
    const { leads, scanned, note } = await discoverFromRss({ feeds: body.feeds });
    const r = await ingestMany(leads);
    return NextResponse.json({
      ok: true,
      source: "RSS",
      scanned,
      found: leads.length,
      created: r.created,
      updated: r.updated,
      note,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
