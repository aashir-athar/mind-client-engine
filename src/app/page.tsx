import Link from "next/link";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { fmtRelative, money } from "@/lib/format";
import { computeGoal } from "@/lib/goal";
import { bandClass, statusClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    total,
    hot,
    messagesSent,
    replies,
    pendingFollowUps,
    won,
    revenue,
    contactedCount,
    settings,
    sentThisWeek,
    repliesThisWeek,
    wonThisWeek,
    topLeads,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { scoreBand: "HOT" } }),
    prisma.message.count({ where: { direction: "OUT", status: "SENT" } }),
    prisma.message.count({ where: { direction: "IN" } }),
    prisma.followUpTask.count({ where: { status: "PENDING" } }),
    prisma.lead.count({ where: { status: "WON" } }),
    prisma.lead.aggregate({ where: { status: "WON" }, _sum: { wonValue: true } }),
    prisma.lead.count({ where: { lastContactedAt: { not: null } } }),
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.message.count({ where: { direction: "OUT", status: "SENT", sentAt: { gte: weekAgo } } }),
    prisma.message.count({ where: { direction: "IN", sentAt: { gte: weekAgo } } }),
    prisma.lead.aggregate({ where: { status: "WON", updatedAt: { gte: weekAgo } }, _sum: { wonValue: true } }),
    prisma.lead.findMany({
      where: { status: { notIn: ["WON", "LOST", "IGNORE"] } },
      orderBy: { score: "desc" },
      take: 5,
    }),
  ]);

  const earnedUsd = revenue._sum.wonValue ?? 0;
  const targetUsd = settings?.goalTargetUsd ?? config.GOAL_TARGET_USD;
  const deadline = settings?.goalDeadline ?? new Date(config.GOAL_DEADLINE);

  const goal = computeGoal({
    targetUsd,
    deadline,
    earnedUsd,
    wonCount: won,
    contactedCount,
    today: now,
  });

  const kpis = [
    { k: "Total leads", v: total },
    { k: "Hot leads", v: hot },
    { k: "Messages sent", v: messagesSent },
    { k: "Replies", v: replies },
    { k: "Follow-ups pending", v: pendingFollowUps },
    { k: "Clients won", v: won },
    { k: "Revenue", v: money(earnedUsd) },
  ];

  return (
    <>
      <h1 className="page-title">Overview</h1>
      <p className="page-sub">Local-first, $0 automated business development.</p>

      <div className="grid cards" style={{ marginBottom: 22 }}>
        {kpis.map((kpi) => (
          <div className="card" key={kpi.k}>
            <div className="k">{kpi.k}</div>
            <div className="v">{kpi.v}</div>
          </div>
        ))}
      </div>

      {/* Dynamic goal tracker */}
      <div className="section">
        <h3>
          Goal: {money(targetUsd)} by{" "}
          {deadline.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
        </h3>

        <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <span>
            {money(earnedUsd)} earned <span className="muted">/ {money(targetUsd)}</span>
          </span>
          <strong>{goal.progressPct.toFixed(0)}%</strong>
        </div>
        <div className="progress">
          <div className="progress-bar" style={{ width: `${goal.progressPct}%` }} />
        </div>

        <div className="goal-grid">
          <div className="g">
            <div className="k">Remaining</div>
            <div className="v">{money(goal.remainingUsd)}</div>
          </div>
          <div className="g">
            <div className="k">Time left</div>
            <div className="v">
              {goal.deadlinePassed ? "past due" : `${goal.monthsRemaining.toFixed(1)} mo`}
            </div>
          </div>
          <div className="g">
            <div className="k">Required / month</div>
            <div className="v">{money(Math.round(goal.requiredMonthlyUsd))}</div>
          </div>
          <div className="g">
            <div className="k">Avg deal size</div>
            <div className="v">{money(Math.round(goal.avgWonSize))}</div>
          </div>
          <div className="g">
            <div className="k">Clients needed</div>
            <div className="v">{goal.clientsNeeded}</div>
          </div>
          <div className="g">
            <div className="k">Conversion</div>
            <div className="v">{goal.conversionRatePct.toFixed(0)}%</div>
          </div>
          <div className="g">
            <div className="k">Suggested daily outreach</div>
            <div className="v">{goal.suggestedDailyOutreach}</div>
          </div>
          <div className="g">
            <div className="k">Pace</div>
            <div className="v" style={{ fontSize: 15 }}>{goal.pace}</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          Computed live from today's date and your WON revenue — edit the target/deadline on the
          Settings page (or in <code>.env</code>).
        </p>
      </div>

      {/* This week */}
      <div className="grid cards" style={{ margin: "16px 0" }}>
        <div className="card">
          <div className="k">Outreach sent (7d)</div>
          <div className="v">{sentThisWeek}</div>
        </div>
        <div className="card">
          <div className="k">Replies (7d)</div>
          <div className="v">{repliesThisWeek}</div>
        </div>
        <div className="card">
          <div className="k">Revenue won (7d)</div>
          <div className="v">{money(wonThisWeek._sum.wonValue ?? 0)}</div>
        </div>
      </div>

      <div className="section">
        <h3>Top leads to work</h3>
        {topLeads.length === 0 ? (
          <p className="muted">No active leads yet. Discover some on the Discover page.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Band</th>
                <th className="num">Score</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {topLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link href={`/leads/${lead.id}`}>
                      <strong>{lead.businessName}</strong>
                    </Link>
                  </td>
                  <td>
                    <span className={bandClass(lead.scoreBand)}>{lead.scoreBand}</span>
                  </td>
                  <td className="num">{lead.score}</td>
                  <td>
                    <span className={statusClass(lead.status)}>{lead.status}</span>
                  </td>
                  <td className="muted">{fmtRelative(lead.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
