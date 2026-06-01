import type { ScoredItem } from "@/lib/types";

export type HealthScoreInput = {
  items: ScoredItem[];
  daysSinceLastImport: number | null;
  actionsThisMonth: number;
  recoveredThisMonth: number;
};

export type HealthScoreResult = {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;
  deductions: { reason: string; points: number }[];
  bonuses: { reason: string; points: number }[];
};

export function calcOperationalHealthScore(input: HealthScoreInput): HealthScoreResult {
  const { items, daysSinceLastImport, actionsThisMonth, recoveredThisMonth } = input;
  const active = items.filter((i) => i.status === "active");

  const deductions: { reason: string; points: number }[] = [];
  const bonuses: { reason: string; points: number }[] = [];

  let score = 100;

  // Dead inventory deduction: -1 per 5% dead, capped at -30
  if (active.length > 0) {
    const deadCount = active.filter((i) => i.dead_inventory_score >= 50).length;
    const deadPct = Math.round((deadCount / active.length) * 100);
    const deadPenalty = Math.min(30, Math.floor(deadPct / 5));
    if (deadPenalty > 0) {
      deductions.push({ reason: `${deadPct}% dead inventory`, points: deadPenalty });
      score -= deadPenalty;
    }
  }

  // Critical items: -3 each, capped at -20
  if (active.length > 0) {
    const critCount = active.filter((i) => i.dead_inventory_score >= 75).length;
    const critPenalty = Math.min(20, critCount * 3);
    if (critPenalty > 0) {
      deductions.push({ reason: `${critCount} critical item${critCount !== 1 ? "s" : ""}`, points: critPenalty });
      score -= critPenalty;
    }
  }

  // Import staleness
  if (daysSinceLastImport === null) {
    deductions.push({ reason: "No import on record", points: 20 });
    score -= 20;
  } else if (daysSinceLastImport >= 30) {
    deductions.push({ reason: `No import in ${daysSinceLastImport} days`, points: 15 });
    score -= 15;
  } else if (daysSinceLastImport >= 7) {
    deductions.push({ reason: `No import in ${daysSinceLastImport} days`, points: 5 });
    score -= 5;
  }

  // Avg listing age
  if (active.length > 0) {
    const avgDays = active.reduce((s, i) => s + i.days_listed, 0) / active.length;
    if (avgDays > 180) {
      deductions.push({ reason: `Avg listing age ${Math.round(avgDays)} days`, points: 10 });
      score -= 10;
    } else if (avgDays > 90) {
      deductions.push({ reason: `Avg listing age ${Math.round(avgDays)} days`, points: 5 });
      score -= 5;
    }
  }

  // Bonuses
  if (actionsThisMonth > 0) {
    bonuses.push({ reason: `${actionsThisMonth} recovery action${actionsThisMonth !== 1 ? "s" : ""} this month`, points: 5 });
    score += 5;
  }
  if (recoveredThisMonth > 0) {
    bonuses.push({ reason: "Recovered cash this month", points: 5 });
    score += 5;
  }

  score = Math.max(0, Math.min(100, score));

  const grade: HealthScoreResult["grade"] =
    score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "F";

  const label =
    grade === "A" ? "Healthy" :
    grade === "B" ? "Good" :
    grade === "C" ? "Needs Attention" :
    grade === "D" ? "At Risk" : "Critical";

  return { score, grade, label, deductions, bonuses };
}
