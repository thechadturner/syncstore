import { createSignal, getOwner, onCleanup } from "solid-js";
import { SyncOptions, syncFunctions, cleanupFunctions, isValidSyncData, serializeData, deserializeData } from "./types";

/**
 * Creates a reactive signal synchronized across browser tabs/windows.
 * @param initialValue Initial value of the signal
 * @param options Synchronization options
 * @returns [value, setValue, sync] tuple
 */
export function createSyncSignal<T>(
  initialValue: T,
  options: SyncOptions<T>
) {
  const {
    key,
    throttleMs = 50,
    autoSync = false,
    pollingInterval,
    persistOnLoad = true,
    storageType = "broadcast",
  } = options;

  const registryKey = `syncsignal-${key}`;
  const storageKey = `syncsignal-${key}`;

  const [value, _setValue] = createSignal<T>(initialValue);
  let setValue = _setValue;
  const [lastUpdate, setLastUpdate] = createSignal<number>(Date.now());

  const useBroadcast =
    storageType === "broadcast" &&
    typeof window !== "undefined" &&
    typeof window.BroadcastChannel === "function";

  let channel: BroadcastChannel | null = null;
  let channelClosed = false;
  let storageListener: ((event: StorageEvent) => void) | null = null;
  let pollingIntervalId: number | null = null;
  let throttleTimeout: number | null = null;

  // Synchronize current value to other tabs/windows
  const sync = () => {
    const currentValue = value();
    const syncData = {
      timestamp: Date.now(),
      data: currentValue,
    };

    try {
      const serializedData = serializeData(syncData);

      if (channel && !channelClosed) {
        try {
          channel.postMessage(serializedData);
        } catch (error: any) {
          if (error?.message?.includes("Channel is closed") || error?.name === "InvalidStateError") {
            channelClosed = true;
            channel = null;
          } else {
            throw error;
          }
        }
      }

      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(storageKey, serializedData);
      }
      setLastUpdate(syncData.timestamp);
    } catch (error) {
      console.error("Sync error:", error);
    }
  };

  // Load persisted data from localStorage
  const loadExistingData = (): boolean => {
    if (typeof window === "undefined" || !window.localStorage) return false;
    try {
      const storedData = localStorage.getItem(storageKey);
      if (storedData) {
        const parsedData = deserializeData(storedData);
        if (parsedData && isValidSyncData(parsedData)) {
          setValue(() => parsedData.data);
          setLastUpdate(parsedData.timestamp);
          return true;
        }
      }
    } catch (error) {
      console.error("Failed to load existing data:", error);
    }
    return false;
  };

  // Register sync function under namespaced key
  syncFunctions.set(registryKey, sync);

  // Set up transport
  if (useBroadcast) {
    channel = new BroadcastChannel(storageKey);
    channel.onmessage = (event) => {
      try {
        const parsedData = deserializeData(event.data);
        if (parsedData && isValidSyncData(parsedData) && parsedData.timestamp > lastUpdate()) {
          setValue(() => parsedData.data);
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
          if (parsedData && isValidSyncData(parsedData) && parsedData.timestamp > lastUpdate()) {
            setValue(() => parsedData.data as T);
            setLastUpdate(parsedData.timestamp);
          }
        } catch (error) {
          console.error("Failed to parse localStorage data:", error);
        }
      }
    };

    window.addEventListener("storage", storageListener);

    // Optional polling
    if (pollingInterval) {
      let lastData = window.localStorage ? localStorage.getItem(storageKey) : null;

      pollingIntervalId = window.setInterval(() => {
        try {
          const newData = window.localStorage ? localStorage.getItem(storageKey) : null;
          if (newData !== lastData && newData) {
            const parsedData = deserializeData(newData);
            if (parsedData && isValidSyncData(parsedData) && parsedData.timestamp > lastUpdate()) {
              setValue(() => parsedData.data);
              setLastUpdate(parsedData.timestamp);
            }
            lastData = newData;
          }
        } catch (error) {
          console.error("Failed to poll data:", error);
        }
      }, pollingInterval);
    }
  }

  // Persist on load
  if (persistOnLoad) {
    const dataLoaded = loadExistingData();
    if (!dataLoaded) {
      sync();
    }
  }

  // Auto sync: wrap setValue with throttled sync
  let lastValueStr = JSON.stringify(initialValue);
  if (autoSync) {
    const originalSetValue = setValue;
    const throttledSync = () => {
      if (throttleTimeout !== null && typeof window !== "undefined") {
        clearTimeout(throttleTimeout);
      }
      if (typeof window !== "undefined") {
        throttleTimeout = window.setTimeout(() => {
          sync();
          throttleTimeout = null;
        }, throttleMs);
      } else {
        sync();
      }
    };

    const wrappedSetValue = (next: Exclude<T, Function> | ((prev: T) => T)) => {
      const result = originalSetValue(next);
      const currentValueStr = JSON.stringify(value());
      if (currentValueStr !== lastValueStr) {
        lastValueStr = currentValueStr;
        throttledSync();
      }
      return result;
    };

    setValue = wrappedSetValue as typeof setValue;
  }

  // Cleanup
  const cleanup = () => {
    if (throttleTimeout !== null) {
      clearTimeout(throttleTimeout);
      throttleTimeout = null;
    }
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
    if (pollingIntervalId !== null) {
      window.clearInterval(pollingIntervalId);
    }
    syncFunctions.delete(registryKey);
    cleanupFunctions.delete(registryKey);
  };

  cleanupFunctions.set(registryKey, cleanup);

  // Only register onCleanup when inside a reactive owner (component/effect)
  if (getOwner()) {
    onCleanup(cleanup);
  }

  return [value, setValue, sync] as const;
}
