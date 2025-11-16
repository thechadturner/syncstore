import { createStore } from "solid-js/store";
import { createSignal, onCleanup } from "solid-js";
import { SyncStoreOptions, cleanupFunctions, syncFunctions } from "./types";

/**
 * Creates a reactive store synchronized across browser tabs/windows.
 * Uses BroadcastChannel if available, otherwise falls back to localStorage polling.
 * @param options SyncStoreOptions<T>
 * @returns [store, setStore, sync] tuple
 */
export function createSyncStore<T extends object>(options: SyncStoreOptions<T>) {
  // Ensure options is defined
  if (!options) {
    throw new Error("SyncStore options are required");
  }

  const { key, initialValue, storageType = "broadcast", persistOnLoad = true } = options;

  // Create the Solid store
  const [store, setStore] = createStore<T>(initialValue);

  // Create a function to synchronize data
  const [lastUpdate, setLastUpdate] = createSignal<number>(Date.now());

  // Setup synchronization mechanism
  let channel: BroadcastChannel | null = null;
  let channelClosed = false; // Track if channel has been closed
  let storageListener: ((e: StorageEvent) => void) | null = null;
  let pollingInterval: number | null = null;

  // Type guard for sync data
  const isValidSyncData = (data: any): data is { data: T; timestamp: number } => {
    return (
      data &&
      typeof data === "object" &&
      "data" in data &&
      "timestamp" in data &&
      typeof data.timestamp === "number"
    );
  };

  /**
   * Synchronizes the current store state to other tabs/windows
   * @returns {void}
   */
  const sync = () => {
    const timestamp = Date.now();
    setLastUpdate(timestamp);

    const payload = JSON.stringify({
      data: store,
      timestamp
    });

    try {
      // Always save to localStorage for persistence
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(`syncstore-${key}`, payload);
      }
      
      // Also broadcast if using BroadcastChannel and not closed
      if (storageType === "broadcast" && typeof window !== "undefined" && "BroadcastChannel" in window && channel && !channelClosed) {
        try {
          channel.postMessage(payload);
        } catch (error: any) {
          // Handle closed channel error gracefully
          if (error?.message?.includes("Channel is closed") || error?.name === "InvalidStateError") {
            channelClosed = true;
            channel = null;
            // Continue with localStorage sync - don't throw
          } else {
            throw error; // Re-throw other errors
          }
        }
      }
    } catch (error) {
      console.error("Failed to sync data:", error);
    }
  };

  // Register the sync function
  syncFunctions.set(key, sync);

  // Check for existing data in localStorage
  const loadExistingData = () => {
    if (typeof window === "undefined" || !window.localStorage) return false;
    try {
      const existingData = localStorage.getItem(`syncstore-${key}`);
      if (existingData) {
        const parsedData = JSON.parse(existingData);
        if (isValidSyncData(parsedData)) {
          // Always load existing data regardless of timestamp on initial load
          setStore(() => parsedData.data);
          setLastUpdate(parsedData.timestamp);
          return true; // Indicate that data was loaded
        }
      }
    } catch (error) {
      console.error("Failed to load existing data:", error);
    }
    return false; // Indicate that no data was loaded
  };

  // Initialize synchronization
  if (storageType === "broadcast" && typeof window !== "undefined" && "BroadcastChannel" in window) {
    // Use BroadcastChannel API
    channel = new BroadcastChannel(`syncstore-${key}`);

    channel.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        if (isValidSyncData(parsedData) && parsedData.timestamp > lastUpdate()) {
          setStore(() => parsedData.data);
          setLastUpdate(parsedData.timestamp);
        }
      } catch (error) {
        console.error("Failed to parse sync message:", error);
      }
    };

    // Don't call loadExistingData here - it will be called below
  } else if (typeof window !== "undefined") {
    // Fallback to localStorage polling
    storageListener = (event) => {
      if (event.key === `syncstore-${key}` && event.newValue) {
        try {
          const parsedData = JSON.parse(event.newValue);
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

    // Optional: Poll for changes
    if (options.pollingInterval) {
      let lastData = window.localStorage ? localStorage.getItem(`syncstore-${key}`) : null;

      pollingInterval = window.setInterval(() => {
        try {
          const newData = window.localStorage ? localStorage.getItem(`syncstore-${key}`) : null;

          if (newData !== lastData && newData) {
            const parsedData = JSON.parse(newData);
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

  // Initialize storage with current value - moved outside the if/else blocks
  if (persistOnLoad) {
    const dataLoaded = loadExistingData(); // Attempt to load existing data
    if (!dataLoaded) {
      // Only sync if no existing data was loaded (first time)
      sync();
    }
    // If data was loaded, don't sync to avoid overwriting
  }

  // Cleanup function
  const cleanup = () => {
    if (channel) {
      try {
        channel.close();
      } catch (error) {
        // Ignore errors when closing channel
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
    syncFunctions.delete(key);
    cleanupFunctions.delete(key);
  };

  // Register cleanup function in global registry
  cleanupFunctions.set(key, cleanup);

  // Use onCleanup for automatic cleanup when in reactive context
  onCleanup(cleanup);

  return [store, setStore, sync] as const;
}
