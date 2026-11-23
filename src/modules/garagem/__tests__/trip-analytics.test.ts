import { describe, expect, it } from "vitest";
import { buildTripAnalyticsReport } from "../utils/trip-analytics";
import type { TripPlan } from "@/types/orion";
import type { FuelingRecord, PersonalVehicle, RouteTrip, PersonalVehicleExpense } from "../types/garage.types";

const trip: TripPlan = { id: "t1", destination: "Brasília–Goiânia", startDate: "2026-11-01", endDate: "2026-11-03", budgetCents: 0, spentCents: 0, notes: "", status: "Concluída" };
const route: RouteTrip = { id: "r1", vehicleId: "v1", tripId: "t1", date: "2026-11-02", origin: "Brasília", destination: "Goiânia", startOdometer: 1000, endOdometer: 250, distanceKm: 250, status: "CONCLUIDA" };
const fuel: FuelingRecord = { id: "f1", vehicleId: "v1", date: "2026-11-02", odometer: 1200, fuelType: "GASOLINA", quantity: 30, unitPrice: 6, totalCost: 180, fullTank: true, calculatedAvg: 10 };
const toll: PersonalVehicleExpense = { id: "e1", vehicleId: "v1", category: "Pedágio / Tag Sem Parar", date: "2026-11-02", amount: 24, description: "Pedágios" };
const other: PersonalVehicleExpense = { id: "e2", vehicleId: "v1", category: "Estacionamento", date: "2026-11-02", amount: 15 };
const vehicle: PersonalVehicle = { id: "v1", name: "Carro", brand: "Marca", model: "Modelo", plate: "ABC1234", year: 2020, fuelType: "GASOLINA", currentOdometer: 2500, status: "ATIVO", tankCapacityLiters: 50 };

describe("buildTripAnalyticsReport", () => {
  it("agrega rotas concluidas vinculadas, custos na janela e estimativas", () => {
    const report = buildTripAnalyticsReport(trip, [route], [fuel], [toll, other], vehicle);
    expect(report.distanceKm).toBe(250);
    expect(report.fuelCost).toBe(180);
    expect(report.tollCost).toBe(24);
    expect(report.otherExpenseCost).toBe(15);
    expect(report.totalCost).toBe(219);
    expect(report.costPerKm).toBeCloseTo(0.876);
    expect(report.averageConsumption).toBe(10);
    expect(report.estimatedRange).toBe(500);
    expect(report.attributionNote).toContain("estimativas");
  });

  it("ignora percurso aberto e abastecimentos/gastos fora da janela", () => {
    const openRoute = { ...route, id: "r2", status: "EM_ANDAMENTO" as const };
    const outFuel = { ...fuel, id: "f2", date: "2026-11-10" };
    const outExpense = { ...other, id: "e3", date: "2026-11-10" };
    const report = buildTripAnalyticsReport(trip, [route, openRoute], [fuel, outFuel], [toll, outExpense], vehicle);
    expect(report.routes).toHaveLength(1);
    expect(report.fuelings).toHaveLength(1);
    expect(report.expenses).toHaveLength(1);
    expect(report.totalCost).toBe(204);
  });
});
