// Throwaway Phase 8 verification: enroll → due → auto-send + schedule next →
// stop on reply. Run on a fresh seed:  npm run db:seed && npx tsx scripts/verify-phase8.ts
import "../worker/load-env";
import { prisma } from "../src/lib/db";
import { processDueFollowUps } from "../src/lib/followups-run";
import { dispatchMessage, generateOutreach } from "../src/lib/outreach";

let failures = 0;
function check(ok: boolean, msg: string) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
}
const past = () => new Date(Date.now() - 1000);

async function main() {
  const lead = await prisma.lead.create({
    data: {
      businessName: "FollowUp Test",
      email: "fu@followtest.local",
      matchedService: "Web Development",
      painPoint: "needs a website",
      sourceType: "MANUAL",
      status: "NEW",
    },
  });

  // Initial send → enrolls the follow-up sequence.
  const g0 = await generateOutreach({ leadId: lead.id, channel: "EMAIL" });
  const d0 = await dispatchMessage(g0.messageId, { manual: true });
  check(d0.ok && d0.status === "SENT", "initial email sent (DRY_RUN)");

  const t1 = await prisma.followUpTask.findFirst({
    where: { leadId: lead.id, sequenceStep: 1, status: "PENDING" },
  });
  check(!!t1, "enrolled: step-1 follow-up PENDING created");
  const la = await prisma.lead.findUnique({ where: { id: lead.id } });
  check(la?.status === "CONTACTED" && !!la?.nextFollowUpAt, "lead → CONTACTED + nextFollowUpAt set");
  check(!!t1 && t1.dueAt.getTime() > Date.now(), "step-1 due in the future (~+1 day)");

  // Make step-1 due now and process it.
  await prisma.followUpTask.update({ where: { id: t1!.id }, data: { dueAt: past() } });
  const r1 = await processDueFollowUps();
  check(r1.processed === 1 && r1.sent === 1, `due follow-up processed + auto-sent ${JSON.stringify(r1)}`);
  const t1d = await prisma.followUpTask.findUnique({ where: { id: t1!.id } });
  check(t1d?.status === "DONE", "step-1 task marked DONE");
  const fu = await prisma.message.findFirst({
    where: { leadId: lead.id, sequenceStep: 1, status: "SENT" },
  });
  check(!!fu, "step-1 follow-up message created + SENT");
  const t2 = await prisma.followUpTask.findFirst({
    where: { leadId: lead.id, sequenceStep: 2, status: "PENDING" },
  });
  check(!!t2, "step-2 follow-up scheduled");

  // Simulate a reply → sequence must stop.
  await prisma.lead.update({ where: { id: lead.id }, data: { status: "REPLIED", repliesCount: 1 } });
  await prisma.followUpTask.update({ where: { id: t2!.id }, data: { dueAt: past() } });
  const r2 = await processDueFollowUps();
  check(r2.cancelled >= 1 && r2.sent === 0, `reply stops the sequence ${JSON.stringify(r2)}`);
  const t2a = await prisma.followUpTask.findUnique({ where: { id: t2!.id } });
  check(t2a?.status === "CANCELLED", "step-2 cancelled after reply");

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
}

main()
  .then(() => process.exit(failures === 0 ? 0 : 1))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
