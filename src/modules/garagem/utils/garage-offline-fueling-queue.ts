export interface GarageOfflineFuelingDraft {
  vehicleId: string;
  driverId?: string;
  tripId?: string;
  date: string;
  odometer: number;
  fuelType: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  fullTank: boolean;
  stationName?: string;
  nfceKey: string;
  notes?: string;
}

export interface GarageOfflineFuelingQueueItem {
  id: string;
  createdAt: number;
  payload: GarageOfflineFuelingDraft;
}

const STORAGE_PREFIX = "orion.garage.offline-fueling.v1";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function isValidItem(value: unknown): value is GarageOfflineFuelingQueueItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GarageOfflineFuelingQueueItem>;
  return typeof item.id === "string" && typeof item.createdAt === "number" &&
    !!item.payload && typeof item.payload === "object" &&
    typeof item.payload.nfceKey === "string" && /^\d{44}$/.test(item.payload.nfceKey);
}

/** Reads a user-scoped, NFC-e-only queue. Invalid entries are discarded. */
export function readGarageOfflineFuelingQueue(userId: string): GarageOfflineFuelingQueueItem[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidItem) : [];
  } catch {
    return [];
  }
}

/** Persist a queue snapshot; returns false if browser storage is unavailable or full. */
export function writeGarageOfflineFuelingQueue(
  userId: string,
  items: GarageOfflineFuelingQueueItem[],
): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(items.filter(isValidItem)));
    return true;
  } catch {
    return false;
  }
}

/** Adds only NFC-e-backed drafts; the fiscal key is the stable replay identity. */
export function enqueueGarageOfflineFueling(
  userId: string,
  payload: GarageOfflineFuelingDraft,
  now = Date.now(),
): { ok: boolean; duplicate: boolean; queue: GarageOfflineFuelingQueueItem[] } {
  if (!userId || !/^\d{44}$/.test(payload.nfceKey)) {
    return { ok: false, duplicate: false, queue: [] };
  }
  const queue = readGarageOfflineFuelingQueue(userId);
  const duplicate = queue.some((item) => item.id === payload.nfceKey);
  if (duplicate) return { ok: true, duplicate: true, queue };
  const item = { id: payload.nfceKey, createdAt: now, payload };
  const next = [...queue, item];
  return { ok: writeGarageOfflineFuelingQueue(userId, next), duplicate: false, queue: next };
}

/** Removes a queued item only after a server write is confirmed. */
export function removeGarageOfflineFueling(userId: string, itemId: string): boolean {
  const queue = readGarageOfflineFuelingQueue(userId);
  return writeGarageOfflineFuelingQueue(userId, queue.filter((item) => item.id !== itemId));
}
