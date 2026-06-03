// Unit tests for the pure goal-tracker math. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { computeGoal } from "../src/lib/goal";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

test("normal progress is computed from today's date", () => {
  const g = computeGoal({
    targetUsd: 10000,
    deadline: d("2026-07-01"),
    earnedUsd: 1200,
    wonCount: 1,
    contactedCount: 5,
    today: d("2026-01-01"),
  });
  assert.equal(g.remainingUsd, 8800);
  assert.equal(g.progressPct, 12); // 1200 / 10000
  assert.equal(g.daysRemaining, 181); // Jan–Jun 2026
  assert.equal(g.deadlinePassed, false);
  assert.equal(g.avgWonSize, 1200);
  assert.equal(g.clientsNeeded, 8); // ceil(8800 / 1200)
  assert.equal(g.conversionRatePct, 20); // 1 / 5
  assert.equal(g.suggestedDailyOutreach, 1);
  assert.ok(Math.abs(g.monthsRemaining - 5.95) < 0.1);
});

test("goal reached zeroes the work", () => {
  const g = computeGoal({
    targetUsd: 10000,
    deadline: d("2026-07-01"),
    earnedUsd: 12000,
    wonCount: 8,
    contactedCount: 20,
    today: d("2026-01-01"),
  });
  assert.equal(g.remainingUsd, 0);
  assert.equal(g.progressPct, 100);
  assert.equal(g.clientsNeeded, 0);
  assert.equal(g.suggestedDailyOutreach, 0);
  assert.match(g.pace, /Goal reached/);
});

test("past deadline → all remaining is needed now", () => {
  const g = computeGoal({
    targetUsd: 10000,
    deadline: d("2026-07-01"),
    earnedUsd: 1200,
    wonCount: 1,
    contactedCount: 5,
    today: d("2026-08-01"),
  });
  assert.equal(g.deadlinePassed, true);
  assert.equal(g.daysRemaining, 0);
  assert.equal(g.monthsRemaining, 0);
  assert.equal(g.requiredMonthlyUsd, 8800); // whole remainder
});

test("no wins yet uses fallback deal size + default conversion", () => {
  const g = computeGoal({
    targetUsd: 10000,
    deadline: d("2027-01-01"),
    earnedUsd: 0,
    wonCount: 0,
    contactedCount: 0,
    today: d("2026-01-01"),
  });
  assert.equal(g.avgWonSize, 750); // DEFAULT_AVG_WON
  assert.equal(g.clientsNeeded, 14); // ceil(10000 / 750)
  assert.equal(g.conversionRatePct, 0);
  assert.equal(g.suggestedDailyOutreach, 2); // via DEFAULT_CONVERSION
});
