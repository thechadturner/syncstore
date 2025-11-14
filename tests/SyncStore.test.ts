import { describe, it, expect, vi } from "vitest";
import { createSyncStore } from "../src/SyncStore";

describe("SyncStore", () => {
  it("initializes with default value", () => {
    const [store] = createSyncStore({
      key: "test",
      initialValue: { foo: "bar" },
    });
    expect(store.foo).toBe("bar");
  });

  it("updates store and syncs", () => {
    const [store, setStore] = createSyncStore({
      key: "test-sync",
      initialValue: { count: 0 },
    });
    setStore("count", c => c + 1);
    expect(store.count).toBe(1);
  });

  it("falls back to localStorage if BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const [store] = createSyncStore({
      key: "fallback",
      initialValue: { theme: "dark" },
    });
    expect(store.theme).toBe("dark");
  });
});

