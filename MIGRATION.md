# Migrating to @solidjs/sync 0.2.x

This guide helps consuming applications upgrade from earlier versions. Most apps need **no code changes**. Review the three sections below only if they apply to you.

The canonical list of changes is also in [CHANGELOG.md](./CHANGELOG.md).

---

## 1. Bump the dependency

- Update `@solidjs/sync` to **0.2.0** (or the published version that includes these changes).
- Run install, then **build and test** each app.

---

## 2. Find code that may need updates

Search your codebase (editor or ripgrep):

| Search for | Reason |
|------------|--------|
| `getSync(` | Ensure the second argument matches **store** vs **signal** (see §3). |
| `storageType` and `"local"` | Replace with `"localStorage"` (see §4). |
| `new Date(` on synced store fields | You may have worked around **string** dates; see §5. |

**Example commands:**

```bash
rg "getSync\(" --glob "*.{ts,tsx,js,jsx}"
rg "storageType.*['\"]local['\"]" --glob "*.{ts,tsx}"
```

---

## 3. `getSync(key, type?)`

Internal registry keys are now namespaced so a **signal** and **store** with the same logical key no longer overwrite each other.

- **Stores:** `getSync("myKey")` is unchanged — it defaults to **`"store"`**.
- **Signals:** If you used `getSync("myKey")` to fetch the sync function for a **signal**, pass the second argument:

```typescript
getSync("myKey", "signal");
```

For each call site, confirm whether that key was created with `createSyncStore` or `createSyncSignal` and pass `"store"` or `"signal"` accordingly.

---

## 4. `storageType` on `createSyncSignal`

- Replace **`storageType: "local"`** with **`storageType: "localStorage"`** (TypeScript types and runtime both expect this now).
- If you never set `storageType`, **no change**.

**Behaviour change:** `storageType: "localStorage"` is now **honoured** (localStorage path is used instead of BroadcastChannel when you ask for it). Retest cross-tab sync for any feature that sets this option.

`createSyncStore` already used `"localStorage"`; only **signal** options needed the rename from `"local"`.

---

## 5. `Date` values in `createSyncStore`

Dates inside a synced store are now preserved as **`Date` instances** across sync cycles (not ISO strings).

- Remove redundant `new Date(store.field)` when `field` is already a `Date`.
- Update TypeScript types from `string` to `Date` where appropriate (or use `Date | string` during a short migration window).

---

## 6. Regression checks (manual)

1. Open **two tabs**; change synced state in one tab and confirm the other updates.
2. If you use **`storageType: "localStorage"`** on a signal, repeat the same test.
3. If the store holds **dates**, confirm formatting and comparisons still behave correctly.

---

## 7. TypeScript-only failures

- **`storageType: "local"`** will fail the type checker — fix as in §4.
- **`getSync`** signature is `getSync(key, type?)` with default `"store"`; store-only usage usually compiles unchanged.

---

## 8. Package exports

`isValidSyncData`, `serializeData`, and `deserializeData` are exported from the package root. Prefer:

```typescript
import { isValidSyncData, serializeData, deserializeData } from "@solidjs/sync";
```

Avoid relying on deep internal paths that are not part of the public API contract.
