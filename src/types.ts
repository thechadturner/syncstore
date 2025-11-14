import { Accessor, Setter } from "solid-js";
import type { SetStoreFunction, Store } from "solid-js/store";

/**
 * Configuration options for sync functions
 */
export interface SyncOptions<T> {
  /**
   * Unique key for this store to sync across tabs/windows
   */
  key: string;
  
  /**
   * Type of synchronization to use
   */
  storageType?: "broadcast" | "local";

  /**
   * Whether to save the initial state when store is created
   */
  persistOnLoad?: boolean;

  /**
   * Time in milliseconds between polling checks
   */
  pollingInterval?: number;

  /**
   * Time in milliseconds to throttle updates
   */
  throttleMs?: number;

  /**
   * Whether to automatically sync when value changes
   */
  autoSync?: boolean;
}

// Export the syncFunctions map for internal use
export const syncFunctions: Map<string, () => void> = new Map();

// Registry for cleanup functions (signals and stores)
export const cleanupFunctions: Map<string, () => void> = new Map();

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

/**
 * Configuration options for createSyncSignal
 */
export interface SyncSignalOptions<T> extends SyncOptions<T> {
  /**
   * Initial value for the signal
   */
  initialValue?: T;
}

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
