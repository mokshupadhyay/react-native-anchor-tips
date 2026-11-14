import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  type LayoutChangeEvent,
  Platform,
  type StyleProp,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
} from 'react-native';
import type {
  EdgeInsets,
  Rect,
  Size,
  TipConfig,
  TipDismissReason,
  TipPlacement,
  TipRecord,
  TipRenderProps,
  TipUpdate,
} from '../core/types';
import type { TipStore } from '../core/store';
import {
  accessibilityLabelFor,
  type ColorScheme,
  resolveStyleSlots,
  resolveTheme,
  resolveTipOptions,
} from '../core/resolve';
import { computePlacement, type PlacementResult, spotlightRect } from '../core/geometry';
import { resolveTipVisuals } from '../theme/themes';
import { DefaultTip } from './DefaultTip';

/** Distance the bubble travels toward its anchor while it scales in. */
const SCALE_TRAVEL = 6;
/** Scale the bubble grows from when it appears, and shrinks to when it leaves. */
const ENTER_SCALE = 0.94;
const EXIT_SCALE = 0.96;
const ENTER_EASING = Easing.bezier(0.2, 0.9, 0.3, 1);
const EXIT_EASING = Easing.bezier(0.4, 0, 1, 1);

export interface TipItemProps {
  record: TipRecord;
  store: TipStore;
  config: TipConfig;
  scheme: ColorScheme;
  viewport: Size;
  insets: EdgeInsets;
  /** Host position in window coordinates; anchors are measured in window coordinates. */
  hostOrigin: { x: number; y: number };
  onBubbleFrame: (key: string, frame: Rect | null) => void;
}

function travel(placement: TipPlacement): { x: number; y: number } {
  switch (placement) {
    case 'top':
      return { x: 0, y: SCALE_TRAVEL };
    case 'bottom':
      return { x: 0, y: -SCALE_TRAVEL };
    case 'left':
      return { x: SCALE_TRAVEL, y: 0 };
    case 'right':
      return { x: -SCALE_TRAVEL, y: 0 };
  }
}

/** Rotated square centered on the bubble edge that faces the anchor. */
function arrowFrame(placement: PlacementResult, size: Size, arrowSize: number): { left: number; top: number; side: number } {
  const side = arrowSize * Math.SQRT2;
  let cx = placement.arrowOffset;
  let cy = placement.arrowOffset;
  if (placement.placement === 'bottom') cy = 0;
  else if (placement.placement === 'top') cy = size.height;
  else if (placement.placement === 'right') cx = 0;
  else cx = size.width;
  return { left: cx - side / 2, top: cy - side / 2, side };
}

export function TipItem(props: TipItemProps): React.ReactElement | null {
  const { record, store, config, scheme, viewport, insets, hostOrigin, onBubbleFrame } = props;
  const options = React.useMemo(() => resolveTipOptions(record, config), [record, config]);
  const theme = React.useMemo(() => resolveTheme(config, scheme, options.theme), [config, scheme, options.theme]);
  const styles = React.useMemo(() => resolveStyleSlots(config, options), [config, options]);
  const visuals = resolveTipVisuals(theme, options.variant ?? theme.variant);
  const { layout, shadow } = theme;

  const progress = React.useRef(new Animated.Value(0)).current;
  const [size, setSize] = React.useState<Size | null>(null);
  const mounted = React.useRef(true);
  const isVisible = record.phase === 'visible';
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => active && setReduceMotion(enabled))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  const anchorRect = record.anchorRect;
  const anchor: Rect | null = anchorRect
    ? { ...anchorRect, x: anchorRect.x - hostOrigin.x, y: anchorRect.y - hostOrigin.y }
    : null;
  const noMotion = reduceMotion || options.animation === 'none';
  const arrowSize = options.showArrow ? layout.arrowSize : 0;
  const placement =
    anchor && size
      ? computePlacement({
          anchor,
          bubble: size,
          viewport,
          insets,
          placement: options.placement,
          align: options.align,
          offset: layout.offset,
          arrowSize,
          margin: layout.margin,
          borderRadius: layout.borderRadius,
        })
      : null;
  const ready = placement !== null;

  React.useEffect(
    () => () => {
      mounted.current = false;
      onBubbleFrame(record.key, null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  React.useEffect(() => {
    if (placement && size) onBubbleFrame(record.key, { x: placement.x, y: placement.y, width: size.width, height: size.height });
  });

  React.useEffect(() => {
    if (!isVisible || !ready) return;
    if (noMotion) progress.setValue(1);
    else Animated.timing(progress, { toValue: 1, duration: 240, easing: ENTER_EASING, useNativeDriver: true }).start();
    const label = accessibilityLabelFor(options);
    if (label && Platform.OS === 'ios' && AccessibilityInfo.announceForAccessibility) {
      AccessibilityInfo.announceForAccessibility(label);
    }
    // Animate and announce once per appearance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, ready]);

  React.useEffect(() => {
    if (record.phase !== 'exiting') return;
    const finish = () => {
      // A host switch unmounts the item mid-exit; the new host finishes it.
      if (mounted.current) store.remove(record.key);
    };
    if (noMotion || !ready) finish();
    else Animated.timing(progress, { toValue: 0, duration: 140, easing: EXIT_EASING, useNativeDriver: true }).start(finish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.phase]);

  // Android back button closes a tip that closes on an outside press.
  const closeOnBack = isVisible && options.dismissOnOutsidePress && record.presentation === 'react';
  React.useEffect(() => {
    if (!closeOnBack || Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      store.dismiss(record.id, 'outside-press');
      return true;
    });
    return () => subscription.remove();
  }, [closeOnBack, record.id, store]);

  React.useEffect(() => {
    if (!isVisible || options.duration <= 0) return undefined;
    const timeout = setTimeout(() => store.dismiss(record.id, 'timeout'), options.duration);
    return () => clearTimeout(timeout);
  }, [isVisible, options.duration, record.revision, record.id, store]);

  const dismiss = React.useCallback(
    (reason?: TipDismissReason) => store.dismiss(record.id, reason),
    [record.id, store],
  );
  const update = React.useCallback((patch: TipUpdate) => store.update(record.id, patch), [record.id, store]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  };

  const Renderer = (options.render ?? config.renderer ?? DefaultTip) as unknown as React.ComponentType<
    TipRenderProps<unknown>
  >;
  const content = (
    <Renderer
      tip={record}
      options={options}
      theme={theme}
      styles={styles}
      placement={placement ? placement.placement : 'bottom'}
      dismiss={dismiss}
      update={update}
    />
  );

  const maxWidth = Math.max(
    0,
    Math.min(layout.maxWidth, viewport.width - insets.left - insets.right - 2 * layout.margin),
  );
  const shift = placement ? travel(placement.placement) : { x: 0, y: 0 };
  const scale = !noMotion && options.animation === 'scale';
  const animatedStyle = {
    opacity: progress,
    transform: scale
      ? [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [shift.x, 0] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [shift.y, 0] }) },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              // The switch happens at progress 1, where both ranges give 1.
              outputRange: [record.phase === 'exiting' ? EXIT_SCALE : ENTER_SCALE, 1],
            }),
          },
        ]
      : [],
  };
  const surface = {
    backgroundColor: visuals.background,
    borderColor: visuals.border,
    borderWidth: visuals.borderWidth,
  };
  const iosShadow =
    visuals.shadow && Platform.OS === 'ios'
      ? {
          shadowColor: theme.colors.shadow,
          shadowOpacity: shadow.opacity,
          shadowRadius: shadow.radius / 2,
          shadowOffset: { width: 0, height: shadow.offsetY },
        }
      : null;
  const androidElevation = visuals.shadow && Platform.OS === 'android' ? { elevation: shadow.elevation } : null;
  const arrow = placement && size && arrowSize > 0 ? arrowFrame(placement, size, arrowSize) : null;

  const pressable = options.dismissOnTipPress || options.onPress != null;
  const onPress = () => {
    if (options.onPress) options.onPress(store.handle(record.id));
    if (options.dismissOnTipPress) store.dismiss(record.id, 'tip-press');
  };

  const bubble = (
    <View
      onLayout={onLayout}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        baseStyles.bubble,
        surface,
        { borderRadius: layout.borderRadius, maxWidth },
        androidElevation,
        styles.bubble,
      ]}>
      {content}
    </View>
  );

  const backdrop =
    options.spotlight && anchor ? (
      <Spotlight
        hole={spotlightRect(anchor, layout.spotlightPadding)}
        radius={layout.spotlightRadius}
        viewport={viewport}
        color={theme.colors.backdrop}
        progress={progress}
        style={styles.backdrop}
        onPress={() => {
          if (options.dismissOnBackdropPress) store.dismiss(record.id, 'backdrop-press');
        }}
      />
    ) : null;

  return (
    <>
      {backdrop}
      <Animated.View
        pointerEvents={record.phase === 'exiting' || !ready ? 'none' : 'box-none'}
        style={[
          baseStyles.positioner,
          { left: placement ? placement.x : 0, top: placement ? placement.y : 0 },
          !ready && baseStyles.measuring,
          iosShadow,
          animatedStyle,
        ]}>
        {arrow ? (
          <View
            pointerEvents="none"
            style={[
              baseStyles.arrow,
              surface,
              { left: arrow.left, top: arrow.top, width: arrow.side, height: arrow.side },
              androidElevation,
              styles.arrow,
            ]}
          />
        ) : null}
        {pressable ? <TouchableWithoutFeedback onPress={onPress}>{bubble}</TouchableWithoutFeedback> : bubble}
      </Animated.View>
    </>
  );
}

interface SpotlightProps {
  hole: Rect;
  radius: number;
  viewport: Size;
  color: string;
  progress: Animated.Value;
  style: StyleProp<ViewStyle>;
  onPress: () => void;
}

/**
 * Dims everything except the anchor. One view with a huge border draws the
 * rounded cutout; four transparent rects around the hole take the touches,
 * so touches inside the hole still reach the anchor.
 */
function Spotlight({ hole, radius, viewport, color, progress, style, onPress }: SpotlightProps): React.ReactElement {
  const border = Math.ceil(Math.hypot(viewport.width, viewport.height)) + radius;
  const catcher = { onStartShouldSetResponder: () => true, onResponderRelease: onPress };
  const right = hole.x + hole.width;
  const bottom = hole.y + hole.height;
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          baseStyles.absolute,
          {
            left: hole.x - border,
            top: hole.y - border,
            width: hole.width + 2 * border,
            height: hole.height + 2 * border,
            borderWidth: border,
            borderRadius: radius + border,
            borderColor: color,
            opacity: progress,
          },
          style,
        ]}
      />
      <View {...catcher} style={[baseStyles.absolute, { left: 0, top: 0, right: 0, height: Math.max(0, hole.y) }]} />
      <View {...catcher} style={[baseStyles.absolute, { left: 0, right: 0, top: bottom, bottom: 0 }]} />
      <View {...catcher} style={[baseStyles.absolute, { left: 0, width: Math.max(0, hole.x), top: hole.y, height: hole.height }]} />
      <View {...catcher} style={[baseStyles.absolute, { left: right, right: 0, top: hole.y, height: hole.height }]} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  positioner: {
    position: 'absolute',
  },
  measuring: {
    opacity: 0,
  },
  bubble: {
    overflow: 'hidden',
  },
  arrow: {
    position: 'absolute',
    // Rounds the apex; the other corners sit under the bubble.
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  absolute: {
    position: 'absolute',
  },
});
