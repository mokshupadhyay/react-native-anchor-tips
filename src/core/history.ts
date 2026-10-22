import type { TipStorage } from './types';

export const HISTORY_KEY = 'react-native-anchor-tips:history';

interface Entry {
  count: number;
  invalidated?: boolean;
}

type Entries = Record<string, Entry>;

const isThenable = <T,>(value: unknown): value is Promise<T> =>
  value != null && typeof (value as { then?: unknown }).then === 'function';

function parse(raw: string | null | undefined): Entries {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object') return {};
    const entries: Entries = {};
    for (const id of Object.keys(parsed as object)) {
      const entry = (parsed as Record<string, unknown>)[id] as Partial<Entry> | null;
      if (entry && typeof entry.count === 'number') {
        entries[id] = { count: entry.count, invalidated: entry.invalidated === true || undefined };
      }
    }
    return entries;
  } catch {
    return {};
  }
}

/**
 * How often each tip was shown, and which tips were invalidated. Kept in
 * memory, and in `storage` when one is configured. Reads wait until stored
 * history is loaded.
 */
export class TipHistory {
  private entries: Entries = {};
  private storage: TipStorage | undefined;
  private ready = true;
  private waiting: Array<() => void> = [];
  private generation = 0;
  /** Resets made while loading, applied to the stored history once it arrives. */
  private resetWhileLoading: Set<string> | 'all' = new Set();

  setStorage(storage: TipStorage | undefined): void {
    if (storage === this.storage) return;
    this.storage = storage;
    if (!storage) return;
    const generation = ++this.generation;
    this.ready = false;
    this.resetWhileLoading = new Set();
    let raw: ReturnType<TipStorage['getItem']>;
    try {
      raw = storage.getItem(HISTORY_KEY);
    } catch {
      this.finishLoading(generation, null);
      return;
    }
    if (isThenable<string | null | undefined>(raw)) {
      raw.then(
        (value) => this.finishLoading(generation, value),
        () => this.finishLoading(generation, null),
      );
    } else {
      this.finishLoading(generation, raw);
    }
  }

  /** Run once stored history is available; synchronously when it already is. */
  whenReady(callback: () => void): void {
    if (this.ready) callback();
    else this.waiting.push(callback);
  }

  canShow(id: string, maxDisplayCount: number | undefined): boolean {
    const entry = this.entries[id];
    if (entry && entry.invalidated) return false;
    if (maxDisplayCount === undefined) return true;
    return (entry ? entry.count : 0) < maxDisplayCount;
  }

  displayCount(id: string): number {
    const entry = this.entries[id];
    return entry ? entry.count : 0;
  }

  recordShow(id: string): void {
    const entry = this.entries[id];
    this.entries = { ...this.entries, [id]: { ...entry, count: (entry ? entry.count : 0) + 1 } };
    this.persist();
  }

  invalidate(id: string): void {
    const entry = this.entries[id];
    this.entries = { ...this.entries, [id]: { count: entry ? entry.count : 0, invalidated: true } };
    this.persist();
  }

  reset(id?: string): void {
    if (id === undefined) {
      this.entries = {};
      if (!this.ready) this.resetWhileLoading = 'all';
    } else {
      const next = { ...this.entries };
      delete next[id];
      this.entries = next;
      if (!this.ready && this.resetWhileLoading !== 'all') this.resetWhileLoading.add(id);
    }
    this.persist();
  }

  /** Forget everything without touching storage. Intended for tests. */
  clear(): void {
    this.entries = {};
    this.storage = undefined;
    this.ready = true;
    this.waiting = [];
    this.generation++;
    this.resetWhileLoading = new Set();
  }

  private finishLoading(generation: number, raw: string | null | undefined): void {
    if (generation !== this.generation) return;
    const resets = this.resetWhileLoading;
    const stored = resets === 'all' ? {} : parse(raw);
    if (resets !== 'all') resets.forEach((id) => delete stored[id]);
    const changedWhileLoading = resets === 'all' || resets.size > 0 || Object.keys(this.entries).length > 0;
    // Shows recorded while loading count on top of the stored history.
    for (const id of Object.keys(this.entries)) {
      const current = this.entries[id];
      const previous = stored[id];
      stored[id] = {
        count: (previous ? previous.count : 0) + current.count,
        invalidated: current.invalidated || (previous && previous.invalidated) || undefined,
      };
    }
    this.entries = stored;
    this.ready = true;
    this.resetWhileLoading = new Set();
    if (changedWhileLoading) this.persist();
    const waiting = this.waiting;
    this.waiting = [];
    for (const callback of waiting) callback();
  }

  private persist(): void {
    // Writing before stored history loaded would overwrite it.
    if (!this.storage || !this.ready) return;
    try {
      const result = this.storage.setItem(HISTORY_KEY, JSON.stringify(this.entries));
      if (isThenable<void>(result)) result.then(undefined, () => undefined);
    } catch {
      // Storage is best effort; the in-memory history stays correct.
    }
  }
}
