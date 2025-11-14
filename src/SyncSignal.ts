import { createSignal, onCleanup } from "solid-js";
import { SyncOptions } from "./types";
import { syncFunctions, cleanupFunctions } from "./types";

/**
 * Creates a reactive signal synchronized across browser tabs/windows.
 * @param initialValue Initial value of the signal (can be any basic type: string, number, boolean, null, undefined)
 * @param options Synchronization options
 * @returns [value, setValue, sync] tuple
 */
export function createSyncSignal<T>(
  initialValue: T,
  options: SyncOptions<T>
) {
  const { key, throttleMs = 50, autoSync = false, pollingInterval, persistOnLoad = true } = options;
  const [value, _setValue] = createSignal<T>(initialValue);
  let setValue = _setValue;
  const [lastUpdate, setLastUpdate] = createSignal<number>(Date.now());
  
  // Setup synchronization mechanisms
  const useBroadcast = typeof window !== "undefined" && "BroadcastChannel" in window;
  let channel: BroadcastChannel | null = null;
  let storageListener: ((event: StorageEvent) => void) | null = null;
  let pollingIntervalId: number | null = null;
  let throttleTimeout: number | null = null;

  // Helper function to serialize data, converting Date objects to strings
  const serializeData = (data: any) => {
    return JSON.stringify(data, (key, value) => {
      if (value instanceof Date) {
        return { __type: "Date", value: value.toISOString() };
      }
      return value;
    });
  };

  // Helper function to deserialize data, converting strings back to Date objects
  const deserializeData = (data: string) => {
    return JSON.parse(data, (key, value) => {
      if (value && value.__type === "Date") {
        try {
          return new Date(value.value);
        } catch (error) {
          console.error(`Failed to deserialize Date for key "${key}":`, error);
          return `Invalid Date: ${value.value}`; // Return a string indicating the error
        }
      }
      return value;
    });
  };

  // Synchronize data to other tabs/windows
  const sync = () => {
    const currentValue = value();
    const syncData = {
      timestamp: Date.now(),
      data: currentValue,
      type: typeof currentValue
    };
    
    try {
      const serializedData = serializeData(syncData); // Use serialization

      // Use BroadcastChannel if available
      if (channel) {
        channel.postMessage(serializedData);
      }
      
      // Always save to localStorage for persistence (use syncsignal- prefix)
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(`syncsignal-${key}`, serializedData);
      }
      setLastUpdate(syncData.timestamp);
    } catch (error) {
      console.error("Sync error:", error);
    }
  };

  // Load existing data from storage if available
  const loadExistingData = () => {
    if (typeof window === "undefined" || !window.localStorage) return false;
    try {
      const storedData = localStorage.getItem(`syncsignal-${key}`);
      if (storedData) {
        const parsedData = deserializeData(storedData); // Use deserialization
        if (parsedData && isValidSyncData(parsedData)) {
          // Always load existing data regardless of timestamp on initial load
          setValue(() => parsedData.data); // Set the value from storage
          setLastUpdate(parsedData.timestamp);
          return true; // Indicate that data was loaded
        }
      }
    } catch (error) {
      console.error("Failed to load existing data:", error);
    }
    return false; // Indicate that no data was loaded
  };
  
  // Register the sync function
  if (typeof syncFunctions !== 'undefined') {
    syncFunctions.set(key, sync);
  } else {
    console.warn("syncFunctions map not available, sync function won't be retrievable with getSync");
  }
  
  // Set up BroadcastChannel for cross-tab communication
  if (useBroadcast && typeof window !== "undefined") {
    channel = new BroadcastChannel(`syncsignal-${key}`);
    channel.onmessage = (event) => {
      try {
        const parsedData = deserializeData(event.data); // Use deserialization
        if (parsedData && isValidSyncData(parsedData) && parsedData.timestamp > lastUpdate()) {
          setValue(() => parsedData.data);
          setLastUpdate(parsedData.timestamp);
        }
      } catch (error) {
        console.error("Failed to parse sync message:", error);
      }
    };
    
    loadExistingData();
  } else if (typeof window !== "undefined") {
    // Fallback to localStorage polling
    storageListener = (event) => {
      if (event.key === `syncsignal-${key}` && event.newValue) {
        try {
          const parsedData = deserializeData(event.newValue); // Use deserialization
          if (parsedData && parsedData.timestamp > lastUpdate()) {
            setValue(() => parsedData.data as T);
            setLastUpdate(parsedData.timestamp);
          }
        } catch (error) {
          console.error("Failed to parse localStorage data:", error);
        }
      }
    };
    
    window.addEventListener("storage", storageListener);
    loadExistingData();
    
    // Optional: Poll for changes
    if (pollingInterval) {
      let lastData = typeof window !== "undefined" && window.localStorage 
        ? localStorage.getItem(`syncsignal-${key}`) 
        : null;
      
      pollingIntervalId = window.setInterval(() => {
        try {
          const newData = typeof window !== "undefined" && window.localStorage
            ? localStorage.getItem(`syncsignal-${key}`)
            : null;
          if (newData !== lastData && newData) {
            const parsedData = deserializeData(newData); // Ensure deserialization
            if (parsedData && parsedData.timestamp > lastUpdate()) {
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

  // Initialize storage with current value
  if (persistOnLoad) {
    const dataLoaded = loadExistingData(); // Attempt to load existing data
    if (!dataLoaded) {
      // Only sync if no existing data was loaded (first time)
      sync();
    }
    // If data was loaded, don't sync to avoid overwriting
  }
  
  // Set up auto sync if enabled with throttling
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
        // Fallback for SSR - sync immediately
        sync();
      }
    };
    
    const wrappedSetValue = (next: Exclude<T, Function> | ((prev: T) => T)) => {
      const result = originalSetValue(next);
      
      // After value changes, check if we need to sync
      const currentValue = value();
      const currentValueStr = JSON.stringify(currentValue);
      
      if (currentValueStr !== lastValueStr) {
        lastValueStr = currentValueStr;
        throttledSync(); // Use throttled sync instead of direct sync
      }
      
      return result;
    };
    
    // Replace setValue with our wrapped version
    setValue = wrappedSetValue as typeof setValue;
  }
  
  // Cleanup function
  const cleanup = () => {
    if (throttleTimeout !== null) {
      clearTimeout(throttleTimeout);
      throttleTimeout = null;
    }
    channel?.close();
    if (storageListener && typeof window !== "undefined") {
      window.removeEventListener("storage", storageListener);
    }
    if (pollingIntervalId !== null) {
      window.clearInterval(pollingIntervalId);
    }
    syncFunctions.delete(key);
    cleanupFunctions.delete(key);
  };

  // Register cleanup function in global registry
  cleanupFunctions.set(key, cleanup);

  // Use onCleanup for automatic cleanup when in reactive context
  onCleanup(cleanup);

  // Return the value, setter, and sync function (no cleanup in return)
  return [value, setValue, sync] as const;
}

// Global type guard to validate sync data structure
export const isValidSyncData = (data: any): data is { data: any; timestamp: number; type?: string } => {
  return (
    data &&
    typeof data === "object" &&
    "data" in data &&
    "timestamp" in data &&
    typeof data.timestamp === "number"
  );
};