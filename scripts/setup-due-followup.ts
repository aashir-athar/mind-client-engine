// Creates one lead with an already-due follow-up so the worker has something to
// process on its next cron tick. Run, then start `npm run worker`.
import "../worker/load-env";
import { prisma } from "../src/lib/db";
import { dispatchMessage, generateOutreach } from "../src/lib/outreach";

async function main() {
  const lead = await prisma.lead.create({
    data: {
      businessName: "Worker Due Test",
      email: "wd@workertest.local",
      matchedService: "Web Development",
      painPoint: "needs a website",
      sourceType: "MANUAL",
      status: "NEW",
    },
  });
  const g = await generateOutreach({ leadId: lead.id, channel: "EMAIL" });
  await dispatchMessage(g.messageId, { manual: true }); // enrolls step-1
  const t = await prisma.followUpTask.findFirst({
    where: { leadId: lead.id, sequenceStep: 1, status: "PENDING" },
  });
  await prisma.followUpTask.update({
    where: { id: t!.id },
    data: { dueAt: new Date(Date.now() - 1000) },
  });
  console.log(`setup done: 1 due follow-up for lead ${lead.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
