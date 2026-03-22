import { createStore } from "solid-js/store";
import { createSignal, getOwner, onCleanup } from "solid-js";
import {
  SyncStoreOptions,
  cleanupFunctions,
  syncFunctions,
  isValidSyncData,
  serializeData,
  deserializeData,
} from "./types";

/**
 * Creates a reactive store synchronized across browser tabs/windows.
 * Uses BroadcastChannel if available, otherwise falls back to localStorage events.
 * @param options SyncStoreOptions<T>
 * @returns [store, setStore, sync] tuple
 */
export function createSyncStore<T extends object>(options: SyncStoreOptions<T>) {
  if (!options) {
    throw new Error("SyncStore options are required");
  }

  const {
    key,
    initialValue,
    storageType = "broadcast",
    persistOnLoad = true,
  } = options;

  const registryKey = `syncstore-${key}`;
  const storageKey = `syncstore-${key}`;

  const [store, setStore] = createStore<T>(initialValue);
  const [lastUpdate, setLastUpdate] = createSignal<number>(Date.now());

  const useBroadcast =
    storageType === "broadcast" &&
    typeof window !== "undefined" &&
    typeof window.BroadcastChannel === "function";

  let channel: BroadcastChannel | null = null;
  let channelClosed = false;
  let storageListener: ((e: StorageEvent) => void) | null = null;
  let pollingInterval: number | null = null;

  /**
   * Synchronizes the current store state to other tabs/windows
   */
  const sync = () => {
    const timestamp = Date.now();
    setLastUpdate(timestamp);

    const payload = serializeData({ data: store, timestamp });

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(storageKey, payload);
      }

      if (useBroadcast && channel && !channelClosed) {
        try {
          channel.postMessage(payload);
        } catch (error: any) {
          if (error?.message?.includes("Channel is closed") || error?.name === "InvalidStateError") {
            channelClosed = true;
            channel = null;
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error("Failed to sync data:", error);
    }
  };

  // Register the sync function under namespaced key
  syncFunctions.set(registryKey, sync);

  // Load persisted data from localStorage
  const loadExistingData = (): boolean => {
    if (typeof window === "undefined" || !window.localStorage) return false;
    try {
      const existingData = localStorage.getItem(storageKey);
      if (existingData) {
        const parsedData = deserializeData(existingData);
        if (isValidSyncData(parsedData)) {
          setStore(() => parsedData.data);
          setLastUpdate(parsedData.timestamp);
          return true;
        }
      }
    } catch (error) {
      console.error("Failed to load existing data:", error);
    }
    return false;
  };

  // Set up transport
  if (useBroadcast) {
    channel = new BroadcastChannel(storageKey);

    channel.onmessage = (event) => {
      try {
        const parsedData = deserializeData(event.data);
        if (isValidSyncData(parsedData) && parsedData.timestamp > lastUpdate()) {
          setStore(() => parsedData.data);
          setLastUpdate(parsedData.timestamp);
        }
      } catch (error) {
        console.error("Failed to parse sync message:", error);
      }
    };
  } else if (typeof window !== "undefined") {
    // Fallback: storage event
    storageListener = (event) => {
      if (event.key === storageKey && event.newValue) {
        try {
          const parsedData = deserializeData(event.newValue);
          if (isValidSyncData(parsedData) && parsedData.timestamp > lastUpdate()) {
            setStore(() => parsedData.data);
            setLastUpdate(parsedData.timestamp);
          }
        } catch (error) {
          console.error("Failed to parse localStorage data:", error);
        }
      }
    };

    window.addEventListener("storage", storageListener);

    // Optional polling
    if (options.pollingInterval) {
      let lastData = window.localStorage ? localStorage.getItem(storageKey) : null;

      pollingInterval = window.setInterval(() => {
        try {
          const newData = window.localStorage ? localStorage.getItem(storageKey) : null;

          if (newData !== lastData && newData) {
            const parsedData = deserializeData(newData);
            if (isValidSyncData(parsedData) && parsedData.timestamp > lastUpdate()) {
              setStore(() => parsedData.data);
              setLastUpdate(parsedData.timestamp);
            }
            lastData = newData;
          }
        } catch (error) {
          console.error("Failed to poll data:", error);
        }
      }, options.pollingInterval);
    }
  }

  if (persistOnLoad) {
    const dataLoaded = loadExistingData();
    if (!dataLoaded) {
      sync();
    }
  }

  // Cleanup
  const cleanup = () => {
    if (channel) {
      try {
        channel.close();
      } catch {
        // ignore errors on close
      }
      channelClosed = true;
      channel = null;
    }
    if (storageListener && typeof window !== "undefined") {
      window.removeEventListener("storage", storageListener);
    }
    if (pollingInterval !== null) {
      window.clearInterval(pollingInterval);
    }
    syncFunctions.delete(registryKey);
    cleanupFunctions.delete(registryKey);
  };

  cleanupFunctions.set(registryKey, cleanup);

  // Only register onCleanup when inside a reactive owner (component/effect)
  if (getOwner()) {
    onCleanup(cleanup);
  }

  return [store, setStore, sync] as const;
}
