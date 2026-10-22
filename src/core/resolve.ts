import type {
  ResolvedTipOptions,
  TipConfig,
  TipOptions,
  TipRecord,
  TipStyleOverrides,
  TipTheme,
  TipThemeOverrides,
} from './types';
import { assignDefined } from './merge';
import { createTheme, darkTheme, lightTheme } from '../theme/themes';

export const DEFAULT_MAX_VISIBLE = 1;

/** Apply configured defaults and built-in defaults to one tip. */
export function resolveTipOptions<P>(record: TipRecord<P>, config: TipConfig): ResolvedTipOptions<P> {
  const merged = assignDefined<TipOptions<P>>({}, config.defaults as TipOptions<P> | undefined, record.options);
  return {
    ...merged,
    presentation: record.presentation,
    placement: merged.placement ?? 'auto',
    align: merged.align ?? 'center',
    showArrow: merged.showArrow ?? true,
    showCloseButton: merged.showCloseButton ?? true,
    actions: merged.actions ?? [],
    duration: Math.max(0, merged.duration ?? 0),
    dismissOnOutsidePress: merged.dismissOnOutsidePress ?? true,
    dismissOnTipPress: merged.dismissOnTipPress ?? false,
    spotlight: merged.spotlight ?? false,
    dismissOnBackdropPress: merged.dismissOnBackdropPress ?? true,
    animation: merged.animation ?? 'scale',
  };
}

/** `maxDisplayCount` after defaults, used before a tip is shown. */
export function resolveMaxDisplayCount(options: TipOptions, config: TipConfig): number | undefined {
  if (options.maxDisplayCount !== undefined) return options.maxDisplayCount;
  return config.defaults ? config.defaults.maxDisplayCount : undefined;
}

export type ColorScheme = 'light' | 'dark';

export function resolveColorScheme(preference: TipConfig['colorScheme'], system: ColorScheme): ColorScheme {
  return preference === 'light' || preference === 'dark' ? preference : system;
}

/**
 * Theme precedence, lowest first: base light/dark theme, `theme`,
 * per-scheme theme, `defaults.theme`, then the tip's own `theme`.
 */
export function resolveTheme(config: TipConfig, scheme: ColorScheme, tipTheme?: TipThemeOverrides): TipTheme {
  return createTheme(
    scheme === 'dark' ? darkTheme : lightTheme,
    config.theme,
    scheme === 'dark' ? config.darkTheme : config.lightTheme,
    config.defaults && config.defaults.theme,
    tipTheme,
  );
}

const STYLE_SLOTS: Array<keyof TipStyleOverrides> = [
  'bubble',
  'arrow',
  'content',
  'icon',
  'textContainer',
  'title',
  'message',
  'footer',
  'step',
  'actions',
  'action',
  'actionText',
  'closeButton',
  'closeIcon',
  'backdrop',
];

/** Combine slot styles from config, defaults and the tip, in that order. */
export function resolveStyleSlots(config: TipConfig, options: ResolvedTipOptions<unknown>): TipStyleOverrides {
  const layers = [config.styles, config.defaults && config.defaults.styles, options.styles].filter(
    (layer): layer is TipStyleOverrides => layer != null,
  );
  const result: Record<string, unknown> = {};
  for (const slot of STYLE_SLOTS) {
    const values = layers.map((layer) => layer[slot]).filter((value) => value != null);
    if (values.length === 1) result[slot] = values[0];
    else if (values.length > 1) result[slot] = values;
  }
  return result as TipStyleOverrides;
}

/** Spoken label for screen readers. */
export function accessibilityLabelFor(options: ResolvedTipOptions<unknown>): string {
  if (options.accessibilityLabel) return options.accessibilityLabel;
  return [options.title, options.message, options.stepLabel].filter(Boolean).join('. ');
}
