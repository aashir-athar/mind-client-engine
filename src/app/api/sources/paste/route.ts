// POST /api/sources/paste { url?, text? } → parse a pasted profile/text into a
// lead, dedupe, score, and store. No scraping — the user supplies the content.
import { NextResponse } from "next/server";
import { parsePasted, upsertLead } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string; text?: string };
  const parsed = parsePasted({ url: body.url, text: body.text });
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  try {
    const result = await upsertLead(parsed);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
