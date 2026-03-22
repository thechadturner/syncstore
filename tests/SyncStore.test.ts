import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSyncStore } from "../src/SyncStore";
import { createSyncSignal } from "../src/SyncSignal";
import {
  getSync,
  clearSyncData,
  clearAllSyncData,
  getSyncStoreKeys,
  getSyncSignalKeys,
  isBroadcastSupported,
  isLocalStorageSupported,
} from "../src/index";
import { serializeData, deserializeData, isValidSyncData } from "../src/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearLocalStorage() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("syncstore-") || key.startsWith("syncsignal-"))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

// ─── SyncStore ────────────────────────────────────────────────────────────────

describe("createSyncStore", () => {
  beforeEach(() => {
    clearLocalStorage();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("initializes with the given value", () => {
    const [store] = createSyncStore({ key: "test", initialValue: { foo: "bar" } });
    expect(store.foo).toBe("bar");
  });

  it("updates the store value", () => {
    const [store, setStore] = createSyncStore({ key: "test-update", initialValue: { count: 0 } });
    setStore("count", (c) => c + 1);
    expect(store.count).toBe(1);
  });

  it("persists to localStorage on sync", () => {
    const [, , sync] = createSyncStore({ key: "persist", initialValue: { val: 42 } });
    sync();
    const raw = localStorage.getItem("syncstore-persist");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data.val).toBe(42);
  });

  it("loads existing data from localStorage when persistOnLoad is true", () => {
    // Pre-populate localStorage as if a previous session had synced data
    localStorage.setItem(
      "syncstore-reload",
      serializeData({ data: { count: 99 }, timestamp: Date.now() })
    );
    const [store] = createSyncStore({ key: "reload", initialValue: { count: 0 } });
    expect(store.count).toBe(99);
  });

  it("does not load from localStorage when persistOnLoad is false", () => {
    localStorage.setItem(
      "syncstore-no-persist",
      serializeData({ data: { count: 99 }, timestamp: Date.now() })
    );
    const [store] = createSyncStore({
      key: "no-persist",
      initialValue: { count: 0 },
      persistOnLoad: false,
    });
    expect(store.count).toBe(0);
  });

  it("preserves Date objects through serialization round-trip", () => {
    const now = new Date("2025-01-15T12:00:00.000Z");
    const [, , sync] = createSyncStore({ key: "dates", initialValue: { created: now } });
    sync();
    const raw = localStorage.getItem("syncstore-dates");
    expect(raw).not.toBeNull();
    const parsed = deserializeData(raw!);
    expect(parsed.data.created).toBeInstanceOf(Date);
    expect(parsed.data.created.toISOString()).toBe(now.toISOString());
  });

  it("falls back gracefully when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const [store] = createSyncStore({ key: "fallback", initialValue: { theme: "dark" } });
    expect(store.theme).toBe("dark");
  });

  it("throws when options are not provided", () => {
    // @ts-expect-error intentionally testing runtime guard
    expect(() => createSyncStore(null)).toThrow("SyncStore options are required");
  });
});

// ─── SyncSignal ───────────────────────────────────────────────────────────────

describe("createSyncSignal", () => {
  beforeEach(() => {
    clearLocalStorage();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("initializes with the given value", () => {
    const [value] = createSyncSignal(42, { key: "sig-init" });
    expect(value()).toBe(42);
  });

  it("updates the signal value", () => {
    const [value, setValue] = createSyncSignal(0, { key: "sig-update" });
    setValue(7);
    expect(value()).toBe(7);
  });

  it("persists to localStorage on sync", () => {
    const [, , sync] = createSyncSignal("hello", { key: "sig-persist" });
    sync();
    const raw = localStorage.getItem("syncsignal-sig-persist");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data).toBe("hello");
  });

  it("loads existing data from localStorage when persistOnLoad is true", () => {
    localStorage.setItem(
      "syncsignal-sig-reload",
      serializeData({ data: "persisted", timestamp: Date.now() })
    );
    const [value] = createSyncSignal("default", { key: "sig-reload" });
    expect(value()).toBe("persisted");
  });

  it("does not load from localStorage when persistOnLoad is false", () => {
    localStorage.setItem(
      "syncsignal-sig-no-persist",
      serializeData({ data: "persisted", timestamp: Date.now() })
    );
    const [value] = createSyncSignal("default", { key: "sig-no-persist", persistOnLoad: false });
    expect(value()).toBe("default");
  });

  it("preserves Date objects through serialization round-trip", () => {
    const date = new Date("2025-06-01T00:00:00.000Z");
    const [, , sync] = createSyncSignal(date, { key: "sig-date" });
    sync();
    const raw = localStorage.getItem("syncsignal-sig-date");
    expect(raw).not.toBeNull();
    const parsed = deserializeData(raw!);
    expect(parsed.data).toBeInstanceOf(Date);
    expect(parsed.data.toISOString()).toBe(date.toISOString());
  });

  it("falls back gracefully when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const [value] = createSyncSignal("test", { key: "sig-fallback" });
    expect(value()).toBe("test");
  });

  it("respects storageType: 'localStorage' by not opening a BroadcastChannel", () => {
    const spy = vi.fn(() => ({
      onmessage: null,
      postMessage: vi.fn(),
      close: vi.fn(),
    }));
    vi.stubGlobal("BroadcastChannel", spy);

    createSyncSignal("hello", { key: "sig-localstorage-only", storageType: "localStorage" });

    expect(spy).not.toHaveBeenCalled();
  });
});

// ─── Registry namespacing ─────────────────────────────────────────────────────

describe("registry namespacing", () => {
  beforeEach(() => {
    clearLocalStorage();
    clearAllSyncData();
  });

  it("signal and store with the same key do not collide in the registry", () => {
    createSyncStore({ key: "shared", initialValue: { x: 1 } });
    createSyncSignal("value", { key: "shared" });

    const storeSync = getSync("shared", "store");
    const signalSync = getSync("shared", "signal");

    expect(storeSync).toBeTypeOf("function");
    expect(signalSync).toBeTypeOf("function");
    expect(storeSync).not.toBe(signalSync);
  });

  it("getSync returns undefined for an unknown key", () => {
    expect(getSync("nonexistent", "store")).toBeUndefined();
    expect(getSync("nonexistent", "signal")).toBeUndefined();
  });

  it("getSync defaults to store type", () => {
    createSyncStore({ key: "default-type", initialValue: {} });
    expect(getSync("default-type")).toBeTypeOf("function");
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

describe("clearSyncData", () => {
  beforeEach(() => {
    clearLocalStorage();
    clearAllSyncData();
  });

  it("removes the store entry from localStorage", () => {
    createSyncStore({ key: "clr-store", initialValue: { a: 1 } });
    expect(localStorage.getItem("syncstore-clr-store")).not.toBeNull();
    clearSyncData("clr-store", "store");
    expect(localStorage.getItem("syncstore-clr-store")).toBeNull();
  });

  it("removes the signal entry from localStorage", () => {
    createSyncSignal(1, { key: "clr-signal" });
    expect(localStorage.getItem("syncsignal-clr-signal")).not.toBeNull();
    clearSyncData("clr-signal", "signal");
    expect(localStorage.getItem("syncsignal-clr-signal")).toBeNull();
  });

  it("removes the sync function from the registry after clear", () => {
    createSyncStore({ key: "clr-reg", initialValue: {} });
    expect(getSync("clr-reg", "store")).toBeTypeOf("function");
    clearSyncData("clr-reg", "store");
    expect(getSync("clr-reg", "store")).toBeUndefined();
  });

  it("clearAllSyncData removes all entries", () => {
    createSyncStore({ key: "all1", initialValue: { x: 1 } });
    createSyncSignal("hi", { key: "all2" });
    clearAllSyncData();
    expect(localStorage.getItem("syncstore-all1")).toBeNull();
    expect(localStorage.getItem("syncsignal-all2")).toBeNull();
    expect(getSync("all1", "store")).toBeUndefined();
    expect(getSync("all2", "signal")).toBeUndefined();
  });
});

// ─── Key listing utilities ────────────────────────────────────────────────────

describe("getSyncStoreKeys / getSyncSignalKeys", () => {
  beforeEach(() => {
    clearLocalStorage();
    clearAllSyncData();
  });

  it("returns keys for all persisted stores", () => {
    createSyncStore({ key: "k1", initialValue: {} });
    createSyncStore({ key: "k2", initialValue: {} });
    const keys = getSyncStoreKeys();
    expect(keys).toContain("k1");
    expect(keys).toContain("k2");
  });

  it("returns keys for all persisted signals", () => {
    createSyncSignal(1, { key: "s1" });
    createSyncSignal(2, { key: "s2" });
    const keys = getSyncSignalKeys();
    expect(keys).toContain("s1");
    expect(keys).toContain("s2");
  });

  it("does not mix store and signal keys", () => {
    createSyncStore({ key: "mix", initialValue: {} });
    createSyncSignal("hi", { key: "mix" });
    expect(getSyncStoreKeys()).toContain("mix");
    expect(getSyncSignalKeys()).toContain("mix");
    // Store keys should not appear in signal list and vice versa
    expect(getSyncSignalKeys()).not.toContain("syncstore-mix");
    expect(getSyncStoreKeys()).not.toContain("syncsignal-mix");
  });
});

// ─── Shared helpers ───────────────────────────────────────────────────────────

describe("isValidSyncData", () => {
  it("returns true for valid sync data", () => {
    expect(isValidSyncData({ data: "anything", timestamp: 1234 })).toBe(true);
  });

  it("returns false when data property is missing", () => {
    expect(isValidSyncData({ timestamp: 1234 })).toBe(false);
  });

  it("returns false when timestamp is not a number", () => {
    expect(isValidSyncData({ data: "x", timestamp: "now" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidSyncData(null)).toBe(false);
  });
});

describe("serializeData / deserializeData", () => {
  it("round-trips plain objects", () => {
    const obj = { a: 1, b: "hello", c: true };
    expect(deserializeData(serializeData(obj))).toEqual(obj);
  });

  it("round-trips Date objects", () => {
    const date = new Date("2024-03-15T10:30:00.000Z");
    const result = deserializeData(serializeData({ d: date }));
    expect(result.d).toBeInstanceOf(Date);
    expect(result.d.toISOString()).toBe(date.toISOString());
  });

  it("round-trips nested objects with Dates", () => {
    const obj = { user: { created: new Date("2023-01-01T00:00:00.000Z"), name: "Alice" } };
    const result = deserializeData(serializeData(obj));
    expect(result.user.created).toBeInstanceOf(Date);
    expect(result.user.name).toBe("Alice");
  });
});

// ─── Browser support utilities ────────────────────────────────────────────────

describe("isBroadcastSupported / isLocalStorageSupported", () => {
  it("isLocalStorageSupported returns true in jsdom", () => {
    expect(isLocalStorageSupported()).toBe(true);
  });

  it("isBroadcastSupported reflects BroadcastChannel availability", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    expect(isBroadcastSupported()).toBe(false);
    vi.unstubAllGlobals();
  });
});
