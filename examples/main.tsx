import { render } from "solid-js/web";
import { createSyncStore, createSyncSignal } from "../src";
import { Show, createSignal, onMount } from "solid-js";

type CounterStore = { count: number };

// Example with SyncStore
const [counter, setCounter, syncStore] = createSyncStore<CounterStore>({
  key: "counter",
  initialValue: { count: 0 },
});

// Example with SyncSignal
const [message, setMessage, syncSignal] = createSyncSignal<string>(
  "Hello SyncSignal!",
  {
    key: "message", // The key option is required but was missing
    // Remove incorrect initialValue property from options object
  }
);

function App() {
  const [showSignal, setShowSignal] = createSignal(true);
  const [showStore, setShowStore] = createSignal(true);

  // Now that we've fixed the return type of createSyncSignal, this should work
  onMount(() => {
    console.log("Component mounted - initializing sync listeners");

    // syncSignal should now be a function
    syncSignal();

    // Keep the localStorage check as a backup
    try {
      const storedValue = localStorage.getItem("syncstore-message");
      if (storedValue) {
        const parsedData = JSON.parse(storedValue);
        if (parsedData && parsedData.data) {
          console.log("Found stored message:", parsedData.data);
          setMessage(parsedData.data);
        }
      }
    } catch (err) {
      console.error("Error reading from localStorage:", err);
    }

    // Set up a periodic check for updates from other tabs
    const intervalId = setInterval(() => {
      syncSignal();
    }, 2000);

    return () => clearInterval(intervalId);
  });

  return (
    <div
      class="app-container"
      style="font-family: system-ui, sans-serif; padding: 2rem;"
    >
      <h1>SyncStore Demo</h1>

      <div style="display: flex; gap: 2rem;">
        <div
          style="border: 1px solid #ccc; padding: 1rem; border-radius: 0.5rem; width: 50%;"
        >
          <h2>SyncStore Example</h2>
          <button
            onClick={() => setShowStore((prev) => !prev)}
            style="margin-bottom: 1rem;"
          >
            {showStore() ? "Hide" : "Show"} Counter
          </button>

          <Show when={showStore()}>
            <div>
              <h3>Count: {counter.count}</h3>
              <button
                onClick={() => {
                  setCounter("count", (c) => c + 1);
                  syncStore(); // Ensure changes are propagated
                }}
              >
                Increment
              </button>
              <button
                onClick={() => {
                  setCounter("count", (c) => c - 1);
                  syncStore();
                }}
                style="margin-left: 0.5rem;"
              >
                Decrement
              </button>
              <button
                onClick={() => {
                  setCounter("count", 0);
                  syncStore();
                }}
                style="margin-left: 0.5rem;"
              >
                Reset
              </button>
              <p>Open this page in another tab to see sync in action!</p>
            </div>
          </Show>
        </div>

        <div
          style="border: 1px solid #ccc; padding: 1rem; border-radius: 0.5rem; width: 50%;"
        >
          <h2>SyncSignal Example</h2>
          <button
            onClick={() => setShowSignal((prev) => !prev)}
            style="margin-bottom: 1rem;"
          >
            {showSignal() ? "Hide" : "Show"} Message
          </button>

          <Show when={showSignal()}>
            <div>
              <h3>Current message:</h3>
              <p style="background: #eee; padding: 1rem;">{message() ?? ""}</p>
              <div>
                <input
                  type="text"
                  value={message() ?? ""}
                  onInput={(e) => {
                    const newValue = e.currentTarget.value;
                    console.log("Setting new message:", newValue);
                    setMessage(newValue);
                    // Add console log to track sync calls
                    setTimeout(() => {
                      console.log("Syncing message:", newValue);
                      if (typeof syncSignal === "function") {
                        syncSignal();
                      } else {
                        // Alternative approach if syncSignal is not a function
                        console.log("Manually syncing via localStorage");
                        try {
                          localStorage.setItem("message", JSON.stringify(newValue));
                        } catch (err) {
                          console.error("Error saving to localStorage:", err);
                        }
                      }
                    }, 0);
                  }}
                  style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;"
                />
                <button
                  onClick={() => {
                    console.log("Resetting message");
                    setMessage("Hello SyncSignal!");
                    setTimeout(() => {
                      if (typeof syncSignal === "function") {
                        syncSignal();
                      } else {
                        // Alternative approach
                        localStorage.setItem(
                          "message",
                          JSON.stringify("Hello SyncSignal!")
                        );
                      }
                    }, 0);
                  }}
                >
                  Reset Message
                </button>
                <button
                  onClick={() => {
                    console.log("Manual sync requested");
                    if (typeof syncSignal === "function") {
                      syncSignal();
                    } else {
                      console.log("syncSignal is not a function - cannot force sync");
                      // Try to manually read from localStorage
                      const storedValue = localStorage.getItem("message");
                      if (storedValue) {
                        try {
                          setMessage(JSON.parse(storedValue));
                        } catch (err) {
                          console.error("Error parsing stored value:", err);
                        }
                      }
                    }
                  }}
                  style="margin-left: 0.5rem;"
                >
                  Force Sync
                </button>
              </div>
              <p>Type in the input and see it sync across tabs!</p>
            </div>
          </Show>
        </div>
      </div>

      <div style="margin-top: 2rem;">
        <p>
          <strong>Instructions:</strong> Open this page in multiple tabs or windows
          to see the synchronization in action.
        </p>
      </div>
    </div>
  );
}

render(() => <App />, document.getElementById("root")!);