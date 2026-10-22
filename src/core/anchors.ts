import * as ReactNative from 'react-native';
import type { MeasurableNode, Rect, TipAnchorTarget } from './types';

export interface AnchorMeasurement {
  /** Frame in window coordinates. */
  rect: Rect;
  /** Native view tag, when React Native can provide one. */
  tag: number | null;
}

/** How the store measures one anchor. `<TipAnchor>` registers one per id. */
export interface AnchorHandle {
  measure(callback: (measurement: AnchorMeasurement | null) => void): void;
}

type AnchorListener = (id: string, registered: boolean) => void;

function validRect(x: number, y: number, width: number, height: number): Rect | null {
  const values = [x, y, width, height];
  for (const value of values) {
    if (typeof value !== 'number' || !isFinite(value)) return null;
  }
  // Views measured before their first layout report all zeros.
  if (x === 0 && y === 0 && width === 0 && height === 0) return null;
  return { x, y, width, height };
}

function nodeTag(node: MeasurableNode): number | null {
  const find = (ReactNative as { findNodeHandle?: (node: unknown) => number | null }).findNodeHandle;
  if (!find) return null;
  try {
    const tag = find(node);
    return typeof tag === 'number' ? tag : null;
  } catch {
    return null;
  }
}

/** Measure any host component instance in window coordinates. */
export function measureNode(
  node: MeasurableNode | null,
  callback: (measurement: AnchorMeasurement | null) => void,
): void {
  if (!node || typeof node.measureInWindow !== 'function') {
    callback(null);
    return;
  }
  node.measureInWindow((x, y, width, height) => {
    const rect = validRect(x, y, width, height);
    callback(rect ? { rect, tag: nodeTag(node) } : null);
  });
}

/** Anchors by id. An id registered again replaces the previous anchor. */
export class AnchorRegistry {
  private readonly handles = new Map<string, AnchorHandle>();
  private readonly listeners = new Set<AnchorListener>();

  register(id: string, handle: AnchorHandle): () => void {
    this.handles.set(id, handle);
    this.notify(id, true);
    return () => {
      if (this.handles.get(id) !== handle) return;
      this.handles.delete(id);
      this.notify(id, false);
    };
  }

  get(id: string): AnchorHandle | undefined {
    return this.handles.get(id);
  }

  has(id: string): boolean {
    return this.handles.has(id);
  }

  subscribe(listener: AnchorListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** The handle for a target: a registered id, or a ref measured directly. */
  resolve(target: TipAnchorTarget): AnchorHandle | undefined {
    if (typeof target === 'string') return this.handles.get(target);
    return { measure: (callback) => measureNode(target.current, callback) };
  }

  clear(): void {
    this.handles.clear();
  }

  private notify(id: string, registered: boolean): void {
    for (const listener of Array.from(this.listeners)) listener(id, registered);
  }
}
