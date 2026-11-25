import { clampDueDate } from "@/lib/domain/money";
import { resolveActivePaymentEvents, validIsoDate } from "@/lib/domain/ledgerHistory";
import type { OrionState } from "@/types/orion";

export const GENERIC_PAYMENT_DATE = "2026-11-15";
export type PaymentDateRepair = {
  collection: "paymentEvents" | "monthlyBills" | "payableInstallments" | "annualExpenses";
  id: string;
  dates: Record<string, string>;
};

function competenceDueDate(dueDate: string | null | undefined, period?: string): string | null {
  const due = validIsoDate(dueDate);
  if (!due) return null;
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return due;
  return clampDueDate(Number(period.slice(0, 4)), Number(period.slice(5)), Number(due.slice(8)));
}

/** Only the explicitly requested generic date is eligible; no monetary fields are changed. */
export function planGenericPaymentDateRepair(state: OrionState): PaymentDateRepair[] {
  const plan: PaymentDateRepair[] = [];
  const add = (collection: PaymentDateRepair["collection"], id: string, paidDate: string | null, due: string | null) => {
    if (paidDate === GENERIC_PAYMENT_DATE && due && due !== paidDate) {
      plan.push({ collection, id, dates: { paidDate: due } });
    }
  };
  for (const bill of state.monthlyBills) {
    add("monthlyBills", bill.id, bill.paidDate, competenceDueDate(bill.dueDate, bill.period));
  }
  for (const inst of state.payableInstallments) {
    add("payableInstallments", inst.id, inst.paidDate, validIsoDate(inst.dueDate));
  }
  for (const event of resolveActivePaymentEvents(state.paymentEvents)) {
    const bill = state.monthlyBills.find((b) => b.id === event.billId);
    const inst = state.payableInstallments.find((i) => i.id === event.installmentId);
    const annual = state.annualExpenses.find((a) => a.id === event.annualRowId);
    const period = event.period ?? bill?.period ?? inst?.dueDate.slice(0, 7);
    const annualDue = annual && period
      ? clampDueDate(Number(period.slice(0, 4)), Number(period.slice(5)), annual.dueDay)
      : null;
    add("paymentEvents", event.id, event.paidDate,
      competenceDueDate(bill?.dueDate ?? inst?.dueDate ?? annualDue ?? event.dueDate, period));
  }
  for (const row of state.annualExpenses) {
    const dates: Record<string, string> = {};
    for (const [month, cell] of Object.entries(row.months)) {
      const due = validIsoDate(clampDueDate(row.year, Number(month), row.dueDay));
      if (cell.paidDate === GENERIC_PAYMENT_DATE && due && due !== cell.paidDate) dates[month] = due;
    }
    if (Object.keys(dates).length) plan.push({ collection: "annualExpenses", id: row.id, dates });
  }
  return plan;
}