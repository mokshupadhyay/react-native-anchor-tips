import React from 'react';
import {
  Dimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Platform,
  StatusBar,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import type { EdgeInsets, Rect, TipConfig, TipRecord } from '../core/types';
import type { TipStore } from '../core/store';
import { resolveColorScheme, resolveTipOptions } from '../core/resolve';
import { containsPoint } from '../core/geometry';
import { tipStore } from '../core/tips';
import { useDimensionsChange, useStoreSnapshot, useSystemColorScheme } from './hooks';
import { TipItem } from './TipItem';

export interface TipHostProps extends TipConfig {
  /**
   * Wrap your app to let a touch outside a tip dismiss it and still reach
   * the app. Without children, that touch only dismisses the tip.
   */
  children?: React.ReactNode;
  /**
   * Safe-area insets that tips stay inside. Pass `useSafeAreaInsets()` from
   * `react-native-safe-area-context` for exact values on every device.
   */
  insets?: Partial<EdgeInsets>;
  style?: StyleProp<ViewStyle>;
  /** Advanced: render tips from a separate store. */
  store?: TipStore;
}

interface HostFrame {
  width: number;
  height: number;
  /** Position in window coordinates, the space anchors are measured in. */
  window: { x: number; y: number };
  /** Position in page coordinates, the space touches report. */
  page: { x: number; y: number };
}

type MeasurableView = React.ComponentRef<typeof View> & {
  measure?: (callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void;
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

function defaultInsets(): EdgeInsets {
  if (Platform.OS === 'ios') return { top: 50, bottom: 34, left: 0, right: 0 };
  return { top: StatusBar.currentHeight ?? 24, bottom: 16, left: 0, right: 0 };
}

function wantsOutsidePress(record: TipRecord, config: TipConfig): boolean {
  if (record.presentation !== 'react' || record.phase !== 'visible') return false;
  const options = resolveTipOptions(record, config);
  return options.dismissOnOutsidePress && !options.spotlight;
}

/**
 * Mount once near the root of the app, ideally around it. A `<TipHost />`
 * mounted later, for example inside a `Modal`, takes over rendering until it
 * unmounts, and its props are merged over the earlier ones.
 */
export function TipHost(props: TipHostProps): React.ReactElement | null {
  const { children, insets: insetOverrides, style, store = tipStore, ...ownConfig } = props;

  const [hostKey, setHostKey] = React.useState<number | null>(null);
  const configRef = React.useRef<TipConfig>(ownConfig);
  configRef.current = ownConfig;

  React.useEffect(() => {
    const key = store.registerHost(configRef.current);
    setHostKey(key);
    return () => store.unregisterHost(key);
  }, [store]);

  const { maxVisible, colorScheme, theme, lightTheme, darkTheme, defaults, renderer, styles, storage } = ownConfig;
  React.useEffect(() => {
    if (hostKey !== null) store.updateHost(hostKey, configRef.current);
  }, [store, hostKey, maxVisible, colorScheme, theme, lightTheme, darkTheme, defaults, renderer, styles, storage]);

  const records = useStoreSnapshot(store);
  const systemScheme = useSystemColorScheme();
  useDimensionsChange(() => store.reposition());

  const overlayRef = React.useRef<MeasurableView | null>(null);
  const [frame, setFrame] = React.useState<HostFrame | null>(null);
  const bubbleFrames = React.useRef(new Map<string, Rect>()).current;
  const onBubbleFrame = React.useCallback(
    (key: string, rect: Rect | null) => {
      if (rect) bubbleFrames.set(key, rect);
      else bubbleFrames.delete(key);
    },
    [bubbleFrames],
  );

  const onOverlayLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrame((current) => ({
      width,
      height,
      window: current ? current.window : { x: 0, y: 0 },
      page: current ? current.page : { x: 0, y: 0 },
    }));
    const view = overlayRef.current;
    if (!view) return;
    if (view.measureInWindow) {
      view.measureInWindow((x, y) => {
        if (typeof x !== 'number' || typeof y !== 'number') return;
        setFrame((current) => (current ? { ...current, window: { x, y } } : current));
      });
    }
    if (view.measure) {
      view.measure((_x, _y, _width, _height, pageX, pageY) => {
        if (typeof pageX !== 'number' || typeof pageY !== 'number') return;
        setFrame((current) => (current ? { ...current, page: { x: pageX, y: pageY } } : current));
      });
    }
  };

  const active = hostKey !== null && store.getActiveHostKey() === hostKey;
  const config = store.getConfig();

  const dismissOutside = (point: { x: number; y: number } | null) => {
    for (const record of store.getSnapshot()) {
      if (!wantsOutsidePress(record, config)) continue;
      const bubble = bubbleFrames.get(record.key);
      if (point && bubble && containsPoint(bubble, point.x, point.y)) continue;
      store.dismiss(record.id, 'outside-press');
    }
  };

  const onTouchStart = (event: GestureResponderEvent) => {
    if (!active) return;
    const { pageX, pageY } = event.nativeEvent;
    const origin = frame ? frame.page : { x: 0, y: 0 };
    dismissOutside({ x: pageX - origin.x, y: pageY - origin.y });
  };

  let content: React.ReactNode = null;
  if (active) {
    const scheme = resolveColorScheme(config.colorScheme, systemScheme);
    const insets = { ...defaultInsets(), ...insetOverrides };
    const viewport = frame ?? Dimensions.get('window');
    const hostOrigin = frame ? frame.window : { x: 0, y: 0 };
    const visible = records.filter(
      (record) => record.presentation === 'react' && record.phase !== 'pending' && record.anchorRect !== null,
    );
    const needsCatcher = children === undefined && visible.some((record) => wantsOutsidePress(record, config));
    content = (
      <>
        {needsCatcher ? (
          <View
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={() => {
              dismissOutside(null);
              return true;
            }}
          />
        ) : null}
        {visible.map((record) => (
          <TipItem
            key={record.key}
            record={record}
            store={store}
            config={config}
            scheme={scheme}
            viewport={{ width: viewport.width, height: viewport.height }}
            insets={insets}
            hostOrigin={hostOrigin}
            onBubbleFrame={onBubbleFrame}
          />
        ))}
      </>
    );
  }

  const overlay = (
    <View
      ref={overlayRef as React.Ref<React.ComponentRef<typeof View>>}
      collapsable={false}
      onLayout={onOverlayLayout}
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, baseStyles.overlay, style]}>
      {content}
    </View>
  );

  if (children === undefined) return overlay;
  return (
    <View style={baseStyles.container} onTouchStart={onTouchStart}>
      {children}
      {overlay}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    zIndex: 9999,
    elevation: 9999,
  },
});
