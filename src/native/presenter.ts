import * as ReactNative from 'react-native';
import type { TipDismissReason } from '../core/types';
import type { NativePresenter, NativeTipEvent } from '../core/store';
import { resolveColorScheme } from '../core/resolve';
import type { Spec } from './specs/NativeAnchorTips';
import { serializeNativeTip } from './serialize';

const EVENT_NAME = 'AnchorTipsEvent';

const DISMISS_REASONS: readonly TipDismissReason[] = [
  'action',
  'close-button',
  'tip-press',
  'outside-press',
  'backdrop-press',
  'timeout',
  'anchor-removed',
  'replaced',
  'dismissed',
];

interface RawNativeEvent {
  id?: unknown;
  kind?: unknown;
  actionId?: unknown;
  reason?: unknown;
}

function parseEvent(raw: RawNativeEvent): NativeTipEvent | null {
  if (typeof raw.id !== 'string') return null;
  if (raw.kind !== 'press' && raw.kind !== 'action' && raw.kind !== 'hide') return null;
  const reason = DISMISS_REASONS.find((candidate) => candidate === raw.reason);
  return {
    key: raw.id,
    kind: raw.kind,
    actionId: typeof raw.actionId === 'string' ? raw.actionId : undefined,
    reason,
  };
}

function isTurboModuleRuntime(): boolean {
  // Older JavaScriptCore releases used by React Native 0.60 lack `globalThis`;
  // those releases also predate TurboModules.
  if (typeof globalThis === 'undefined') return false;
  const root = globalThis as { __turboModuleProxy?: unknown; RN$Bridgeless?: unknown };
  return root.__turboModuleProxy != null || root.RN$Bridgeless === true;
}

/**
 * Load the TurboModule on the New Architecture and the bridge module on the
 * old one. The spec is required lazily because `TurboModuleRegistry` is not
 * exported by older React Native releases.
 */
function loadNativeModule(): Spec | null {
  if (isTurboModuleRuntime()) {
    try {
      const turboModule = require('./specs/NativeAnchorTips').default as Spec | null;
      if (turboModule) return turboModule;
    } catch {
      // Fall through to the bridge lookup.
    }
  }
  const legacy = ReactNative.NativeModules.AnchorTips as Spec | undefined;
  return legacy ?? null;
}

function systemColorScheme(): 'light' | 'dark' {
  const appearance = (ReactNative as { Appearance?: { getColorScheme?: () => string | null | undefined } })
    .Appearance;
  const scheme = appearance && appearance.getColorScheme ? appearance.getColorScheme() : null;
  return scheme === 'dark' ? 'dark' : 'light';
}

export function createNativePresenter(): NativePresenter {
  let module: Spec | null | undefined;
  let handler: ((event: NativeTipEvent) => void) | null = null;
  let subscribed = false;

  const getModule = (): Spec | null => {
    if (module === undefined) module = loadNativeModule();
    return module;
  };

  const ensureSubscribed = (nativeModule: Spec) => {
    if (subscribed) return;
    subscribed = true;
    const emitter = new ReactNative.NativeEventEmitter(nativeModule as never);
    emitter.addListener(EVENT_NAME, (raw: RawNativeEvent) => {
      const event = parseEvent(raw);
      if (event && handler) handler(event);
    });
  };

  return {
    isAvailable: () => getModule() !== null,
    show(record, config) {
      const nativeModule = getModule();
      if (!nativeModule) return;
      ensureSubscribed(nativeModule);
      const scheme = resolveColorScheme(config.colorScheme, systemColorScheme());
      nativeModule.show(record.key, serializeNativeTip(record, config, scheme));
    },
    update(record, config) {
      const nativeModule = getModule();
      if (!nativeModule) return;
      const scheme = resolveColorScheme(config.colorScheme, systemColorScheme());
      nativeModule.update(record.key, serializeNativeTip(record, config, scheme));
    },
    dismiss(key) {
      const nativeModule = getModule();
      if (nativeModule) nativeModule.dismiss(key);
    },
    setEventHandler(next) {
      handler = next;
    },
  };
}
