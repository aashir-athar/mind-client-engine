// Goal tracker — PURE math, no I/O. Everything is computed from `today` (passed
// in, never hardcoded) so it is fully unit-testable and always current. The
// Overview page supplies live DB figures + new Date().
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.4375; // average, accounts for leap years
const WORKDAYS_PER_MONTH = 22;

// Assumptions used only until there is real data to replace them.
const DEFAULT_AVG_WON = 750; // fallback project size before the first win
const DEFAULT_CONVERSION = 0.05; // 5% contacted→won before any data

export interface GoalInput {
  targetUsd: number;
  deadline: Date;
  earnedUsd: number; // sum of WON wonValue
  wonCount: number;
  contactedCount: number; // leads actually contacted (conversion denominator)
  today: Date;
}

export interface GoalProgress {
  targetUsd: number;
  earnedUsd: number;
  remainingUsd: number;
  progressPct: number; // 0–100
  daysRemaining: number;
  monthsRemaining: number; // fractional
  deadlinePassed: boolean;
  requiredMonthlyUsd: number;
  avgWonSize: number;
  clientsNeeded: number;
  conversionRatePct: number; // won / contacted
  suggestedDailyOutreach: number;
  pace: string;
}

function paceLabel(daily: number, remaining: number): string {
  if (remaining <= 0) return "Goal reached 🎉";
  if (daily <= 3) return "comfortable";
  if (daily <= 8) return "steady";
  if (daily <= 20) return "aggressive";
  return "very aggressive";
}

export function computeGoal(input: GoalInput): GoalProgress {
  const targetUsd = Math.max(0, input.targetUsd);
  const earnedUsd = Math.max(0, input.earnedUsd);
  const remainingUsd = Math.max(0, targetUsd - earnedUsd);
  const progressPct = targetUsd > 0 ? Math.min(100, (earnedUsd / targetUsd) * 100) : 100;

  const msRemaining = input.deadline.getTime() - input.today.getTime();
  const deadlinePassed = msRemaining <= 0;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / MS_PER_DAY));
  const monthsRemaining = Math.max(0, msRemaining / (MS_PER_DAY * DAYS_PER_MONTH));

  // If the deadline has passed, the whole remainder is "needed now".
  const requiredMonthlyUsd = monthsRemaining > 0 ? remainingUsd / monthsRemaining : remainingUsd;

  const avgWonSize = input.wonCount > 0 ? earnedUsd / input.wonCount : DEFAULT_AVG_WON;
  const clientsNeeded = avgWonSize > 0 ? Math.ceil(remainingUsd / avgWonSize) : 0;

  const conversionRatePct =
    input.contactedCount > 0 ? (input.wonCount / input.contactedCount) * 100 : 0;
  const convFraction = conversionRatePct > 0 ? conversionRatePct / 100 : DEFAULT_CONVERSION;

  // clients needed / months → clients per month / conversion → contacts per month / workdays.
  const monthsForRate = monthsRemaining > 0 ? monthsRemaining : 1;
  const clientsPerMonth = clientsNeeded / monthsForRate;
  const contactsPerMonth = convFraction > 0 ? clientsPerMonth / convFraction : 0;
  const suggestedDailyOutreach =
    remainingUsd <= 0 ? 0 : Math.max(0, Math.ceil(contactsPerMonth / WORKDAYS_PER_MONTH));

  return {
    targetUsd,
    earnedUsd,
    remainingUsd,
    progressPct,
    daysRemaining,
    monthsRemaining,
    deadlinePassed,
    requiredMonthlyUsd,
    avgWonSize,
    clientsNeeded,
    conversionRatePct,
    suggestedDailyOutreach,
    pace: paceLabel(suggestedDailyOutreach, remainingUsd),
  };
}
