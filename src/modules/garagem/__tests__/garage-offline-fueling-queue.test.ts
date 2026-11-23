import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enqueueGarageOfflineFueling,
  readGarageOfflineFuelingQueue,
  removeGarageOfflineFueling,
} from "../utils/garage-offline-fueling-queue";

const key = "12345678901234567890123456789012345678901234";
const payload = {
  vehicleId: "v1",
  date: "2026-11-23",
  odometer: 1000,
  fuelType: "GASOLINA",
  quantity: 20,
  unitPrice: 6,
  totalCost: 120,
  fullTank: true,
  nfceKey: key,
};

describe("fila offline de abastecimentos NFC-e", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("is scoped by user and preserves a stable NFC-e id", () => {
    const added = enqueueGarageOfflineFueling("user-1", payload, 123);
    expect(added.ok).toBe(true);
    expect(added.queue[0]?.id).toBe(key);
    expect(readGarageOfflineFuelingQueue("user-1")).toHaveLength(1);
    expect(readGarageOfflineFuelingQueue("user-2")).toHaveLength(0);
  });

  it("does not enqueue duplicate fiscal keys", () => {
    enqueueGarageOfflineFueling("user-1", payload, 123);
    const second = enqueueGarageOfflineFueling("user-1", payload, 456);
    expect(second.duplicate).toBe(true);
    expect(second.queue).toHaveLength(1);
    expect(second.queue[0]?.createdAt).toBe(123);
  });

  it("rejects drafts without a valid 44 digit fiscal key", () => {
    expect(enqueueGarageOfflineFueling("user-1", { ...payload, nfceKey: "bad" }).ok).toBe(false);
  });

  it("removes only the item requested after successful sync", () => {
    enqueueGarageOfflineFueling("user-1", payload, 123);
    expect(removeGarageOfflineFueling("user-1", key)).toBe(true);
    expect(readGarageOfflineFuelingQueue("user-1")).toHaveLength(0);
  });
});
