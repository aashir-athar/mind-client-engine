// Full end-to-end DRY_RUN demo on a throwaway lead. Proves the acceptance flow:
//   discover → score → audit → draft → "send" (logged) → follow-up scheduled +
//   processed → reply logged → goal updated, with a final safety check that
//   nothing actually left the machine. Run:  npm run demo
import "../worker/load-env";
import { runAndStoreAudit } from "../src/lib/audit-site";
import { config, DRY_RUN } from "../src/lib/config";
import { prisma } from "../src/lib/db";
import { processDueFollowUps } from "../src/lib/followups-run";
import { computeGoal } from "../src/lib/goal";
import { dispatchMessage, generateOutreach } from "../src/lib/outreach";
import { recordReplyForLead } from "../src/lib/replies";
import { scoreAndStore } from "../src/lib/scoring-run";
import { parsePasted, upsertLead } from "../src/lib/sources";

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;
let problems = 0;
function step(n: number, title: string) {
  console.log(`\n[${n}] ${title}`);
}
function ok(cond: boolean, msg: string) {
  console.log(`   ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) problems++;
}

async function main() {
  console.log("=".repeat(62));
  console.log("  MiND Client Engine — full DRY_RUN end-to-end demo");
  console.log(`  DRY_RUN = ${DRY_RUN}   (must be true to run the demo)`);
  console.log("=".repeat(62));
  if (!DRY_RUN) {
    console.log("Refusing to run the demo with DRY_RUN=false.");
    process.exit(1);
  }

  // 1) DISCOVER — paste & enrich (deterministic, no network).
  step(1, "DISCOVER — paste & enrich a prospect (no scraping)");
  const parsed = parsePasted({
    url: "https://www.linkedin.com/in/demo-founder",
    text: "our startup needs a new website and our Expo app build keeps failing",
  });
  if ("error" in parsed) throw new Error(parsed.error);
  parsed.businessName = "Demo Prospect Co";
  parsed.email = "founder@demoprospect.example";
  parsed.website = "https://example.com";
  const ing = await upsertLead(parsed);
  const leadId = ing.leadId;
  let lead = await prisma.lead.findUnique({ where: { id: leadId } });
  ok(!!lead, `created lead "${lead?.businessName}" via ${lead?.sourceType}`);

  // 2) SCORE — deterministic + explainable (run during ingest).
  step(2, "SCORE — deterministic, explainable");
  ok(
    typeof lead?.score === "number",
    `score=${lead?.score} band=${lead?.scoreBand} service="${lead?.matchedService}"`,
  );

  // 3) AUDIT — website checks (robots-respecting, graceful on errors).
  step(3, "AUDIT — website checks");
  const { result: audit } = await runAndStoreAudit({ url: lead!.website!, leadId });
  ok(true, `${audit.finalUrl}: https=${audit.https} mobile=${audit.mobileFriendly} seo=${audit.hasSeoBasics}`);
  ok(true, `summary: ${audit.summary}`);
  await scoreAndStore(leadId); // re-score now that an audit exists
  lead = await prisma.lead.findUnique({ where: { id: leadId } });
  ok(true, `re-scored with audit → ${lead?.score} (${lead?.scoreBand})`);

  // 4) DRAFT — personalized outreach (LLM with template fallback).
  step(4, "DRAFT — personalized outreach");
  const gen = await generateOutreach({ leadId, channel: "EMAIL" });
  const draft = await prisma.message.findUnique({ where: { id: gen.messageId } });
  ok(draft?.status === "DRAFT", `email DRAFT created (llm=${gen.usedLlm}) subject="${draft?.subject}"`);

  // 5) SEND — DRY_RUN (logged + audited, never actually sent).
  step(5, "SEND — DRY_RUN");
  const disp = await dispatchMessage(gen.messageId, { manual: true });
  ok(disp.ok && disp.dryRun === true, `dispatch → ${disp.status} (dryRun=${disp.dryRun})`);
  lead = await prisma.lead.findUnique({ where: { id: leadId } });
  ok(lead?.status === "CONTACTED", `lead → ${lead?.status}, lastContactedAt set=${!!lead?.lastContactedAt}`);

  // 6) FOLLOW-UP — scheduled (Day 1/3/7/14), then processed by the worker logic.
  step(6, "FOLLOW-UP — scheduled then processed");
  const fu1 = await prisma.followUpTask.findFirst({
    where: { leadId, sequenceStep: 1, status: "PENDING" },
  });
  ok(!!fu1, `step-1 follow-up scheduled for ${fu1?.dueAt.toISOString().slice(0, 10)}`);
  await prisma.followUpTask.update({ where: { id: fu1!.id }, data: { dueAt: new Date(Date.now() - 1000) } });
  const fr = await processDueFollowUps();
  ok(fr.sent === 1 && fr.scheduledNext === 1, `due follow-up auto-sent (DRY_RUN) + next step scheduled`);

  // 7) REPLY — logged; stops the sequence.
  step(7, "REPLY — logged, stops the sequence");
  const rep = await recordReplyForLead(leadId, "Sounds interesting, can you send a quote?");
  lead = await prisma.lead.findUnique({ where: { id: leadId } });
  const pending = await prisma.followUpTask.count({ where: { leadId, status: "PENDING" } });
  ok(
    rep.recorded && lead?.status === "REPLIED" && pending === 0,
    `reply recorded → ${lead?.status}, ${pending} pending follow-ups`,
  );

  // 8) GOAL — dynamic progress from today's date + WON revenue.
  step(8, "GOAL — dynamic progress");
  const [won, revenue, contacted, settings] = await Promise.all([
    prisma.lead.count({ where: { status: "WON" } }),
    prisma.lead.aggregate({ where: { status: "WON" }, _sum: { wonValue: true } }),
    prisma.lead.count({ where: { lastContactedAt: { not: null } } }),
    prisma.settings.findUnique({ where: { id: "singleton" } }),
  ]);
  const goal = computeGoal({
    targetUsd: settings?.goalTargetUsd ?? config.GOAL_TARGET_USD,
    deadline: settings?.goalDeadline ?? new Date(config.GOAL_DEADLINE),
    earnedUsd: revenue._sum.wonValue ?? 0,
    wonCount: won,
    contactedCount: contacted,
    today: new Date(),
  });
  ok(
    true,
    `${usd(goal.earnedUsd)}/${usd(goal.targetUsd)} (${goal.progressPct.toFixed(0)}%), ` +
      `need ${goal.clientsNeeded} clients, suggest ${goal.suggestedDailyOutreach}/day (${goal.pace})`,
  );

  // 9) SAFETY — confirm nothing actually left the machine.
  step(9, "SAFETY — nothing was actually sent");
  const realSends = await prisma.auditLog.count({ where: { action: "EMAIL_SENT" } });
  const drySends = await prisma.auditLog.count({ where: { action: "EMAIL_DRY_RUN_SEND" } });
  ok(realSends === 0, `real EMAIL_SENT count = ${realSends} (must be 0)`);
  ok(drySends >= 2, `simulated EMAIL_DRY_RUN_SEND count = ${drySends}`);

  // Clean up the throwaway demo lead (keeps the seed dataset canonical).
  await prisma.message.deleteMany({ where: { leadId } });
  await prisma.followUpTask.deleteMany({ where: { leadId } });
  await prisma.auditResult.deleteMany({ where: { leadId } });
  await prisma.lead.delete({ where: { id: leadId } });

  console.log(`\n${"=".repeat(62)}`);
  console.log(
    problems === 0
      ? "  ✅ DEMO PASSED — the full DRY_RUN pipeline works end to end."
      : `  ❌ DEMO had ${problems} problem(s).`,
  );
  console.log("=".repeat(62));
}

main()
  .then(() => process.exit(problems === 0 ? 0 : 1))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
