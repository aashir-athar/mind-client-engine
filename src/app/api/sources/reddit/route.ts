// POST /api/sources/reddit { query, subreddit? } → search Reddit (free OAuth),
// dedupe + score + store. Returns configured:false (no error) when Reddit is
// not set up in the environment.
import { NextResponse } from "next/server";
import { ingestMany, searchReddit } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { query?: string; subreddit?: string };
  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ ok: false, error: "Provide a 'query'." }, { status: 400 });
  }
  try {
    const { leads, configured, note } = await searchReddit({ query, subreddit: body.subreddit });
    if (!configured) {
      return NextResponse.json({ ok: true, source: "REDDIT", configured: false, note });
    }
    const r = await ingestMany(leads);
    return NextResponse.json({
      ok: true,
      source: "REDDIT",
      configured: true,
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
