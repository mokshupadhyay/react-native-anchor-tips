import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TipAction, TipRenderProps } from '../core/types';
import { resolveTipVisuals } from '../theme/themes';

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

/** The built-in tip content. The bubble and arrow around it are drawn by the host. */
export function DefaultTip(props: TipRenderProps<unknown>): React.ReactElement {
  const { options, theme, styles, dismiss, tip } = props;
  const visuals = resolveTipVisuals(theme, options.variant ?? theme.variant);
  const { layout, typography } = theme;
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
                { color: visuals.title, fontSize: typography.titleSize, fontWeight: typography.titleWeight },
                font,
                styles.title,
              ]}>
              {options.title}
            </Text>
          ) : null}
          {options.message ? (
            <Text
              style={[
                { color: visuals.message, fontSize: typography.messageSize, lineHeight: Math.round(typography.messageSize * 1.35) },
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
            hitSlop={HIT_SLOP}
            onPress={() => dismiss('close-button')}
            style={[baseStyles.close, styles.closeButton]}>
            <Text style={[{ color: visuals.closeIcon, fontSize: 14 }, styles.closeIcon]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {hasFooter ? (
        <View style={[baseStyles.footer, styles.footer]}>
          {options.stepLabel ? (
            <Text style={[baseStyles.step, { color: visuals.step, fontSize: typography.stepSize }, font, styles.step]}>
              {options.stepLabel}
            </Text>
          ) : (
            <View style={baseStyles.step} />
          )}
          <View style={[baseStyles.actions, styles.actions]}>
            {options.actions.map((action, index) => {
              const primary = action.style === 'primary';
              const color = primary
                ? visuals.primaryText
                : action.style === 'destructive'
                  ? visuals.destructive
                  : visuals.action;
              return (
                <TouchableOpacity
                  key={action.id ?? String(index)}
                  accessibilityRole="button"
                  hitSlop={HIT_SLOP}
                  onPress={() => onAction(action)}
                  style={[
                    baseStyles.action,
                    primary && [baseStyles.primary, { backgroundColor: visuals.primaryBackground }],
                    styles.action,
                  ]}>
                  <Text
                    style={[
                      {
                        color,
                        fontSize: typography.actionSize,
                        fontWeight: action.style === 'cancel' ? '400' : typography.actionWeight,
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
    marginTop: 3,
  },
  close: {
    marginLeft: 12,
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  step: {
    flexGrow: 1,
    marginRight: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
    marginLeft: 16,
    paddingVertical: 4,
  },
  primary: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
});
