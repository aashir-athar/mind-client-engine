"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  discoverBusinesses,
  discoverFromRss,
  ingestMany,
  parsePasted,
  searchReddit,
  upsertLead,
} from "@/lib/sources";

export async function ingestPaste(formData: FormData) {
  const url = String(formData.get("url") ?? "");
  const text = String(formData.get("text") ?? "");
  const parsed = parsePasted({ url, text });
  if ("error" in parsed) redirect(`/sources?err=${encodeURIComponent(parsed.error)}`);

  const r = await upsertLead(parsed);
  revalidatePath("/leads");
  redirect(`/leads/${r.leadId}`);
}

export async function runRss() {
  const { leads } = await discoverFromRss();
  const r = await ingestMany(leads);
  revalidatePath("/leads");
  redirect(`/leads?source=RSS&ingested=${r.created}&updated=${r.updated}`);
}

export async function runOverpass(formData: FormData) {
  const city = String(formData.get("city") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!city || !category) {
    redirect(`/sources?err=${encodeURIComponent("Provide both a city and a category.")}`);
  }
  const { leads, note } = await discoverBusinesses({ city, category, limit: 25 });
  const r = await ingestMany(leads);
  revalidatePath("/leads");
  const noteQs = note ? `&note=${encodeURIComponent(note)}` : "";
  redirect(`/leads?source=OVERPASS&ingested=${r.created}&updated=${r.updated}${noteQs}`);
}

export async function runReddit(formData: FormData) {
  const query = String(formData.get("query") ?? "").trim();
  if (!query) redirect(`/sources?err=${encodeURIComponent("Provide a search query.")}`);

  const { leads, configured, note } = await searchReddit({ query });
  if (!configured) {
    redirect(`/sources?err=${encodeURIComponent(note ?? "Reddit is not configured.")}`);
  }
  const r = await ingestMany(leads);
  revalidatePath("/leads");
  redirect(`/leads?source=REDDIT&ingested=${r.created}&updated=${r.updated}`);
}
