# Sync for SolidJS

A lightweight library for synchronizing state across browser tabs using SolidJS.

## Installation

```bash
npm install @solidjs/sync
# or
yarn add @solidjs/sync
```

## Features

- Cross-tab state synchronization using BroadcastChannel API with localStorage fallback
- Supports all primitive types: strings, numbers, booleans, null, undefined
- Two API styles: signal-based and store-based
- Automatic or manual synchronization options
- Compatible with all modern browsers

## Running the Example

To see the library in action, you can run the included example:

```bash
npm run example
# or
npm start
```

This will start a development server on `http://localhost:3000`. Open the same URL in multiple browser tabs or windows to see the cross-tab synchronization in action!

## Quick Start

### Sync Signal Example

```jsx
import { createSyncSignal } from '@solidjs/sync';

function Counter() {
  // Create a synchronized signal
  const [count, setCount, syncCount] = createSyncSignal(0, { 
    key: 'counter',
    autoSync: true // Optional: sync automatically when value changes
  });

  return (
    <div>
      <p>Count: {count()}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <button onClick={() => setCount(c => c - 1)}>Decrement</button>
      {/* Manual sync only needed if autoSync is false */}
      <button onClick={syncCount}>Force Sync</button>
    </div>
  );
}
```

### Sync Store Example

```jsx
import { createSyncStore } from '@solidjs/sync';

function UserProfile() {
  // Create a synchronized store
  const [user, setUser, syncUser] = createSyncStore({
    key: 'user',
    initialValue: {
      name: 'Guest',
      preferences: { darkMode: false }
    }
  });

  return (
    <div>
      <p>Welcome, {user.name}</p>
      <input 
        value={user.name} 
        onInput={(e) => {
          setUser('name', e.target.value);
          syncUser(); // Manual sync
        }}
      />
      <label>
        <input 
          type="checkbox" 
          checked={user.preferences.darkMode} 
          onChange={() => {
            setUser('preferences', 'darkMode', prev => !prev);
            syncUser();
          }}
        />
        Dark Mode
      </label>
    </div>
  );
}
```

## API Reference

### createSyncSignal

```typescript
function createSyncSignal<T>(
  initialValue: T, 
  options: SyncOptions<T>
): [Accessor<T>, Setter<T>, () => void]
```

**Options:**
- `key` (required): Unique identifier for this synchronized value
- `autoSync`: Whether to sync automatically on changes (default: false)
- `throttleMs`: Throttle time for auto sync in milliseconds (default: 50). Only applies when `autoSync` is true.
- `pollingInterval`: Polling interval for fallback mode in milliseconds
- `persistOnLoad`: Whether to persist initial value on load (default: true)

**Returns:** `[value, setValue, sync]` - The signal accessor, setter, and manual sync function. Cleanup is handled automatically via `onCleanup`.

### createSyncStore

```typescript
function createSyncStore<T extends object>(options: SyncStoreOptions<T>): [
  store: T,
  setStore: SetStoreFunction<T>,
  sync: () => void
]
```

**Options:**
- `key` (required): Unique identifier for this synchronized store
- `initialValue` (required): Initial store state
- `persistOnLoad`: Whether to persist initial state on load (default: true)
- `pollingInterval`: Polling interval for fallback mode in milliseconds

### Utility Functions

```typescript
// Get a sync function by key
function getSync(key: string): (() => void) | undefined

// Clear stored data for a specific key (automatically triggers cleanup)
function clearSyncData(key: string, type?: "store" | "signal"): void

// Clear all sync data for all registered signals and stores
function clearAllSyncData(): void

// Get all available sync store keys from localStorage
function getSyncStoreKeys(): string[]

// Get all available sync signal keys from localStorage
function getSyncSignalKeys(): string[]

// Check if BroadcastChannel is supported
function isBroadcastSupported(): boolean

// Check if localStorage is supported
function isLocalStorageSupported(): boolean
```

**Note:** Cleanup is handled automatically via SolidJS's `onCleanup`. When a signal or store is created within a reactive context, it will automatically clean up when that context is disposed. For module-level signals/stores, use `clearSyncData()` or `clearAllSyncData()` to manually trigger cleanup.

## Browser Support

- Modern browsers: Uses BroadcastChannel API
- Legacy browsers: Falls back to localStorage-based synchronization

## License

MIT
