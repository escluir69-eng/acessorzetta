import { describe, expect, it } from "vitest";
import { createEmptyOrionState } from "@/types/orion";
import { buildPaymentHistoryRows, buildReceiptHistoryRows, extractAvailableHistoryYears, filterHistoryRows, groupHistoryByMonth, suggestedExpensePaymentDate } from "@/lib/domain/ledgerHistory";
import { planGenericPaymentDateRepair } from "@/lib/domain/paymentDateRepair";

function paymentState() {
  const state = createEmptyOrionState();
  state.monthlyBills = ["09", "10", "11"].map((month) => ({
    id: `bill-${month}`, period: `2026-${month}`, creditor: "Energia", category: "Moradia",
    dueDate: `2026-${month}-10`, expectedCents: 25000, paidCents: 25000,
    paidDate: "2026-11-15", isSettled: true,
  }));
  return state;
}

describe("regimes do histórico", () => {
  it("separa competências 2026-09 e 2026-10 sem transferi-las para novembro; caixa mantém novembro", () => {
    const rows = buildPaymentHistoryRows(paymentState());
    expect(groupHistoryByMonth(rows, "payment", "cash").map((g) => [g.key, g.rowCount])).toEqual([["2026-11", 3]]);
    expect(groupHistoryByMonth(rows, "payment", "competence").map((g) => [g.key, g.rowCount])).toEqual([["2026-11", 1], ["2026-10", 1], ["2026-09", 1]]);
    expect(filterHistoryRows(rows, { year: "2026", month: "09", party: "", regime: "competence" }).map((r) => r.primaryTargetId)).toEqual(["bill-09"]);
  });
  it("prioriza o período da obrigação mesmo se o vencimento ou pagamento estiver em outro ano", () => {
    const state = paymentState();
    const bill = state.monthlyBills[0];
    if (!bill) throw new Error("Missing fixture");
    state.monthlyBills = [{ ...bill, period: "2025-12", dueDate: "2026-01-10" }];
    const rows = buildPaymentHistoryRows(state);
    expect(extractAvailableHistoryYears(rows, "competence")).toEqual(["2025"]);
    expect(groupHistoryByMonth(rows, "payment", "competence").map((g) => g.key)).toEqual(["2025-12"]);
  });
  it("agrupa recebimentos por vencimento em competência e preserva caixa", () => {
    const state = createEmptyOrionState();
    state.revenueEntries = [{ id: "rev", title: "Aluguel", category: "Aluguel", dueDate: "2026-09-10", expectedCents: 10000, receivedCents: 10000, receivedDate: "2026-11-15" }];
    const rows = buildReceiptHistoryRows(state);
    expect(groupHistoryByMonth(rows, "receipt", "competence").map((g) => g.key)).toEqual(["2026-09"]);
    expect(groupHistoryByMonth(rows, "receipt").map((g) => g.key)).toEqual(["2026-11"]);
  });
});

describe("sugestão ao quitar meses anteriores", () => {
  it("usa vencimento em setembro e outubro, não hoje em novembro de 2026", () => {
    expect(suggestedExpensePaymentDate("2026-09-10", "2026-11-25")).toBe("2026-09-10");
    expect(suggestedExpensePaymentDate("2026-10-31", "2026-11-25", "2026-10")).toBe("2026-10-31");
  });
  it("mantém hoje para competência atual e futura", () => {
    expect(suggestedExpensePaymentDate("2026-11-10", "2026-11-25")).toBe("2026-11-25");
    expect(suggestedExpensePaymentDate("2026-12-10", "2026-11-25")).toBe("2026-11-25");
  });
});

describe("correção explícita de 15/11/2026", () => {
  it("planeja apenas mudanças de datas e preserva valores e dados originais", () => {
    const state = paymentState();
    const original = JSON.stringify(state);
    expect(planGenericPaymentDateRepair(state)).toEqual(["09", "10", "11"].map((month) => ({ collection: "monthlyBills", id: `bill-${month}`, dates: { paidDate: `2026-${month}-10` } })));
    expect(JSON.stringify(state)).toBe(original);
  });
  it("corrige eventos ativos e células anuais, preservando outras datas e eventos estornados", () => {
    const state = paymentState();
    state.paymentEvents = [{ id: "ev", billId: "bill-09", creditor: "Energia", dueDate: "2026-09-10", expectedCents: 25000, paidCents: 25000, paidDate: "2026-11-15", isSettled: true, kind: "pagamento", reason: "Quitado", eventCreatedAt: "2026-11-15T12:00:00Z" }];
    state.annualExpenses = [{ id: "annual", year: 2026, creditor: "Condomínio", category: "Moradia", dueDay: 31, months: {
      "09": { expectedCents: 25000, paidCents: 25000, paidDate: "2026-11-15", isSettled: true },
      "10": { expectedCents: 25000, paidCents: 25000, paidDate: "2026-10-29", isSettled: true },
    } }];
    const plan = planGenericPaymentDateRepair(state);
    expect(plan.find((p) => p.id === "ev")?.dates).toEqual({ paidDate: "2026-09-10" });
    expect(plan.find((p) => p.id === "annual")?.dates).toEqual({ "09": "2026-09-30" });
    state.paymentEvents.push({ ...state.paymentEvents[0], id: "reverse", targetEventId: "ev", kind: "estorno", paidCents: 0, paidDate: null, isSettled: false, creditor: "Energia", dueDate: "2026-09-10", expectedCents: 25000, reason: "Estorno", eventCreatedAt: "2026-11-16T12:00:00Z" });
    expect(planGenericPaymentDateRepair(state).some((p) => p.id === "ev")).toBe(false);
  });
  it("não repete reparos após datas corrigidas", () => {
    const state = paymentState();
    state.monthlyBills = state.monthlyBills.map((bill) => ({ ...bill, paidDate: bill.dueDate }));
    expect(planGenericPaymentDateRepair(state)).toEqual([]);
  });
});