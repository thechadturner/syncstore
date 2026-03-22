export { createSyncSignal } from "./SyncSignal";
export { createSyncStore } from "./SyncStore";
export { isValidSyncData, serializeData, deserializeData } from "./types";
export type { SyncOptions, SyncStoreOptions } from "./types";

import { syncFunctions, cleanupFunctions } from "./types";

/**
 * Get a sync function by its key.
 *
 * Keys are namespaced internally: use the `type` parameter to target the
 * correct primitive. Defaults to `"store"` for backwards compatibility.
 *
 * @param key   The key used when creating the sync store/signal
 * @param type  Whether to look up a store or signal (default: "store")
 * @returns The sync function or undefined if not found
 */
export function getSync(key: string, type: "store" | "signal" = "store"): (() => void) | undefined {
  const prefix = type === "signal" ? "syncsignal-" : "syncstore-";
  return syncFunctions.get(`${prefix}${key}`);
}

/**
 * Check if BroadcastChannel is supported in the current browser
 */
export function isBroadcastSupported(): boolean {
  return typeof window !== "undefined" && typeof window.BroadcastChannel === "function";
}

/**
 * Check if localStorage is supported in the current browser
 */
export function isLocalStorageSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__syncstore_test__";
    localStorage.setItem(testKey, "test");
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Clear all data for a specific sync store or signal.
 * Automatically triggers cleanup for the signal/store if registered.
 * @param key  The key used for the sync store/signal
 * @param type The type of primitive (defaults to "store")
 */
export function clearSyncData(key: string, type: "store" | "signal" = "store"): void {
  try {
    const prefix = type === "signal" ? "syncsignal-" : "syncstore-";
    const registryKey = `${prefix}${key}`;

    const cleanup = cleanupFunctions.get(registryKey);
    if (cleanup) {
      cleanup(); // cleanup itself removes from both maps
    }

    // Clear localStorage data even if no cleanup was registered
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(`${prefix}${key}`);
    }
  } catch (e) {
    console.error("Failed to clear sync data:", e);
  }
}

/**
 * Clear all sync data for all registered signals and stores.
 * Triggers cleanup for all registered primitives and removes all
 * syncsignal-* and syncstore-* entries from localStorage.
 */
export function clearAllSyncData(): void {
  try {
    cleanupFunctions.forEach((cleanup) => {
      try {
        cleanup();
      } catch (e) {
        console.error("Error during cleanup:", e);
      }
    });

    if (typeof window !== "undefined" && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("syncstore-") || key.startsWith("syncsignal-"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }

    syncFunctions.clear();
    cleanupFunctions.clear();
  } catch (e) {
    console.error("Failed to clear all sync data:", e);
  }
}

/**
 * Get all available sync store keys from localStorage
 */
export function getSyncStoreKeys(): string[] {
  if (!isLocalStorageSupported()) return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("syncstore-")) {
      keys.push(key.replace("syncstore-", ""));
    }
  }
  return keys;
}

/**
 * Get all available sync signal keys from localStorage
 */
export function getSyncSignalKeys(): string[] {
  if (!isLocalStorageSupported()) return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("syncsignal-")) {
      keys.push(key.replace("syncsignal-", ""));
    }
  }
  return keys;
}
