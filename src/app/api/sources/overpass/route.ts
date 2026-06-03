// POST /api/sources/overpass { city, category, limit? } → discover local
// businesses via OSM (Nominatim + Overpass), dedupe + score + store.
import { NextResponse } from "next/server";
import { discoverBusinesses, ingestMany } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    city?: string;
    category?: string;
    limit?: number;
  };
  const city = (body.city ?? "").trim();
  const category = (body.category ?? "").trim();
  if (!city || !category) {
    return NextResponse.json(
      { ok: false, error: "Provide 'city' and 'category'." },
      { status: 400 },
    );
  }
  try {
    const { leads, note } = await discoverBusinesses({ city, category, limit: body.limit });
    const r = await ingestMany(leads);
    return NextResponse.json({
      ok: true,
      source: "OVERPASS",
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
