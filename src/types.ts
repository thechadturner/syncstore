import { Accessor, Setter } from "solid-js";
import type { SetStoreFunction, Store } from "solid-js/store";

/**
 * Configuration options for createSyncSignal
 */
export interface SyncOptions<T> {
  /**
   * Unique key for this signal to sync across tabs/windows
   */
  key: string;

  /**
   * Type of synchronization to use
   * - "broadcast": Use BroadcastChannel API (falls back to localStorage if not supported)
   * - "localStorage": Always use localStorage
   * @default "broadcast"
   */
  storageType?: "broadcast" | "localStorage";

  /**
   * Whether to save the initial state when the signal is created
   * @default true
   */
  persistOnLoad?: boolean;

  /**
   * Time in milliseconds between polling checks (localStorage fallback only)
   */
  pollingInterval?: number;

  /**
   * Time in milliseconds to throttle auto-sync updates
   * @default 50
   */
  throttleMs?: number;

  /**
   * Whether to automatically sync when value changes
   * @default false
   */
  autoSync?: boolean;
}

/**
 * Configuration options for createSyncStore
 */
export interface SyncStoreOptions<T extends object> {
  /**
   * Unique key for this store across tabs/windows
   */
  key: string;

  /**
   * Initial value for the store
   */
  initialValue: T;

  /**
   * Storage mechanism to use
   * - "broadcast": Use BroadcastChannel API (falls back to localStorage if not supported)
   * - "localStorage": Always use localStorage
   * @default "broadcast"
   */
  storageType?: "broadcast" | "localStorage";

  /**
   * Whether to load the store's initial value from storage on initialization
   * @default true
   */
  persistOnLoad?: boolean;

  /**
   * Interval in milliseconds to poll for localStorage changes
   * Only used when BroadcastChannel is not available or storageType is "localStorage"
   * @default undefined (no polling)
   */
  pollingInterval?: number;
}

// Export the syncFunctions map for internal use
export const syncFunctions: Map<string, () => void> = new Map();

// Registry for cleanup functions (signals and stores)
export const cleanupFunctions: Map<string, () => void> = new Map();

// Additional types that may be useful for consumers
export type SyncFunction = () => void;

export type SyncStoreTuple<T extends object> = [
  Store<T>,
  SetStoreFunction<T>,
  () => void
];

export type SyncSignalTuple<T> = [
  Accessor<T>,
  Setter<T>,
  () => void
];

/**
 * A synchronizable signal tuple containing the accessor, setter, and sync function
 */
export type SyncSignal<T> = [Accessor<T>, Setter<T>, () => void];

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Type guard to validate sync data structure
 */
export const isValidSyncData = (data: any): data is { data: any; timestamp: number } => {
  return (
    data !== null &&
    typeof data === "object" &&
    "data" in data &&
    "timestamp" in data &&
    typeof data.timestamp === "number"
  );
};

/**
 * Serialize data for cross-tab transport, preserving Date objects.
 *
 * Uses a regular function (not arrow) so `this[key]` gives the original value
 * before JSON.stringify calls Date.prototype.toJSON() and converts it to a
 * string, which would cause `instanceof Date` to never match.
 */
export const serializeData = (data: any): string => {
  return JSON.stringify(data, function (key, value) {
    // Check the raw property value before toJSON() conversion
    const raw = key === "" ? data : (this as any)[key];
    if (raw instanceof Date) {
      return { __type: "Date", value: raw.toISOString() };
    }
    return value;
  });
};

/**
 * Deserialize data from cross-tab transport, restoring Date objects
 */
export const deserializeData = (raw: string): any => {
  return JSON.parse(raw, (_key, value) => {
    if (value && typeof value === "object" && value.__type === "Date") {
      const date = new Date(value.value);
      if (isNaN(date.getTime())) {
        console.error(`Failed to deserialize Date value: ${value.value}`);
        return value.value;
      }
      return date;
    }
    return value;
  });
};
