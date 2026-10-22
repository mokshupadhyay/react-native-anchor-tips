import React from 'react';
import * as ReactNative from 'react-native';
import type { TipRecord } from '../core/types';
import type { TipStore } from '../core/store';
import { tipStore } from '../core/tips';

/**
 * Re-render on every store change. Host and configuration changes do not
 * replace the records array, so the hook counts changes instead of comparing
 * snapshots. `useSyncExternalStore` is React 18+; this keeps React 16.8 support.
 */
export function useStoreSnapshot(store: TipStore): readonly TipRecord[] {
  const [, forceRender] = React.useReducer((count: number) => count + 1, 0);
  React.useEffect(() => {
    const unsubscribe = store.subscribe(forceRender);
    // Catch changes made between render and subscription.
    forceRender();
    return unsubscribe;
  }, [store]);
  return store.getSnapshot();
}

/** Every tip the store knows about, for building a custom host. */
export function useTips(): readonly TipRecord[] {
  return useStoreSnapshot(tipStore);
}

type AppearanceModule = {
  getColorScheme?: () => string | null | undefined;
  addChangeListener?: (
    listener: (preferences: { colorScheme?: string | null }) => void,
  ) => { remove?: () => void } | void;
  removeChangeListener?: (listener: (preferences: { colorScheme?: string | null }) => void) => void;
};

/** `Appearance` exists from React Native 0.62; earlier releases report `light`. */
export function useSystemColorScheme(): 'light' | 'dark' {
  const appearance = (ReactNative as { Appearance?: AppearanceModule }).Appearance;
  const read = () =>
    appearance && appearance.getColorScheme && appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  const [scheme, setScheme] = React.useState<'light' | 'dark'>(read);

  React.useEffect(() => {
    if (!appearance || !appearance.addChangeListener) return undefined;
    const listener = (preferences: { colorScheme?: string | null }) =>
      setScheme(preferences.colorScheme === 'dark' ? 'dark' : 'light');
    const subscription = appearance.addChangeListener(listener);
    return () => {
      if (subscription && subscription.remove) subscription.remove();
      else if (appearance.removeChangeListener) appearance.removeChangeListener(listener);
    };
  }, [appearance]);

  return scheme;
}

type DimensionsModule = {
  addEventListener: (type: 'change', handler: () => void) => { remove?: () => void } | void;
  removeEventListener?: (type: 'change', handler: () => void) => void;
};

/** Call `onChange` on rotation and window resizes. */
export function useDimensionsChange(onChange: () => void): void {
  const callback = React.useRef(onChange);
  callback.current = onChange;
  React.useEffect(() => {
    const dimensions = ReactNative.Dimensions as unknown as DimensionsModule;
    const handler = () => callback.current();
    const subscription = dimensions.addEventListener('change', handler);
    return () => {
      // React Native 0.65 returns a subscription; earlier releases remove by handler.
      if (subscription && subscription.remove) subscription.remove();
      else if (dimensions.removeEventListener) dimensions.removeEventListener('change', handler);
    };
  }, []);
}
