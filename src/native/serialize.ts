import { processColor } from 'react-native';
import type { TipConfig, TipRecord } from '../core/types';
import {
  accessibilityLabelFor,
  type ColorScheme,
  resolveTheme,
  resolveTipOptions,
} from '../core/resolve';
import { resolveLineHeights, resolveTipVisuals } from '../theme/themes';

type NativeValue = string | number | boolean | null | NativeObject | NativeValue[];
interface NativeObject {
  [key: string]: NativeValue;
}

function color(value: string): number | null {
  const processed = processColor(value);
  return typeof processed === 'number' ? processed : null;
}

function fontWeight(value: unknown): string {
  if (value === 'bold') return '700';
  if (value === 'normal' || value === undefined) return '400';
  return String(value);
}

/**
 * Plain, fully resolved description of one tip for the native overlay.
 * Native code never interprets theme tokens; it draws these values and
 * positions the bubble with the same algorithm as `computePlacement`.
 */
export function serializeNativeTip(record: TipRecord, config: TipConfig, scheme: ColorScheme): NativeObject {
  const options = resolveTipOptions(record, config);
  const theme = resolveTheme(config, scheme, options.theme);
  const visuals = resolveTipVisuals(theme, options.variant ?? theme.variant);
  const { layout, typography, shadow } = theme;
  const lineHeights = resolveLineHeights(typography);
  const anchor = record.anchorRect ?? { x: 0, y: 0, width: 0, height: 0 };

  return {
    title: options.title ?? null,
    message: options.message ?? null,
    icon: typeof options.icon === 'string' && options.icon.length > 0 ? options.icon : null,
    stepLabel: options.stepLabel ?? null,
    placement: options.placement,
    align: options.align,
    showArrow: options.showArrow && layout.arrowSize > 0,
    showCloseButton: options.showCloseButton,
    duration: options.duration,
    dismissOnOutsidePress: options.dismissOnOutsidePress && !options.spotlight,
    dismissOnTipPress: options.dismissOnTipPress,
    spotlight: options.spotlight,
    dismissOnBackdropPress: options.dismissOnBackdropPress,
    animation: options.animation,
    accessibilityLabel: accessibilityLabelFor(options),
    anchor: { x: anchor.x, y: anchor.y, width: anchor.width, height: anchor.height },
    anchorTag: record.anchorTag,
    actions: options.actions.map((action, index) => ({
      id: action.id ?? String(index),
      label: action.label,
      style: action.style ?? 'default',
      dismissOnPress: action.dismissOnPress !== false,
    })),
    style: {
      backgroundColor: color(visuals.background),
      borderColor: color(visuals.border),
      borderWidth: visuals.borderWidth,
      borderRadius: layout.borderRadius,
      titleColor: color(visuals.title),
      messageColor: color(visuals.message),
      iconColor: color(visuals.icon),
      actionColor: color(visuals.action),
      primaryBackgroundColor: color(visuals.primaryBackground),
      primaryTextColor: color(visuals.primaryText),
      destructiveColor: color(visuals.destructive),
      closeColor: color(visuals.closeIcon),
      stepColor: color(visuals.step),
      backdropColor: color(theme.colors.backdrop),
      shadowColor: color(theme.colors.shadow),
      fontFamily: typography.fontFamily ?? null,
      titleFontSize: typography.titleSize,
      titleFontWeight: fontWeight(typography.titleWeight),
      titleLineHeight: lineHeights.title,
      messageFontSize: typography.messageSize,
      messageLineHeight: lineHeights.message,
      actionFontSize: typography.actionSize,
      actionFontWeight: fontWeight(typography.actionWeight),
      stepFontSize: typography.stepSize,
      padding: layout.padding,
      maxWidth: layout.maxWidth,
      margin: layout.margin,
      offset: layout.offset,
      arrowSize: layout.arrowSize,
      iconSize: layout.iconSize,
      spotlightPadding: layout.spotlightPadding,
      spotlightRadius: layout.spotlightRadius,
      shadowEnabled: visuals.shadow,
      shadowOpacity: shadow.opacity,
      shadowRadius: shadow.radius,
      shadowOffsetY: shadow.offsetY,
      elevation: shadow.elevation,
    },
  };
}
