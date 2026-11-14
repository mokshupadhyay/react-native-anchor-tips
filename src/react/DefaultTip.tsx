import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TipAction, TipRenderProps } from '../core/types';
import { resolveLineHeights, resolveTipVisuals } from '../theme/themes';

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
/** Grows the 28pt close box to a 44pt touch target. */
const CLOSE_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/** The built-in tip content. The bubble and arrow around it are drawn by the host. */
export function DefaultTip(props: TipRenderProps<unknown>): React.ReactElement {
  const { options, theme, styles, dismiss, tip } = props;
  const visuals = resolveTipVisuals(theme, options.variant ?? theme.variant);
  const { layout, typography } = theme;
  const lineHeights = resolveLineHeights(typography);
  const font = typography.fontFamily ? { fontFamily: typography.fontFamily } : null;
  const handle = { id: tip.id, dismiss, update: props.update };
  const hasFooter = options.actions.length > 0 || Boolean(options.stepLabel);

  const onAction = (action: TipAction) => {
    if (action.onPress) action.onPress(handle);
    if (action.dismissOnPress !== false) dismiss('action');
  };

  const icon = options.icon;
  let iconView: React.ReactNode = null;
  if (typeof icon === 'string' && icon.length > 0) {
    iconView = (
      <Text
        allowFontScaling={false}
        style={[baseStyles.icon, { color: visuals.icon, fontSize: layout.iconSize, lineHeight: layout.iconSize + 4 }, styles.icon]}>
        {icon}
      </Text>
    );
  } else if (icon != null && React.isValidElement(icon)) {
    iconView = <View style={baseStyles.iconSlot}>{icon}</View>;
  }

  return (
    <View style={[{ padding: layout.padding }, styles.content]}>
      <View style={baseStyles.row}>
        {iconView}
        <View style={[baseStyles.text, styles.textContainer]}>
          {options.title ? (
            <Text
              style={[
                { color: visuals.title, fontSize: typography.titleSize, fontWeight: typography.titleWeight, lineHeight: lineHeights.title },
                font,
                styles.title,
              ]}>
              {options.title}
            </Text>
          ) : null}
          {options.message ? (
            <Text
              style={[
                { color: visuals.message, fontSize: typography.messageSize, lineHeight: lineHeights.message },
                options.title ? baseStyles.messageBelowTitle : null,
                font,
                styles.message,
              ]}>
              {options.message}
            </Text>
          ) : null}
        </View>
        {options.showCloseButton ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={CLOSE_HIT_SLOP}
            onPress={() => dismiss('close-button')}
            style={[baseStyles.close, styles.closeButton]}>
            <Text style={[baseStyles.closeGlyph, { color: visuals.closeIcon }, styles.closeIcon]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {hasFooter ? (
        <View style={[baseStyles.footer, styles.footer]}>
          {options.stepLabel ? (
            <Text style={[baseStyles.step, baseStyles.stepText, { color: visuals.step, fontSize: typography.stepSize }, font, styles.step]}>
              {options.stepLabel}
            </Text>
          ) : (
            <View style={baseStyles.step} />
          )}
          <View style={[baseStyles.actions, styles.actions]}>
            {options.actions.map((action, index) => {
              const primary = action.style === 'primary';
              const cancel = action.style === 'cancel';
              // Hierarchy: a filled primary, colored default and destructive
              // actions, and a neutral cancel.
              const color = primary
                ? visuals.primaryText
                : action.style === 'destructive'
                  ? visuals.destructive
                  : cancel
                    ? visuals.message
                    : visuals.action;
              return (
                <TouchableOpacity
                  key={action.id ?? String(index)}
                  accessibilityRole="button"
                  hitSlop={HIT_SLOP}
                  onPress={() => onAction(action)}
                  style={[
                    primary ? [baseStyles.primary, { backgroundColor: visuals.primaryBackground }] : baseStyles.action,
                    styles.action,
                  ]}>
                  <Text
                    style={[
                      {
                        color,
                        fontSize: typography.actionSize,
                        fontWeight: cancel ? '500' : typography.actionWeight,
                      },
                      font,
                      styles.actionText,
                    ]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: 10,
    fontWeight: '600',
  },
  iconSlot: {
    marginRight: 10,
  },
  text: {
    flexShrink: 1,
  },
  messageBelowTitle: {
    marginTop: 2,
  },
  close: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginTop: -4,
    marginRight: -6,
  },
  closeGlyph: {
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  step: {
    flexGrow: 1,
    marginRight: 12,
  },
  stepText: {
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
    marginLeft: 20,
    paddingVertical: 6,
  },
  primary: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
});
