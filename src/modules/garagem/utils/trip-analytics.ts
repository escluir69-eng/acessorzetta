import type { TripPlan } from "@/types/orion";
import type { FuelingRecord, PersonalVehicle, RouteTrip, PersonalVehicleExpense } from "../types/garage.types";

export interface TripAnalyticsReport {
  tripId: string;
  destination: string;
  distanceKm: number;
  routes: RouteTrip[];
  fuelings: FuelingRecord[];
  expenses: PersonalVehicleExpense[];
  fuelCost: number;
  tollCost: number;
  otherExpenseCost: number;
  totalCost: number;
  costPerKm: number | null;
  averageConsumption: number | null;
  estimatedRange: number | null;
  attributionNote: string;
}

/**
 * Relatório estimado de viagem. Percursos são associados por tripId;
 * abastecimentos e gastos não possuem vínculo direto à viagem no modelo atual,
 * então são filtrados por veículo e janela de datas e sinalizados como estimativas.
 */
export function buildTripAnalyticsReport(
  trip: TripPlan,
  routes: RouteTrip[],
  fuelings: FuelingRecord[],
  expenses: PersonalVehicleExpense[],
  vehicle?: PersonalVehicle,
): TripAnalyticsReport {
  const tripRoutes = routes.filter(
    (route) => route.tripId === trip.id && (route.status ?? "CONCLUIDA") === "CONCLUIDA",
  );
  const routeDistance = tripRoutes.reduce((sum, route) => sum + Math.max(0, route.distanceKm), 0);
  const tripVehicleId = tripRoutes[0]?.vehicleId;
  const inWindow = (date: string) => date >= trip.startDate && date <= trip.endDate;
  const tripFuelings = fuelings.filter(
    (fuel) => (!tripVehicleId || fuel.vehicleId === tripVehicleId) && inWindow(fuel.date),
  );
  const tripExpenses = expenses.filter(
    (expense) => (!tripVehicleId || expense.vehicleId === tripVehicleId) && inWindow(expense.date),
  );

  const fuelCost = tripFuelings.reduce((sum, fuel) => sum + Math.max(0, fuel.totalCost), 0);
  const tollCost = tripExpenses
    .filter((expense) => expense.category.toLowerCase().includes("pedágio"))
    .reduce((sum, expense) => sum + Math.max(0, expense.amount), 0);
  const otherExpenseCost = tripExpenses
    .filter((expense) => !expense.category.toLowerCase().includes("pedágio"))
    .reduce((sum, expense) => sum + Math.max(0, expense.amount), 0);
  const totalCost = fuelCost + tollCost + otherExpenseCost;
  const costPerKm = routeDistance > 0 ? totalCost / routeDistance : null;

  const consumptionSamples = tripFuelings
    .map((fuel) => fuel.calculatedAvg)
    .filter((avg): avg is number => typeof avg === "number" && avg > 0 && Number.isFinite(avg));
  const averageConsumption =
    consumptionSamples.length > 0
      ? consumptionSamples.reduce((sum, value) => sum + value, 0) / consumptionSamples.length
      : null;
  const estimatedRange =
    averageConsumption && vehicle?.tankCapacityLiters && vehicle.tankCapacityLiters > 0
      ? averageConsumption * vehicle.tankCapacityLiters
      : null;

  return {
    tripId: trip.id,
    destination: trip.destination,
    distanceKm: routeDistance,
    routes: tripRoutes,
    fuelings: tripFuelings,
    expenses: tripExpenses,
    fuelCost,
    tollCost,
    otherExpenseCost,
    totalCost,
    costPerKm,
    averageConsumption,
    estimatedRange,
    attributionNote:
      "Percursos consideram somente registros concluídos vinculados à viagem. Abastecimentos e despesas são estimativas por veículo e datas; sem vínculo individual, podem incluir lançamentos de outras atividades.",
  };
}
