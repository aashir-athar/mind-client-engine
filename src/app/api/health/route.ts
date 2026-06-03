// Health check: proves the Prisma 7 driver-adapter singleton works *inside* a
// Next.js route handler (real DB query), and echoes the key safety/LLM config.
import { NextResponse } from "next/server";
import { config, DRY_RUN } from "@/lib/config";
import { prisma } from "@/lib/db";

// Native SQLite driver => must run on the Node.js runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [leads, messages, followUps, audits, suppressions, auditLogs, won] =
      await Promise.all([
        prisma.lead.count(),
        prisma.message.count(),
        prisma.followUpTask.count(),
        prisma.auditResult.count(),
        prisma.suppression.count(),
        prisma.auditLog.count(),
        prisma.lead.aggregate({ where: { status: "WON" }, _sum: { wonValue: true } }),
      ]);

    return NextResponse.json({
      ok: true,
      phase: 1,
      dryRun: DRY_RUN,
      db: {
        connected: true,
        leads,
        messages,
        followUps,
        audits,
        suppressions,
        auditLogs,
        revenueWon: won._sum.wonValue ?? 0,
      },
      llm: { provider: config.LLM_PROVIDER, model: config.OLLAMA_MODEL },
      time: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
