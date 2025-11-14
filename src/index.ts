// Export main functionality
export { createSyncSignal, isValidSyncData } from "./SyncSignal";
export { createSyncStore } from "./SyncStore";
export type { SyncOptions, SyncStoreOptions } from "./types";

// Import the syncFunctions and cleanupFunctions maps for utility functions
import { syncFunctions, cleanupFunctions } from "./types";

/**
 * Get a sync function by its key
 * @param key The key used when creating the sync store/signal
 * @returns The sync function or undefined if not found
 */
export function getSync(key: string): (() => void) | undefined {
  return syncFunctions.get(key);
}

/**
 * Check if BroadcastChannel is supported in the current browser
 */
export function isBroadcastSupported(): boolean {
  return typeof window !== "undefined" && "BroadcastChannel" in window;
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
 * Clear all data for a specific sync store or signal
 * Automatically triggers cleanup for the signal/store if registered
 * @param key The key used for the sync store/signal
 * @param type The type of store (defaults to "store")
 */
export function clearSyncData(key: string, type: "store" | "signal" = "store"): void {
  try {
    // Trigger cleanup if registered
    const cleanup = cleanupFunctions.get(key);
    if (cleanup) {
      cleanup();
    }

    // Clear localStorage data
    if (typeof window !== "undefined" && window.localStorage) {
      const prefix = type === "signal" ? "syncsignal-" : "syncstore-";
      localStorage.removeItem(`${prefix}${key}`);
    }

    // Remove from registries
    syncFunctions.delete(key);
    cleanupFunctions.delete(key);
  } catch (e) {
    console.error("Failed to clear sync data:", e);
  }
}

/**
 * Clear all sync data for all registered signals and stores
 * This will trigger cleanup for all registered signals/stores and clear all localStorage data
 */
export function clearAllSyncData(): void {
  try {
    // Trigger cleanup for all registered signals/stores
    cleanupFunctions.forEach((cleanup) => {
      try {
        cleanup();
      } catch (e) {
        console.error("Error during cleanup:", e);
      }
    });

    // Clear all localStorage data
    if (typeof window !== "undefined" && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('syncstore-') || key.startsWith('syncsignal-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }

    // Clear registries
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
    if (key && key.startsWith('syncstore-')) {
      keys.push(key.replace('syncstore-', ''));
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
    if (key && key.startsWith('syncsignal-')) {
      keys.push(key.replace('syncsignal-', ''));
    }
  }
  return keys;
}
