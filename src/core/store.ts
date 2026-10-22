import type {
  Rect,
  TipAnchorTarget,
  TipConfig,
  TipDismissReason,
  TipHandle,
  TipOptions,
  TipPresentation,
  TipRecord,
  TipStorage,
  TipUpdate,
} from './types';
import { assignDefined, deepMerge } from './merge';
import { AnchorRegistry, type AnchorMeasurement } from './anchors';
import { TipHistory } from './history';
import { DEFAULT_MAX_VISIBLE, resolveMaxDisplayCount } from './resolve';

export interface NativeTipEvent {
  /** The record key the native tip was shown with. */
  key: string;
  kind: 'press' | 'action' | 'hide';
  actionId?: string;
  reason?: TipDismissReason;
}

/** Native overlay renderer used for `presentation: 'native'` tips. */
export interface NativePresenter {
  isAvailable(): boolean;
  show(record: TipRecord, config: TipConfig): void;
  update(record: TipRecord, config: TipConfig): void;
  dismiss(key: string): void;
  setEventHandler(handler: (event: NativeTipEvent) => void): void;
}

type Listener = () => void;

interface HostEntry {
  key: number;
  config: TipConfig;
}

function withoutId<P>(options: TipOptions<P>): TipUpdate<P> {
  const update = { ...options } as Record<string, unknown>;
  delete update.id;
  delete update.presentation;
  return update as TipUpdate<P>;
}

const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * Owns every tip's lifecycle: display rules, anchor measurement, the visible
 * limit and callbacks. Renderers only observe snapshots and report when an
 * exit animation finished through `remove`.
 */
export class TipStore {
  readonly anchors: AnchorRegistry;
  readonly history = new TipHistory();

  private records: readonly TipRecord[] = [];
  private readonly listeners = new Set<Listener>();
  private hosts: HostEntry[] = [];
  private baseConfig: TipConfig = {};
  private effectiveConfig: TipConfig = {};
  private nextHostKey = 1;
  private nextRecordKey = 1;
  private nextId = 1;
  private batchDepth = 0;
  private changed = false;
  private pendingCallbacks: Array<() => void> = [];
  private warnedNativeFallback = false;
  /** Record keys that passed their display rule. */
  private readonly cleared = new Set<string>();
  /** Latest measurement request per record key; older results are ignored. */
  private readonly measurements = new Map<string, number>();

  constructor(
    private readonly presenter: NativePresenter | null = null,
    anchors: AnchorRegistry = new AnchorRegistry(),
  ) {
    this.anchors = anchors;
    if (presenter) presenter.setEventHandler((event) => this.handleNativeEvent(event));
    anchors.subscribe((id, registered) => this.handleAnchorChange(id, registered));
  }

  // Observation

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): readonly TipRecord[] => this.records;

  getConfig(): TipConfig {
    return this.effectiveConfig;
  }

  /** The most recently mounted `<TipHost />` renders React tips. */
  getActiveHostKey(): number | null {
    return this.hosts.length > 0 ? this.hosts[this.hosts.length - 1].key : null;
  }

  // Configuration

  configure(config: TipConfig): void {
    this.batch(() => {
      this.baseConfig = config;
      this.recomputeConfig();
    });
  }

  registerHost(config: TipConfig): number {
    const key = this.nextHostKey++;
    this.batch(() => {
      this.hosts = [...this.hosts, { key, config }];
      this.recomputeConfig();
    });
    return key;
  }

  updateHost(key: number, config: TipConfig): void {
    this.batch(() => {
      this.hosts = this.hosts.map((host) => (host.key === key ? { key, config } : host));
      this.recomputeConfig();
    });
  }

  unregisterHost(key: number): void {
    this.batch(() => {
      this.hosts = this.hosts.filter((host) => host.key !== key);
      this.recomputeConfig();
      if (this.hosts.length === 0) {
        // Nobody is left to finish React exit animations.
        for (const record of this.records) {
          if (record.presentation === 'react' && record.phase === 'exiting') this.finalize(record);
        }
      }
    });
  }

  // Tip operations

  show<P>(anchor: TipAnchorTarget, options: TipOptions<P> = {}): string {
    return this.batch(() => {
      const id = options.id ?? (typeof anchor === 'string' ? anchor : `tip-${this.nextId++}`);
      const current = this.findActive(id);
      if (current) {
        if (current.anchor !== anchor) this.retarget(current, anchor);
        const latest = this.findByKey(current.key);
        if (latest) this.applyUpdate(latest, withoutId(options));
        return id;
      }

      const defaults = this.effectiveConfig.defaults ?? {};
      const record: TipRecord<P> = {
        id,
        key: String(this.nextRecordKey++),
        anchor,
        options,
        presentation: this.choosePresentation(options.presentation ?? defaults.presentation),
        phase: 'pending',
        anchorRect: null,
        anchorTag: null,
        createdAt: Date.now(),
        revision: 0,
      };
      this.records = [...this.records, record as TipRecord];
      this.changed = true;
      const key = record.key;
      this.history.whenReady(() => this.batch(() => this.clearForDisplay(key)));
      return id;
    });
  }

  update<P>(id: string, patch: TipUpdate<P>): void {
    this.batch(() => {
      const record = this.findActive(id);
      if (record) this.applyUpdate(record, withoutId(patch as TipOptions<P>));
    });
  }

  dismiss(id?: string, reason: TipDismissReason = 'dismissed'): void {
    this.batch(() => {
      for (const record of this.records) {
        if (id === undefined || record.id === id) this.beginExit(record, reason);
      }
    });
  }

  /** Called by renderers once a tip's exit animation finished. */
  remove(key: string): void {
    this.batch(() => {
      const record = this.findByKey(key);
      if (record) this.finalize(record);
    });
  }

  isActive(id: string): boolean {
    return this.findActive(id) !== undefined;
  }

  /** Measure anchors again, for every tip or only the tips on one anchor id. */
  reposition(anchorId?: string): void {
    this.batch(() => {
      for (const record of this.records) {
        if (record.phase === 'exiting') continue;
        if (anchorId !== undefined && record.anchor !== anchorId) continue;
        this.measure(record.key);
      }
    });
  }

  /** Never show this tip id again (persisted with `storage`), and dismiss it now. */
  invalidate(id: string): void {
    this.history.invalidate(id);
    this.dismiss(id);
  }

  resetHistory(id?: string): void {
    this.history.reset(id);
  }

  handle(id: string): TipHandle {
    return {
      id,
      dismiss: (reason) => this.dismiss(id, reason),
      update: (options) => this.update(id, options),
    };
  }

  /** Remove every tip, host, anchor and history entry immediately. Intended for tests. */
  reset(): void {
    this.records = [];
    this.hosts = [];
    this.baseConfig = {};
    this.effectiveConfig = {};
    this.pendingCallbacks = [];
    this.cleared.clear();
    this.measurements.clear();
    this.anchors.clear();
    this.history.clear();
    this.emit();
  }

  // Internals

  private batch<T>(operation: () => T): T {
    this.batchDepth++;
    let result: T;
    try {
      result = operation();
    } finally {
      this.batchDepth--;
    }
    if (this.batchDepth === 0) {
      if (this.changed) {
        this.changed = false;
        this.emit();
      }
      const callbacks = this.pendingCallbacks;
      this.pendingCallbacks = [];
      for (const callback of callbacks) callback();
    }
    return result;
  }

  private emit(): void {
    for (const listener of Array.from(this.listeners)) listener();
  }

  private recomputeConfig(): void {
    const layers = [this.baseConfig, ...this.hosts.map((host) => host.config)];
    // Storage is an object with methods; merging would copy it and reload history.
    let storage: TipStorage | undefined;
    for (const layer of layers) if (layer.storage) storage = layer.storage;
    this.effectiveConfig = { ...deepMerge<TipConfig>({}, ...layers), storage };
    this.history.setStorage(storage);
    this.changed = true;
    this.schedule();
  }

  private choosePresentation(requested: TipPresentation | undefined): TipPresentation {
    if (requested !== 'native') return 'react';
    if (this.presenter && this.presenter.isAvailable()) return 'native';
    if (isDev && !this.warnedNativeFallback) {
      this.warnedNativeFallback = true;
      console.warn(
        "[react-native-anchor-tips] presentation: 'native' was requested, but the native module is not linked. Falling back to React rendering. Rebuild the app after installing the package.",
      );
    }
    return 'react';
  }

  private findActive(id: string): TipRecord | undefined {
    return this.records.find((record) => record.id === id && record.phase !== 'exiting');
  }

  private findByKey(key: string): TipRecord | undefined {
    return this.records.find((record) => record.key === key);
  }

  private replaceRecord(next: TipRecord): void {
    this.records = this.records.map((record) => (record.key === next.key ? next : record));
    this.changed = true;
  }

  private applyUpdate(record: TipRecord, patch: TipUpdate<any>): void {
    const next: TipRecord = {
      ...record,
      options: assignDefined(record.options, patch),
      revision: record.revision + 1,
    };
    this.replaceRecord(next);
    if (next.presentation === 'native' && next.phase === 'visible' && this.presenter) {
      this.presenter.update(next, this.effectiveConfig);
    }
  }

  private retarget(record: TipRecord, anchor: TipAnchorTarget): void {
    // A visible tip keeps its old frame until the new anchor is measured.
    this.replaceRecord({
      ...record,
      anchor,
      anchorRect: record.phase === 'visible' ? record.anchorRect : null,
    });
    this.measure(record.key);
  }

  private clearForDisplay(key: string): void {
    const record = this.findByKey(key);
    if (!record || record.phase !== 'pending') return;
    const max = resolveMaxDisplayCount(record.options, this.effectiveConfig);
    if (!this.history.canShow(record.id, max)) {
      this.records = this.records.filter((candidate) => candidate.key !== key);
      this.changed = true;
      return;
    }
    this.cleared.add(key);
    this.measure(key);
  }

  private measure(key: string): void {
    const record = this.findByKey(key);
    if (!record || record.phase === 'exiting' || !this.cleared.has(key)) return;
    // String anchors that are not registered yet are measured once they register.
    const handle = this.anchors.resolve(record.anchor);
    if (!handle) return;
    const request = (this.measurements.get(key) ?? 0) + 1;
    this.measurements.set(key, request);
    handle.measure((measurement) => {
      if (this.measurements.get(key) !== request) return;
      this.batch(() => this.applyMeasurement(key, measurement));
    });
  }

  private applyMeasurement(key: string, measurement: AnchorMeasurement | null): void {
    const record = this.findByKey(key);
    if (!record || record.phase === 'exiting') return;
    if (!measurement) {
      // A ref whose view is gone cannot be measured again; a string anchor
      // re-measures when it lays out or registers.
      if (typeof record.anchor !== 'string') this.beginExit(record, 'anchor-removed');
      return;
    }
    const unchanged =
      record.anchorRect !== null &&
      sameRect(record.anchorRect, measurement.rect) &&
      record.anchorTag === measurement.tag;
    if (!unchanged) {
      const next: TipRecord = {
        ...record,
        anchorRect: measurement.rect,
        anchorTag: measurement.tag,
        revision: record.revision + 1,
      };
      this.replaceRecord(next);
      if (next.phase === 'visible' && next.presentation === 'native' && this.presenter) {
        this.presenter.update(next, this.effectiveConfig);
      }
    }
    this.schedule();
  }

  /** Promote measured pending tips, oldest first, up to `maxVisible`. */
  private schedule(): void {
    const maxVisible = Math.max(1, this.effectiveConfig.maxVisible ?? DEFAULT_MAX_VISIBLE);
    // Exiting tips still hold their slot, so tips appear one after another.
    let occupied = this.records.filter((record) => record.phase !== 'pending').length;
    for (const record of this.records) {
      if (occupied >= maxVisible) break;
      if (record.phase === 'pending' && record.anchorRect !== null) {
        this.promote(record);
        occupied++;
      }
    }
  }

  private promote(record: TipRecord): void {
    const next: TipRecord = { ...record, phase: 'visible' };
    this.replaceRecord(next);
    if (resolveMaxDisplayCount(next.options, this.effectiveConfig) !== undefined) {
      this.history.recordShow(next.id);
    }
    if (next.presentation === 'native' && this.presenter) {
      this.presenter.show(next, this.effectiveConfig);
    }
    const { onShow } = this.callbacksFor(next);
    if (onShow) {
      const handle = this.handle(next.id);
      this.pendingCallbacks.push(() => onShow(handle));
    }
  }

  private beginExit(record: TipRecord, reason: TipDismissReason): void {
    if (record.phase === 'exiting') return;
    if (record.phase === 'pending') {
      this.records = this.records.filter((candidate) => candidate.key !== record.key);
      this.forget(record.key);
      this.changed = true;
      return;
    }
    const next: TipRecord = { ...record, phase: 'exiting', exitReason: reason };
    this.replaceRecord(next);
    if (next.presentation === 'native' && this.presenter) {
      this.presenter.dismiss(next.key);
    } else if (this.hosts.length === 0) {
      this.finalize(next);
    }
  }

  private finalize(record: TipRecord): void {
    const current = this.findByKey(record.key);
    if (!current) return;
    this.records = this.records.filter((candidate) => candidate.key !== record.key);
    this.forget(record.key);
    this.changed = true;
    if (current.phase !== 'pending') {
      const { onHide } = this.callbacksFor(current);
      if (onHide) {
        const handle = this.handle(current.id);
        const reason = record.exitReason ?? current.exitReason ?? 'dismissed';
        this.pendingCallbacks.push(() => onHide(handle, reason));
      }
    }
    this.schedule();
  }

  private forget(key: string): void {
    this.cleared.delete(key);
    this.measurements.delete(key);
  }

  private callbacksFor(record: TipRecord): Pick<TipOptions, 'onShow' | 'onHide' | 'onPress'> {
    const defaults = this.effectiveConfig.defaults ?? {};
    return {
      onShow: record.options.onShow ?? defaults.onShow,
      onHide: record.options.onHide ?? defaults.onHide,
      onPress: record.options.onPress ?? defaults.onPress,
    };
  }

  private handleAnchorChange(id: string, registered: boolean): void {
    this.batch(() => {
      for (const record of this.records) {
        if (record.anchor !== id || record.phase === 'exiting') continue;
        if (registered) {
          this.measure(record.key);
        } else if (record.phase === 'visible') {
          this.beginExit(record, 'anchor-removed');
        } else if (record.anchorRect !== null) {
          // Waiting for a slot: wait for the anchor to come back instead.
          this.replaceRecord({ ...record, anchorRect: null, anchorTag: null });
        }
      }
    });
  }

  private handleNativeEvent(event: NativeTipEvent): void {
    this.batch(() => {
      const record = this.findByKey(event.key);
      if (!record) return;
      const handle = this.handle(record.id);
      if (event.kind === 'press') {
        const { onPress } = this.callbacksFor(record);
        if (onPress) this.pendingCallbacks.push(() => onPress(handle));
        return;
      }
      if (event.kind === 'action') {
        const actions = record.options.actions ?? [];
        const action = actions.find((candidate, index) => (candidate.id ?? String(index)) === event.actionId);
        if (action && action.onPress) {
          const onPress = action.onPress;
          this.pendingCallbacks.push(() => onPress(handle));
        }
        return;
      }
      const exiting: TipRecord =
        record.phase === 'exiting'
          ? record
          : { ...record, phase: 'exiting', exitReason: event.reason ?? 'dismissed' };
      this.finalize(exiting);
    });
  }
}
