import React from 'react';
import { type LayoutChangeEvent, View, type ViewProps } from 'react-native';
import type { MeasurableNode, TipOptions } from '../core/types';
import type { TipStore } from '../core/store';
import { measureNode } from '../core/anchors';
import { tipStore } from '../core/tips';

type ViewInstance = React.ComponentRef<typeof View>;

export interface TipAnchorBinding {
  ref: React.RefObject<ViewInstance | null>;
  onLayout: (event: LayoutChangeEvent) => void;
  /** Android must keep the view in the native hierarchy to measure it. */
  collapsable: false;
}

/**
 * Register any view as an anchor. Spread the result onto a `View`:
 *
 * ```tsx
 * const anchor = useTipAnchor('compose');
 * <Pressable {...anchor}>…</Pressable>
 * ```
 */
export function useTipAnchor(id: string, store: TipStore = tipStore): TipAnchorBinding {
  const ref = React.useRef<ViewInstance | null>(null);

  React.useEffect(
    () =>
      store.anchors.register(id, {
        measure: (callback) => measureNode(ref.current as unknown as MeasurableNode | null, callback),
      }),
    [id, store],
  );

  const onLayout = React.useCallback(() => store.reposition(id), [id, store]);
  return { ref, onLayout, collapsable: false };
}

export interface TipAnchorProps extends ViewProps {
  /** The anchor id used with `tips.show(id)`. */
  id: string;
  /** A tip to show declaratively together with `visible`. */
  tip?: TipOptions;
  /** Show `tip` while `true`, dismiss it when `false`. */
  visible?: boolean;
  store?: TipStore;
}

/** A `View` that tips can point at. */
export function TipAnchor(props: TipAnchorProps): React.ReactElement {
  const { id, tip, visible, store = tipStore, onLayout, ...viewProps } = props;
  const anchor = useTipAnchor(id, store);
  const tipId = tip && tip.id !== undefined ? tip.id : id;

  React.useEffect(() => {
    if (visible === undefined || !tip) return;
    if (visible) store.show(id, tip);
    else store.dismiss(tipId);
  }, [visible, tip, id, tipId, store]);

  return (
    <View
      {...viewProps}
      ref={anchor.ref}
      collapsable={false}
      onLayout={(event) => {
        anchor.onLayout(event);
        if (onLayout) onLayout(event);
      }}
    />
  );
}
