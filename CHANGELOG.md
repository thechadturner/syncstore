# Changelog

## [0.2.0] - 2026-03-22

Step-by-step guidance for consuming apps: **[MIGRATION.md](./MIGRATION.md)**.

### What changed and why

This release fixes several real bugs and cleans up internal inconsistencies.
No public API signatures were changed. Most consuming code requires no changes
at all — see the three items below for the exceptions.

---

### 1. `getSync` now requires a `type` argument for unambiguous lookup

**Previously:**
```typescript
getSync("myKey") // always looked up a store
```

**Now:**
```typescript
getSync("myKey", "store")  // explicit store lookup
getSync("myKey", "signal") // explicit signal lookup
```

The second argument defaults to `"store"`, so any existing `getSync("myKey")`
calls will continue to work if they were targeting a store. If you were using
`getSync` to look up a signal, add `"signal"` as the second argument.

**Why:** Signals and stores with the same key were sharing a single entry in
the internal registry, causing one to silently overwrite the other. Keys are
now namespaced internally.

---

### 2. `storageType: "local"` is now `storageType: "localStorage"` in `SyncOptions`

**Previously:** `createSyncSignal` accepted `storageType: "local"` in its options
type, but the option was silently **ignored** — the transport was always chosen
based on BroadcastChannel availability regardless of what you passed.

**Now:** `storageType: "localStorage"` is honoured. Passing it forces the signal
to use localStorage events instead of BroadcastChannel even when the browser
supports it.

**Migration:** If you were passing `storageType: "local"`, change it to
`storageType: "localStorage"`. If you were not passing `storageType` at all,
no change is needed.

---

### 3. `Date` values in a `createSyncStore` now deserialize as `Date` objects

**Previously:** `Date` values stored inside a `createSyncStore` were silently
converted to ISO strings after a sync cycle (standard `JSON.stringify`
behaviour). Reading them back gave you a string, not a `Date`.

**Now:** `Date` values are preserved as `Date` instances across sync cycles,
matching the existing behaviour of `createSyncSignal`.

**Migration:** If your consuming code was already compensating for this by
treating synced date fields as strings (e.g. `new Date(store.createdAt)`),
remove that conversion — the value is now already a `Date`.

---

### Internal improvements (no consumer impact)

- `onCleanup` is now guarded by `getOwner()` — creating primitives at module
  scope no longer causes silent resource leaks (unclosed BroadcastChannels,
  orphaned intervals)
- `isValidSyncData`, `serializeData`, and `deserializeData` are now shared
  between both primitives, removing the risk of them diverging
- Removed dead code: unused `SyncSignalOptions` type, vestigial `type` field
  in signal payloads, always-true `typeof syncFunctions` guard
- Example app cleaned up: all debugging artifacts and inline styles removed
- Test suite expanded from 3 tests to 30+ covering both primitives, cleanup,
  registry namespacing, Date serialization, and utility functions
