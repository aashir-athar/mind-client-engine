// Throwaway Phase 9 verification (reply core; IMAP path is config-gated). Run on a
// fresh seed:  npm run db:seed && npx tsx scripts/verify-phase9.ts
import "../worker/load-env";
import { prisma } from "../src/lib/db";
import { dispatchMessage, generateOutreach } from "../src/lib/outreach";
import { recordReply, recordReplyForLead } from "../src/lib/replies";

let failures = 0;
function check(ok: boolean, msg: string) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
}

async function main() {
  // Lead A — manual reply stops the sequence.
  const a = await prisma.lead.create({
    data: {
      businessName: "Reply A",
      email: "a@replytest.local",
      matchedService: "Web Development",
      painPoint: "needs a website",
      sourceType: "MANUAL",
      status: "NEW",
    },
  });
  const g = await generateOutreach({ leadId: a.id, channel: "EMAIL" });
  await dispatchMessage(g.messageId, { manual: true }); // enrolls a follow-up
  check(
    (await prisma.followUpTask.count({ where: { leadId: a.id, status: "PENDING" } })) === 1,
    "lead A has 1 pending follow-up before the reply",
  );

  const r = await recordReplyForLead(a.id, "Sure, let's chat next week!");
  check(r.recorded && !r.optedOut, "manual reply recorded (not opt-out)");
  const la = await prisma.lead.findUnique({ where: { id: a.id } });
  check(la?.status === "REPLIED" && la?.repliesCount === 1, "lead A → REPLIED + repliesCount 1");
  check(
    (await prisma.followUpTask.count({ where: { leadId: a.id, status: "PENDING" } })) === 0,
    "follow-ups cancelled after the reply",
  );
  check(
    (await prisma.message.count({ where: { leadId: a.id, direction: "IN" } })) === 1,
    "inbound message recorded",
  );

  // Lead B — IMAP-style email match + opt-out + idempotency.
  const b = await prisma.lead.create({
    data: {
      businessName: "Reply B",
      email: "b@replytest.local",
      matchedService: "Web Development",
      sourceType: "MANUAL",
      status: "CONTACTED",
    },
  });
  const r1 = await recordReply({
    fromEmail: "B@ReplyTest.Local",
    subject: "Re: hi",
    body: "please unsubscribe",
    providerId: "msg-1",
  });
  check(r1.recorded && r1.optedOut === true && r1.leadId === b.id, "email-matched reply recorded + opt-out");
  check((await prisma.lead.findUnique({ where: { id: b.id } }))?.status === "LOST", "opt-out → lead LOST");
  check(
    !!(await prisma.suppression.findUnique({ where: { value: "b@replytest.local" } })),
    "opt-out → address suppressed",
  );

  const r2 = await recordReply({ fromEmail: "b@replytest.local", body: "please unsubscribe", providerId: "msg-1" });
  check(!r2.recorded && r2.reason === "already recorded", "idempotency: same providerId not re-recorded");

  const r3 = await recordReply({ fromEmail: "stranger@nowhere.local", body: "hi", providerId: "msg-2" });
  check(!r3.recorded && r3.reason === "no matching lead", "unknown sender → no lead matched");

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
}

main()
  .then(() => process.exit(failures === 0 ? 0 : 1))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
