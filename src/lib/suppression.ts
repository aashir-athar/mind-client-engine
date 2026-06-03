// Suppression list — addresses/handles we must NEVER contact. Checked by the
// email engine before every send. Matches the exact value AND (for emails) the
// domain, so suppressing a domain blocks all addresses under it.
import { prisma } from "./db";
import { emailDomain } from "./email-policy";

export async function isSuppressed(value: string): Promise<boolean> {
  const v = value.trim().toLowerCase();
  if (!v) return false;

  const exact = await prisma.suppression.findUnique({ where: { value: v } });
  if (exact) return true;

  const domain = emailDomain(v);
  if (domain && domain !== v) {
    const byDomain = await prisma.suppression.findFirst({ where: { value: domain } });
    if (byDomain) return true;
  }
  return false;
}

export async function addSuppression(value: string, reason: string, kind = "EMAIL") {
  const v = value.trim().toLowerCase();
  if (!v) throw new Error("Cannot suppress an empty value");
  return prisma.suppression.upsert({
    where: { value: v },
    update: { reason, kind },
    create: { value: v, reason, kind },
  });
}
