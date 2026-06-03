// POST /api/outreach { leadId, channel? } → generate a personalized DRAFT message
// (LLM-personalized when Ollama is up, deterministic template otherwise).
import { NextResponse } from "next/server";
import { CHANNELS, type Channel } from "@/lib/constants";
import { generateOutreach } from "@/lib/outreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { leadId?: string; channel?: string };
  if (!body.leadId) {
    return NextResponse.json({ ok: false, error: "Provide a 'leadId'." }, { status: 400 });
  }
  const channel =
    body.channel && (CHANNELS as readonly string[]).includes(body.channel)
      ? (body.channel as Channel)
      : undefined;

  try {
    const r = await generateOutreach({ leadId: body.leadId, channel });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
