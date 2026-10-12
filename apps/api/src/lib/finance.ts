import { Prisma } from "@prisma/client";

/**
 * Payment plans (hisob-kitob).
 *   FULL         one payment, due 5 days after the contract is created
 *   INSTALLMENT  down payment (downPercent %) + `months` equal monthly instalments, optional annual markup (ratePercent)
 * Amounts are whole so'm; rounding remainder goes to the last instalment so the schedule always sums exactly.
 */
export type PlanInput = { planType: "FULL" | "INSTALLMENT"; downPercent?: number; months?: number; ratePercent?: number };
export type ScheduleRow = { seq: number; dueDate: Date; amount: number; principal: number; interest: number; balanceAfter: number };

export const PLAN_LIMITS = { minDown: 20, maxMonths: 60, monthsOptions: [6, 12, 18, 24, 36, 48, 60] };

export function buildSchedule(total: number, plan: PlanInput, start = new Date()): ScheduleRow[] {
  const due = (days: number) => new Date(start.getTime() + days * 86400_000);
  if (plan.planType === "FULL" || !plan.months) {
    return [{ seq: 0, dueDate: due(5), amount: Math.round(total), principal: Math.round(total), interest: 0, balanceAfter: 0 }];
  }
  const down = Math.round((total * (plan.downPercent ?? 30)) / 100);
  const principal = total - down;
  const months = plan.months;
  const r = (plan.ratePercent ?? 0) / 100 / 12;
  // annuity when there is a markup, equal principal otherwise
  const monthly = r > 0 ? (principal * r) / (1 - (1 + r) ** -months) : principal / months;
  const rows: ScheduleRow[] = [{ seq: 0, dueDate: due(5), amount: down, principal: down, interest: 0, balanceAfter: principal }];
  let balance = principal;
  for (let i = 1; i <= months; i++) {
    const interest = Math.round(balance * r);
    let amount = Math.round(monthly);
    let princ = amount - interest;
    if (i === months) {
      princ = balance;
      amount = princ + interest;
    }
    balance -= princ;
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    rows.push({ seq: i, dueDate: d, amount, principal: princ, interest, balanceAfter: Math.max(0, balance) });
  }
  return rows;
}

export function summarize(rows: ScheduleRow[]) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const interest = rows.reduce((s, r) => s + r.interest, 0);
  return { total, interest, down: rows[0]?.amount ?? 0, monthly: rows[1]?.amount ?? 0, count: rows.length };
}

export const dec = (n: number) => new Prisma.Decimal(Math.round(n));
