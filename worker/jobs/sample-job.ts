// Example cron job. It imports shared logic from src/lib (the SAME modules the
// Next.js app uses) — proving the worker reuses app code with zero duplication
// and that the Prisma driver-adapter singleton works *outside* Next too.
import { logAudit } from "../../src/lib/audit";
import { prisma } from "../../src/lib/db";

export async function runSampleJob(): Promise<void> {
  const leadCount = await prisma.lead.count();
  const stamp = new Date().toISOString();
  console.log(`[worker ${stamp}] heartbeat — ${leadCount} leads in DB`);
  await logAudit("WORKER_HEARTBEAT", `leads=${leadCount}`);
}
