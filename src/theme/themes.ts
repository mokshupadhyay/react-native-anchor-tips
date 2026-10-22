import type { TipTheme, TipThemeOverrides, TipVariant } from '../core/types';
import { deepMerge } from '../core/merge';

const sharedLayout: TipTheme['layout'] = {
  borderRadius: 14,
  borderWidth: 0,
  padding: 14,
  maxWidth: 320,
  margin: 12,
  offset: 4,
  arrowSize: 8,
  iconSize: 22,
  spotlightPadding: 6,
  spotlightRadius: 12,
};

const sharedTypography: TipTheme['typography'] = {
  titleSize: 15,
  titleWeight: '600',
  messageSize: 14,
  actionSize: 15,
  actionWeight: '600',
  stepSize: 13,
};

export const lightTheme: TipTheme = {
  variant: 'card',
  colors: {
    background: '#FFFFFF',
    title: '#111827',
    message: '#4B5563',
    border: '#E5E7EB',
    shadow: '#000000',
    accent: '#2563EB',
    onAccent: '#FFFFFF',
    action: '#2563EB',
    destructive: '#DC2626',
    closeIcon: '#9CA3AF',
    step: '#6B7280',
    backdrop: 'rgba(17, 24, 39, 0.55)',
    invertedBackground: '#111827',
    invertedTitle: '#F9FAFB',
    invertedMessage: '#D1D5DB',
    invertedAction: '#93C5FD',
  },
  layout: sharedLayout,
  typography: sharedTypography,
  shadow: { enabled: true, opacity: 0.16, radius: 16, offsetY: 6, elevation: 8 },
};

export const darkTheme: TipTheme = {
  variant: 'card',
  colors: {
    background: '#1F2937',
    title: '#F9FAFB',
    message: '#D1D5DB',
    border: '#374151',
    shadow: '#000000',
    accent: '#3B82F6',
    onAccent: '#FFFFFF',
    action: '#60A5FA',
    destructive: '#F87171',
    closeIcon: '#9CA3AF',
    step: '#9CA3AF',
    backdrop: 'rgba(0, 0, 0, 0.6)',
    invertedBackground: '#F9FAFB',
    invertedTitle: '#111827',
    invertedMessage: '#4B5563',
    invertedAction: '#2563EB',
  },
  layout: sharedLayout,
  typography: sharedTypography,
  shadow: { enabled: true, opacity: 0.4, radius: 18, offsetY: 8, elevation: 10 },
};

/** Build a complete theme from a base theme and any number of overrides. */
export function createTheme(base: TipTheme, ...overrides: Array<TipThemeOverrides | undefined>): TipTheme {
  return deepMerge(base, ...overrides);
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
    icon: colors.accent,
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
