// Seed script — run with `npm run db:seed` (tsx prisma/seed.ts).
// Wipes existing rows and inserts a small, varied, DETERMINISTIC dataset so the
// dashboard, scoring, outreach, scheduler and goal tracker all have realistic
// data to work against in later phases.
//
// load-env first so DATABASE_URL is available outside the Next runtime.
import "../worker/load-env";

import { config } from "../src/lib/config";
import { SERVICES } from "../src/lib/constants";
import { prisma } from "../src/lib/db";

const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

async function wipe() {
  // Child rows first (explicit, even though FK cascade would handle lead children).
  await prisma.message.deleteMany();
  await prisma.followUpTask.deleteMany();
  await prisma.auditResult.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.suppression.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.auditLog.deleteMany();
}

async function seedLeads() {
  // A — local business, insecure + non-mobile site → HOT, brand new.
  await prisma.lead.create({
    data: {
      businessName: "Lahore Bakery Co",
      contactName: "Imran",
      website: "http://lahorebakery.example",
      email: "hello@lahorebakery.example",
      whatsapp: "+92-300-1234567",
      location: "Lahore, PK",
      industry: "Food & Beverage",
      sourceType: "OVERPASS",
      sourceUrl: "https://overpass-api.de/api/interpreter",
      painPoint: "Website is HTTP-only and not mobile-friendly; loses phone customers.",
      matchedService: "Web Development",
      score: 84,
      scoreBand: "HOT",
      status: "NEW",
      audits: {
        create: {
          url: "http://lahorebakery.example",
          https: false,
          mobileFriendly: false,
          pageSizeKb: 120,
          hasSeoBasics: false,
          pageSpeedScore: 38,
          summary: "No HTTPS, missing mobile viewport, weak SEO tags, slow score.",
        },
      },
    },
  });

  // B — crypto startup founder → WARM, contacted, awaiting follow-up.
  await prisma.lead.create({
    data: {
      businessName: "BlockTrail",
      contactName: "Ayesha",
      website: "https://blocktrail.example",
      email: "ayesha@blocktrail.example",
      twitter: "@blocktrail",
      location: "Remote",
      industry: "Crypto / Web3",
      sourceType: "REDDIT",
      sourceUrl: "https://www.reddit.com/r/cryptodevs/",
      painPoint: "Wants a trading-journal dashboard to track PnL across exchanges.",
      matchedService: "Crypto Tools (dashboards, trading journals, landing pages)",
      score: 72,
      scoreBand: "WARM",
      status: "CONTACTED",
      lastContactedAt: days(-2),
      nextFollowUpAt: days(3),
      messages: {
        create: [
          {
            channel: "EMAIL",
            direction: "OUT",
            subject: "Trading-journal dashboard for BlockTrail",
            body: "Hi Ayesha — saw you're tracking PnL manually. I build trading-journal dashboards. Want a free 10-min teardown of your current flow?",
            status: "SENT",
            sequenceStep: 0,
            sentAt: days(-2),
          },
        ],
      },
      followUps: {
        create: [
          { dueAt: days(3), sequenceStep: 1, channel: "EMAIL", status: "PENDING" },
        ],
      },
    },
  });

  // C — indie app founder with a broken Expo build → HOT, already replied.
  await prisma.lead.create({
    data: {
      businessName: "ExpoRescue (indie founder)",
      contactName: "Bilal",
      email: "bilal@indieapp.example",
      location: "Karachi, PK",
      industry: "Mobile SaaS",
      sourceType: "RSS",
      sourceUrl: "https://hnrss.org/whoishiring/jobs",
      painPoint: "Production Expo build failing; navigation + Firebase auth bugs.",
      matchedService: "App Rescue / Bug Fixing",
      score: 90,
      scoreBand: "HOT",
      status: "REPLIED",
      repliesCount: 1,
      lastContactedAt: days(-5),
      messages: {
        create: [
          {
            channel: "EMAIL",
            direction: "OUT",
            subject: "Fixing your Expo production build",
            body: "Hi Bilal — I rescue React Native / Expo apps (build failures, nav, Firebase). Happy to look at your build logs free.",
            status: "SENT",
            sequenceStep: 0,
            sentAt: days(-5),
          },
          {
            channel: "EMAIL",
            direction: "IN",
            body: "Yes! The EAS build fails on iOS and login crashes. Can you hop on a call this week?",
            status: "SENT",
            sequenceStep: 0,
            sentAt: days(-1),
          },
        ],
      },
      // Sequence cancelled because they replied (the scheduler will enforce this in Phase 8).
      followUps: {
        create: [
          { dueAt: days(2), sequenceStep: 1, channel: "EMAIL", status: "CANCELLED" },
        ],
      },
    },
  });

  // D — boutique with a weak Instagram → WARM, draft outreach waiting for approval.
  await prisma.lead.create({
    data: {
      businessName: "Threadline Boutique",
      contactName: "Nida",
      instagram: "@threadline.pk",
      location: "Lahore, PK",
      industry: "Fashion / Retail",
      sourceType: "PASTE",
      sourceUrl: "https://instagram.com/threadline.pk",
      painPoint: "Inconsistent posting and low-quality photos; little engagement.",
      matchedService: "Instagram / Short-form Content",
      score: 65,
      scoreBand: "WARM",
      status: "NEW",
      messages: {
        create: [
          {
            channel: "INSTAGRAM",
            direction: "OUT",
            body: "Hi Nida! Love Threadline's pieces. I make short-form reels + clean product photos that lift engagement. Want a couple of free sample edits?",
            status: "DRAFT",
            sequenceStep: 0,
          },
        ],
      },
    },
  });

  // E — agency wanting white-label dev → LOW, interested but slow.
  await prisma.lead.create({
    data: {
      businessName: "Pixela Agency",
      contactName: "Hamza",
      website: "https://pixela.example",
      linkedin: "https://linkedin.com/company/pixela",
      location: "Islamabad, PK",
      industry: "Design Agency",
      sourceType: "MANUAL",
      painPoint: "Overflow front-end work; needs white-label React support.",
      matchedService: "Web Development",
      score: 48,
      scoreBand: "LOW",
      status: "INTERESTED",
      notes: "Met at a meetup; said to follow up next month about retainer.",
      lastContactedAt: days(-10),
    },
  });

  // F — closed deal → WON, gives the goal tracker real revenue.
  await prisma.lead.create({
    data: {
      businessName: "NimbleSaaS",
      contactName: "Sara",
      website: "https://nimblesaas.example",
      email: "sara@nimblesaas.example",
      location: "Remote",
      industry: "SaaS",
      sourceType: "REDDIT",
      sourceUrl: "https://www.reddit.com/r/startups/",
      painPoint: "Needed an MVP mobile app built fast for a demo day.",
      matchedService: "Mobile App Development (React Native / Expo)",
      score: 95,
      scoreBand: "HOT",
      status: "WON",
      wonValue: 1200,
      repliesCount: 3,
      lastContactedAt: days(-20),
      messages: {
        create: [
          {
            channel: "EMAIL",
            direction: "OUT",
            subject: "RN/Expo MVP before your demo day",
            body: "Hi Sara — I can ship a polished Expo MVP fast. Want a scope + fixed quote?",
            status: "SENT",
            sequenceStep: 0,
            sentAt: days(-25),
          },
        ],
      },
    },
  });

  // G — junk directory listing → NOT_USEFUL, ignored (shows the low end of scoring).
  await prisma.lead.create({
    data: {
      businessName: "Unnamed Directory Listing",
      location: "Unknown",
      sourceType: "OVERPASS",
      score: 10,
      scoreBand: "NOT_USEFUL",
      status: "IGNORE",
    },
  });
}

async function seedSuppression() {
  await prisma.suppression.createMany({
    data: [
      { value: "noreply@bigcorp.example", kind: "EMAIL", reason: "SAID_NO" },
      { value: "do-not-contact@example.com", kind: "EMAIL", reason: "UNSUBSCRIBE" },
    ],
  });
}

async function seedSettings() {
  await prisma.settings.create({
    data: {
      id: "singleton",
      servicesOffered: JSON.stringify(SERVICES),
      dailyEmailCap: 20,
      sendWindowStart: 9,
      sendWindowEnd: 18,
      llmProvider: config.LLM_PROVIDER,
      llmModel: config.OLLAMA_MODEL,
      llmHost: config.OLLAMA_HOST,
      goalTargetUsd: config.GOAL_TARGET_USD,
      goalDeadline: new Date(config.GOAL_DEADLINE),
    },
  });
}

async function main() {
  await wipe();
  await seedLeads();
  await seedSuppression();
  await seedSettings();
  await prisma.auditLog.create({
    data: { action: "SEED", detail: "Seeded full sample dataset (Phase 1)", dryRun: true },
  });

  const [leads, messages, followUps, audits, suppressions, won] = await Promise.all([
    prisma.lead.count(),
    prisma.message.count(),
    prisma.followUpTask.count(),
    prisma.auditResult.count(),
    prisma.suppression.count(),
    prisma.lead.aggregate({ where: { status: "WON" }, _sum: { wonValue: true } }),
  ]);

  console.log("Seed complete:");
  console.log(`  leads=${leads}  messages=${messages}  followUps=${followUps}`);
  console.log(`  audits=${audits}  suppressions=${suppressions}`);
  console.log(`  revenue (WON wonValue sum)=$${won._sum.wonValue ?? 0}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
