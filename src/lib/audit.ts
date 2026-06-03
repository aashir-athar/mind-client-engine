// Audit-log writer. Every meaningful action — and, crucially, every side effect
// that DRY_RUN suppresses — gets a row here, giving a full trail of what the
// system did (or would have done). Backed by the shared Prisma client.
import { config } from "./config";
import { prisma } from "./db";

export async function logAudit(
  action: string,
  detail?: string,
  dryRun: boolean = config.DRY_RUN,
) {
  return prisma.auditLog.create({
    data: { action, detail: detail ?? null, dryRun },
  });
}
