import type React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

/** The side of the anchor the tip appears on. */
export type TipPlacement = 'top' | 'bottom' | 'left' | 'right';

/** `auto` picks the side with room, preferring below, then above, then the sides. */
export type TipPlacementPreference = TipPlacement | 'auto';

/** How the tip lines up with the anchor along the placement edge. */
export type TipAlignment = 'start' | 'center' | 'end';

/** Why a tip left the screen. */
export type TipDismissReason =
  | 'action'
  | 'close-button'
  | 'tip-press'
  | 'outside-press'
  | 'backdrop-press'
  | 'timeout'
  | 'anchor-removed'
  | 'replaced'
  | 'dismissed';

/**
 * `react` renders the tip with React components inside `<TipHost />`.
 * `native` draws it in a native overlay window above every screen and modal;
 * only theme-driven content (no React elements) is supported there.
 */
export type TipPresentation = 'react' | 'native';

/**
 * `card`: light surface with a shadow, like system tips.
 * `filled`: the accent color as the background.
 * `inverted`: a dark bubble on light themes and a light one on dark themes, like a classic tooltip.
 */
export type TipVariant = 'card' | 'filled' | 'inverted';

export type TipAnimationPreset = 'scale' | 'fade' | 'none';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface EdgeInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Anything React Native can measure: a host component instance. */
export interface MeasurableNode {
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
}

/** An anchor registered with `<TipAnchor id>` / `useTipAnchor(id)`, or a ref to any view. */
export type TipAnchorTarget = string | { current: MeasurableNode | null };

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends readonly unknown[]
      ? T[K]
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K];
};

export interface TipTheme {
  variant: TipVariant;
  colors: {
    background: string;
    title: string;
    message: string;
    border: string;
    shadow: string;
    /** Icon tint, primary action background and the `filled` background. */
    accent: string;
    /** Text drawn on the accent color. */
    onAccent: string;
    action: string;
    destructive: string;
    closeIcon: string;
    /** Step counter in tours. */
    step: string;
    /** Dimmed screen behind spotlight tips. */
    backdrop: string;
    /** Surface colors of the `inverted` variant. */
    invertedBackground: string;
    invertedTitle: string;
    invertedMessage: string;
    invertedAction: string;
  };
  layout: {
    borderRadius: number;
    borderWidth: number;
    padding: number;
    maxWidth: number;
    /** Minimum distance from the screen's safe edges. */
    margin: number;
    /** Gap between the anchor and the tip of the arrow. */
    offset: number;
    /** Height of the arrow; its base is twice as wide. `0` hides it. */
    arrowSize: number;
    iconSize: number;
    /** Space between the anchor and the spotlight cutout. */
    spotlightPadding: number;
    spotlightRadius: number;
  };
  typography: {
    fontFamily?: string;
    titleSize: number;
    titleWeight: TextStyle['fontWeight'];
    messageSize: number;
    actionSize: number;
    actionWeight: TextStyle['fontWeight'];
    stepSize: number;
  };
  shadow: {
    enabled: boolean;
    opacity: number;
    radius: number;
    offsetY: number;
    elevation: number;
  };
}

export type TipThemeOverrides = DeepPartial<TipTheme>;

/** Style slots of the built-in tip. Every slot accepts a regular style. */
export interface TipStyleOverrides {
  bubble?: StyleProp<ViewStyle>;
  arrow?: StyleProp<ViewStyle>;
  content?: StyleProp<ViewStyle>;
  icon?: StyleProp<TextStyle>;
  textContainer?: StyleProp<ViewStyle>;
  title?: StyleProp<TextStyle>;
  message?: StyleProp<TextStyle>;
  footer?: StyleProp<ViewStyle>;
  step?: StyleProp<TextStyle>;
  actions?: StyleProp<ViewStyle>;
  action?: StyleProp<ViewStyle>;
  actionText?: StyleProp<TextStyle>;
  closeButton?: StyleProp<ViewStyle>;
  closeIcon?: StyleProp<TextStyle>;
  backdrop?: StyleProp<ViewStyle>;
}

export interface TipHandle {
  id: string;
  dismiss: (reason?: TipDismissReason) => void;
  update: (options: TipUpdate) => void;
}

export interface TipAction {
  /** Defaults to the action's index. */
  id?: string;
  label: string;
  /** `primary` draws a filled button. Default: `default`. */
  style?: 'default' | 'primary' | 'cancel' | 'destructive';
  onPress?: (tip: TipHandle) => void;
  /** Default: `true`. */
  dismissOnPress?: boolean;
}

/** A glyph string or emoji, a React element, or `null` for no icon. Native presentation supports strings only. */
export type TipIcon = string | React.ReactElement | null;

export interface TipRenderProps<P = unknown> {
  tip: TipRecord<P>;
  options: ResolvedTipOptions<P>;
  theme: TipTheme;
  styles: TipStyleOverrides;
  /** The side the tip ended up on after fitting it on screen. */
  placement: TipPlacement;
  dismiss: (reason?: TipDismissReason) => void;
  update: (options: TipUpdate<P>) => void;
}

export type TipRenderer<P = unknown> = (props: TipRenderProps<P>) => React.ReactNode;

export interface TipOptions<P = unknown> {
  /**
   * Stable id. Showing an id that is already visible updates that tip.
   * Defaults to the anchor id when the anchor is a string. Display history is kept per id.
   */
  id?: string;
  title?: string;
  message?: string;
  icon?: TipIcon;
  /** Default: `auto`. */
  placement?: TipPlacementPreference;
  /** Default: `center`. */
  align?: TipAlignment;
  /** Default: `true`. */
  showArrow?: boolean;
  /** Default: `true`. */
  showCloseButton?: boolean;
  actions?: TipAction[];
  /** Hide after this many milliseconds. `0` keeps the tip until it is dismissed. Default: `0`. */
  duration?: number;
  /** Dismiss when the user touches anywhere outside the tip. The touch still reaches the app. Default: `true`. */
  dismissOnOutsidePress?: boolean;
  /** Dismiss when the tip itself is pressed. Default: `false`. */
  dismissOnTipPress?: boolean;
  /** Dim the screen and cut out the anchor. The backdrop blocks touches. Default: `false`. */
  spotlight?: boolean;
  /** Default: `true`. */
  dismissOnBackdropPress?: boolean;
  /**
   * Show the tip at most this many times, counted across launches when a
   * `storage` is configured. Requires a stable `id` (or a string anchor).
   */
  maxDisplayCount?: number;
  variant?: TipVariant;
  theme?: TipThemeOverrides;
  styles?: TipStyleOverrides;
  /** Default: `scale`. */
  animation?: TipAnimationPreset;
  presentation?: TipPresentation;
  /** Fully custom content inside the bubble. React presentation only. */
  render?: TipRenderer<P>;
  /** Custom data passed to renderers. */
  props?: P;
  accessibilityLabel?: string;
  /** Small caption next to the actions, for example "2 of 5" in tours. */
  stepLabel?: string;
  onPress?: (tip: TipHandle) => void;
  onShow?: (tip: TipHandle) => void;
  onHide?: (tip: TipHandle, reason: TipDismissReason) => void;
}

export type TipUpdate<P = unknown> = Omit<TipOptions<P>, 'id' | 'presentation'>;

export interface ResolvedTipOptions<P = unknown>
  extends Omit<
    TipOptions<P>,
    | 'placement'
    | 'align'
    | 'showArrow'
    | 'showCloseButton'
    | 'actions'
    | 'duration'
    | 'dismissOnOutsidePress'
    | 'dismissOnTipPress'
    | 'spotlight'
    | 'dismissOnBackdropPress'
    | 'animation'
  > {
  placement: TipPlacementPreference;
  align: TipAlignment;
  showArrow: boolean;
  showCloseButton: boolean;
  actions: TipAction[];
  duration: number;
  dismissOnOutsidePress: boolean;
  dismissOnTipPress: boolean;
  spotlight: boolean;
  dismissOnBackdropPress: boolean;
  animation: TipAnimationPreset;
}

/**
 * `pending`: waiting for its anchor to be measured, its display rule, or a free slot.
 * `visible`: on screen. `exiting`: animating out.
 */
export type TipPhase = 'pending' | 'visible' | 'exiting';

export interface TipRecord<P = unknown> {
  id: string;
  /** Unique per record, even when an id is reused after its tip exited. */
  key: string;
  anchor: TipAnchorTarget;
  options: TipOptions<P>;
  presentation: TipPresentation;
  phase: TipPhase;
  /** Anchor frame in window coordinates, once measured. */
  anchorRect: Rect | null;
  /** Native view tag of the anchor, used by the native overlay where available. */
  anchorTag: number | null;
  createdAt: number;
  /** Increments on every update and re-measure. */
  revision: number;
  exitReason?: TipDismissReason;
}

/** AsyncStorage-compatible key-value storage for display history. */
export interface TipStorage {
  getItem(key: string): string | null | undefined | Promise<string | null | undefined>;
  setItem(key: string, value: string): void | Promise<void>;
}

export interface TipConfig {
  /** Maximum tips on screen at once; later tips wait. Default: 1. */
  maxVisible?: number;
  /** `system` follows the device appearance. Default: `system`. */
  colorScheme?: 'light' | 'dark' | 'system';
  /** Overrides applied on top of the light or dark base theme. */
  theme?: TipThemeOverrides;
  /** Per-scheme overrides, applied after `theme`. */
  lightTheme?: TipThemeOverrides;
  darkTheme?: TipThemeOverrides;
  /** Defaults for every tip. */
  defaults?: Omit<TipOptions, 'id' | 'render' | 'props' | 'stepLabel'>;
  /** A custom renderer for every React tip without its own `render`. */
  renderer?: TipRenderer<any>;
  styles?: TipStyleOverrides;
  /** Persists `maxDisplayCount` history, for example `@react-native-async-storage/async-storage`. */
  storage?: TipStorage;
}
