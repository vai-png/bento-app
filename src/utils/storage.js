/**
 * Storage adapter with automatic fallback:
 * 1. window.storage (if running in Claude Artifacts or custom host environment)
 * 2. localStorage (standard browser environment)
 */

export async function getStorageItem(key) {
  // Try window.storage first
  if (typeof window !== "undefined" && window.storage?.get) {
    try {
      const res = await window.storage.get(key, false);
      if (res && res.value !== undefined) return res.value;
    } catch {
      // Fallback to localStorage
    }
  }

  // Fallback to localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const item = window.localStorage.getItem(`diet_tracker_${key}`);
      return item;
    } catch (e) {
      console.warn("localStorage get failed:", e);
      return null;
    }
  }

  return null;
}

export async function setStorageItem(key, value) {
  const serialized = JSON.stringify(value);
  let saved = false;

  // Try window.storage if available
  if (typeof window !== "undefined" && window.storage?.set) {
    try {
      const res = await window.storage.set(key, serialized, false);
      if (res) saved = true;
    } catch {
      // Fallback to localStorage
    }
  }

  // Also write to localStorage for durability
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(`diet_tracker_${key}`, serialized);
      saved = true;
    } catch (e) {
      console.warn("localStorage set failed:", e);
    }
  }

  return saved;
}

// Simple persistence helper for convenience
export async function persist(key, value) {
  // Store the value using setStorageItem and return the result
  return await setStorageItem(key, value);
}
