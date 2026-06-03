// Throwaway Phase 7 verification: exercises the real email engine + dispatch
// against the DB. Run with EMAIL_DAILY_CAP=2 on a fresh seed:
//   npm run db:seed && npx tsx scripts/verify-phase7.ts
import "../worker/load-env";
import { config, DRY_RUN } from "../src/lib/config";
import { prisma } from "../src/lib/db";
import { dispatchMessage, generateOutreach } from "../src/lib/outreach";
import { addSuppression } from "../src/lib/suppression";

let failures = 0;
function check(ok: boolean, msg: string) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
}

async function main() {
  console.log(`DRY_RUN=${DRY_RUN}  EMAIL_DAILY_CAP=${config.EMAIL_DAILY_CAP}\n`);

  // Create fresh, message-free leads so step-dedupe doesn't mask cap/suppression.
  const emails = ["t1@captest.local", "t2@captest.local", "t3@captest.local", "t4@captest.local"];
  const leads = [];
  for (const email of emails) {
    leads.push(
      await prisma.lead.create({
        data: {
          businessName: `Cap Test (${email})`,
          email,
          matchedService: "Web Development",
          painPoint: "needs a modern website",
          sourceType: "MANUAL",
          status: "NEW",
        },
      }),
    );
  }

  // 1) DRY_RUN send → SENT (simulated) + lead CONTACTED
  const g0 = await generateOutreach({ leadId: leads[0].id, channel: "EMAIL" });
  const d0 = await dispatchMessage(g0.messageId, { manual: true });
  check(d0.ok && d0.status === "SENT" && d0.dryRun === true, `DRY_RUN send → SENT (simulated)`);
  const l0 = await prisma.lead.findUnique({ where: { id: leads[0].id } });
  check(l0?.status === "CONTACTED" && !!l0?.lastContactedAt, `lead → CONTACTED + lastContactedAt set`);

  // 2) second send still under cap (count → 2)
  const g1 = await generateOutreach({ leadId: leads[1].id, channel: "EMAIL" });
  const d1 = await dispatchMessage(g1.messageId, { manual: true });
  check(d1.ok && d1.status === "SENT", `2nd send → SENT (under cap)`);

  // 3) third send → daily cap reached, stays queued (retryable)
  const g2 = await generateOutreach({ leadId: leads[2].id, channel: "EMAIL" });
  const d2 = await dispatchMessage(g2.messageId, { manual: true });
  check(!d2.ok && d2.reason === "daily cap reached" && d2.retryable === true, `3rd send → blocked by daily cap`);
  const m2 = await prisma.message.findUnique({ where: { id: g2.messageId } });
  check(m2?.status !== "SENT", `capped message NOT marked SENT (status=${m2?.status})`);

  // 4) suppression blocks (checked before the cap)
  await addSuppression(leads[3].email!, "SAID_NO");
  const g3 = await generateOutreach({ leadId: leads[3].id, channel: "EMAIL" });
  const d3 = await dispatchMessage(g3.messageId, { manual: true });
  check(!d3.ok && d3.reason === "suppressed", `suppressed recipient → blocked`);

  // audit trail
  const [dryRunSends, capRows, supRows] = await Promise.all([
    prisma.auditLog.count({ where: { action: "EMAIL_DRY_RUN_SEND" } }),
    prisma.auditLog.count({ where: { action: "EMAIL_CAP_REACHED" } }),
    prisma.auditLog.count({ where: { action: "EMAIL_SUPPRESSED" } }),
  ]);
  console.log(`\naudits: EMAIL_DRY_RUN_SEND=${dryRunSends} EMAIL_CAP_REACHED=${capRows} EMAIL_SUPPRESSED=${supRows}`);
  check(dryRunSends >= 2 && capRows >= 1 && supRows >= 1, `full audit trail recorded`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
}

main()
  .then(() => process.exit(failures === 0 ? 0 : 1))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
