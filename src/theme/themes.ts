import type { TipTheme, TipThemeOverrides, TipVariant } from '../core/types';
import { deepMerge } from '../core/merge';

const sharedLayout: TipTheme['layout'] = {
  borderRadius: 14,
  borderWidth: 0,
  padding: 14,
  maxWidth: 320,
  margin: 12,
  offset: 4,
  arrowSize: 7,
  iconSize: 22,
  spotlightPadding: 8,
  spotlightRadius: 16,
};

const sharedTypography: TipTheme['typography'] = {
  titleSize: 15,
  titleWeight: '600',
  titleLineHeight: 20,
  messageSize: 14,
  messageLineHeight: 19,
  actionSize: 14,
  actionWeight: '600',
  stepSize: 13,
};

export const lightTheme: TipTheme = {
  variant: 'card',
  colors: {
    background: '#FFFFFF',
    title: '#18181B',
    message: '#52525B',
    border: 'rgba(24, 24, 27, 0.08)',
    shadow: '#000000',
    accent: '#2563EB',
    onAccent: '#FFFFFF',
    action: '#2563EB',
    destructive: '#DC2626',
    closeIcon: '#71717A',
    step: '#71717A',
    backdrop: 'rgba(9, 9, 11, 0.48)',
    invertedBackground: '#18181B',
    invertedTitle: '#FAFAFA',
    invertedMessage: '#D4D4D8',
    invertedAction: '#93C5FD',
  },
  layout: sharedLayout,
  typography: sharedTypography,
  shadow: { enabled: true, opacity: 0.12, radius: 20, offsetY: 8, elevation: 6 },
};

export const darkTheme: TipTheme = {
  variant: 'card',
  colors: {
    background: '#27272A',
    title: '#FAFAFA',
    message: '#D4D4D8',
    border: 'rgba(255, 255, 255, 0.08)',
    shadow: '#000000',
    accent: '#2563EB',
    onAccent: '#FFFFFF',
    action: '#60A5FA',
    destructive: '#F87171',
    closeIcon: '#A1A1AA',
    step: '#A1A1AA',
    backdrop: 'rgba(0, 0, 0, 0.64)',
    invertedBackground: '#FAFAFA',
    invertedTitle: '#18181B',
    invertedMessage: '#52525B',
    invertedAction: '#2563EB',
  },
  layout: sharedLayout,
  typography: sharedTypography,
  shadow: { enabled: true, opacity: 0.5, radius: 20, offsetY: 8, elevation: 6 },
};

/** Build a complete theme from a base theme and any number of overrides. */
export function createTheme(base: TipTheme, ...overrides: Array<TipThemeOverrides | undefined>): TipTheme {
  return deepMerge(base, ...overrides);
}

/** Line heights of the title and message, with defaults for themes built before these tokens existed. */
export function resolveLineHeights(typography: TipTheme['typography']): { title: number; message: number } {
  return {
    title: typography.titleLineHeight ?? Math.round(typography.titleSize * 1.33),
    message: typography.messageLineHeight ?? Math.round(typography.messageSize * 1.35),
  };
}

/** Concrete colors of one tip after applying its variant. */
export interface TipVisuals {
  background: string;
  border: string;
  borderWidth: number;
  title: string;
  message: string;
  icon: string;
  action: string;
  primaryBackground: string;
  primaryText: string;
  destructive: string;
  closeIcon: string;
  step: string;
  shadow: boolean;
}

/**
 * The single interpretation of theme tokens. Both the React renderer and the
 * native overlay consume these values, so the two presentations stay aligned.
 */
export function resolveTipVisuals(theme: TipTheme, variant: TipVariant = theme.variant): TipVisuals {
  const { colors, layout } = theme;
  const base: TipVisuals = {
    background: colors.background,
    border: colors.border,
    borderWidth: layout.borderWidth,
    title: colors.title,
    message: colors.message,
    // The action color rather than the accent: in the dark theme the accent is
    // tuned for white text on the primary button and is too dark for a glyph.
    icon: colors.action,
    action: colors.action,
    primaryBackground: colors.accent,
    primaryText: colors.onAccent,
    destructive: colors.destructive,
    closeIcon: colors.closeIcon,
    step: colors.step,
    shadow: theme.shadow.enabled,
  };

  switch (variant) {
    case 'filled':
      return {
        ...base,
        background: colors.accent,
        border: 'transparent',
        borderWidth: 0,
        title: colors.onAccent,
        message: colors.onAccent,
        icon: colors.onAccent,
        action: colors.onAccent,
        primaryBackground: 'rgba(255, 255, 255, 0.22)',
        primaryText: colors.onAccent,
        destructive: colors.onAccent,
        closeIcon: colors.onAccent,
        step: colors.onAccent,
      };
    case 'inverted':
      return {
        ...base,
        background: colors.invertedBackground,
        border: 'transparent',
        borderWidth: 0,
        title: colors.invertedTitle,
        message: colors.invertedMessage,
        icon: colors.invertedAction,
        action: colors.invertedAction,
        primaryBackground: colors.invertedAction,
        primaryText: colors.invertedBackground,
        closeIcon: colors.invertedMessage,
        step: colors.invertedMessage,
      };
    case 'card':
      return base;
  }
}
