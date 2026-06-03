// Small presentation helpers shared by the dashboard pages.
import { format, formatDistanceToNow } from "date-fns";

type DateLike = Date | string | number | null | undefined;

export function fmtDate(d: DateLike): string {
  if (!d) return "—";
  return format(new Date(d), "dd MMM yyyy");
}

export function fmtDateTime(d: DateLike): string {
  if (!d) return "—";
  return format(new Date(d), "dd MMM yyyy, HH:mm");
}

export function fmtRelative(d: DateLike): string {
  if (!d) return "—";
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

export function money(n: number | null | undefined): string {
  return `$${Number(n ?? 0).toLocaleString()}`;
}
