import { render } from "solid-js/web";
import { createSyncStore, createSyncSignal } from "../src";
import { Show, createSignal } from "solid-js";
import "./styles.css";

type CounterStore = { count: number };

function App() {
  const [counter, setCounter, syncStore] = createSyncStore<CounterStore>({
    key: "counter",
    initialValue: { count: 0 },
  });

  const [message, setMessage, syncSignal] = createSyncSignal<string>(
    "Hello SyncSignal!",
    { key: "message" }
  );

  const [showSignal, setShowSignal] = createSignal(true);
  const [showStore, setShowStore] = createSignal(true);

  return (
    <div class="app-container">
      <h1>SyncStore Demo</h1>

      <div class="panels">
        <div class="panel">
          <h2>SyncStore Example</h2>
          <button class="panel-toggle" onClick={() => setShowStore((prev) => !prev)}>
            {showStore() ? "Hide" : "Show"} Counter
          </button>

          <Show when={showStore()}>
            <div>
              <p class="count-display">Count: {counter.count}</p>
              <div class="button-row">
                <button onClick={() => { setCounter("count", (c) => c + 1); syncStore(); }}>
                  Increment
                </button>
                <button onClick={() => { setCounter("count", (c) => c - 1); syncStore(); }}>
                  Decrement
                </button>
                <button onClick={() => { setCounter("count", 0); syncStore(); }}>
                  Reset
                </button>
              </div>
              <p>Open this page in another tab to see sync in action!</p>
            </div>
          </Show>
        </div>

        <div class="panel">
          <h2>SyncSignal Example</h2>
          <button class="panel-toggle" onClick={() => setShowSignal((prev) => !prev)}>
            {showSignal() ? "Hide" : "Show"} Message
          </button>

          <Show when={showSignal()}>
            <div>
              <h3>Current message:</h3>
              <p class="message-display">{message()}</p>
              <div>
                <input
                  class="message-input"
                  type="text"
                  value={message()}
                  onInput={(e) => {
                    setMessage(e.currentTarget.value);
                    syncSignal();
                  }}
                />
                <div class="button-row">
                  <button onClick={() => { setMessage("Hello SyncSignal!"); syncSignal(); }}>
                    Reset Message
                  </button>
                  <button onClick={() => syncSignal()}>
                    Force Sync
                  </button>
                </div>
              </div>
              <p>Type in the input and see it sync across tabs!</p>
            </div>
          </Show>
        </div>
      </div>

      <div class="instructions">
        <p>
          <strong>Instructions:</strong> Open this page in multiple tabs or windows
          to see the synchronization in action.
        </p>
      </div>
    </div>
  );
}

render(() => <App />, document.getElementById("root")!);
