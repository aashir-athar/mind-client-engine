// UI helpers: badge classes + a small query-string builder for filter/sort links.

export function bandClass(band: string | null | undefined): string {
  return `badge band-${band ?? "NOT_USEFUL"}`;
}

export function statusClass(status: string | null | undefined): string {
  return `pill status-${status ?? "NEW"}`;
}

export type SearchParamsObj = Record<string, string | string[] | undefined>;

/** Read a single string value from Next's (possibly array) searchParams. */
export function param(sp: SearchParamsObj, key: string): string {
  const v = sp[key];
  return typeof v === "string" ? v : "";
}

/**
 * Build a `?a=b&c=d` string from the current params, applying overrides.
 * An override of "" removes that key.
 */
export function withParams(current: SearchParamsObj, overrides: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (typeof v === "string" && v) p.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
