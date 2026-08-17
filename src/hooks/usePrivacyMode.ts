import { useCallback, useSyncExternalStore } from 'react';

/**
 * Privacy mode: hides quantities and dollar amounts across the dashboard so
 * the screen can be shared without exposing holdings. Persisted in
 * localStorage and shared across all consumers via useSyncExternalStore.
 */

const KEY = 'vault:privacy';

let current = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) === '1' : false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return current;
}

export function usePrivacyMode() {
  const privacy = useSyncExternalStore(subscribe, getSnapshot);

  const toggle = useCallback(() => {
    current = !current;
    try {
      localStorage.setItem(KEY, current ? '1' : '0');
    } catch {
      // storage may be unavailable — still toggle for this session
    }
    emit();
  }, []);

  return { privacy, toggle };
}
