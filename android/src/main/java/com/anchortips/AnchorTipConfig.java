package com.anchortips;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Immutable, fully resolved tip description. Parsed once from the
 * JavaScript config so views never read bridge types. Sizes are in dp.
 */
final class AnchorTipConfig {
  static final class Action {
    final String id;
    final String label;
    final String style;
    final boolean dismissOnPress;

    Action(String id, String label, String style, boolean dismissOnPress) {
      this.id = id;
      this.label = label;
      this.style = style;
      this.dismissOnPress = dismissOnPress;
    }
  }

  @Nullable String title;
  @Nullable String message;
  @Nullable String icon;
  @Nullable String stepLabel;
  String placement = "auto";
  String align = "center";
  boolean showArrow = true;
  boolean showCloseButton = true;
  long durationMs;
  boolean dismissOnOutsidePress = true;
  boolean dismissOnTipPress;
  boolean spotlight;
  boolean dismissOnBackdropPress = true;
  String animation = "scale";
  @Nullable String accessibilityLabel;
  /** Anchor frame from `measureInWindow`, in dp. */
  float anchorX;
  float anchorY;
  float anchorWidth;
  float anchorHeight;
  @Nullable Integer anchorTag;
  List<Action> actions = Collections.emptyList();

  @Nullable Integer backgroundColor;
  @Nullable Integer borderColor;
  float borderWidth;
  float borderRadius = 14;
  @Nullable Integer titleColor;
  @Nullable Integer messageColor;
  @Nullable Integer iconColor;
  @Nullable Integer actionColor;
  @Nullable Integer primaryBackgroundColor;
  @Nullable Integer primaryTextColor;
  @Nullable Integer destructiveColor;
  @Nullable Integer closeColor;
  @Nullable Integer stepColor;
  @Nullable Integer backdropColor;
  @Nullable Integer shadowColor;
  @Nullable String fontFamily;
  float titleFontSize = 15;
  int titleFontWeight = 600;
  float titleLineHeight = 20;
  float messageFontSize = 14;
  float messageLineHeight = 19;
  float actionFontSize = 14;
  int actionFontWeight = 600;
  float stepFontSize = 13;
  float padding = 14;
  float maxWidth = 320;
  float margin = 12;
  float offset = 4;
  float arrowSize = 7;
  float iconSize = 22;
  float spotlightPadding = 8;
  float spotlightRadius = 16;
  boolean shadowEnabled = true;
  float shadowOpacity = 0.12f;
  float shadowRadius = 20;
  float shadowOffsetY = 8;

  static AnchorTipConfig from(@Nullable ReadableMap map) {
    AnchorTipConfig config = new AnchorTipConfig();
    if (map == null) return config;

    config.title = string(map, "title", null);
    config.message = string(map, "message", null);
    config.icon = string(map, "icon", null);
    config.stepLabel = string(map, "stepLabel", null);
    config.placement = string(map, "placement", "auto");
    config.align = string(map, "align", "center");
    config.showArrow = bool(map, "showArrow", true);
    config.showCloseButton = bool(map, "showCloseButton", true);
    config.durationMs = (long) number(map, "duration", 0);
    config.dismissOnOutsidePress = bool(map, "dismissOnOutsidePress", true);
    config.dismissOnTipPress = bool(map, "dismissOnTipPress", false);
    config.spotlight = bool(map, "spotlight", false);
    config.dismissOnBackdropPress = bool(map, "dismissOnBackdropPress", true);
    config.animation = string(map, "animation", "scale");
    config.accessibilityLabel = string(map, "accessibilityLabel", null);
    config.actions = actions(map);
    if (present(map, "anchorTag") && map.getType("anchorTag") == ReadableType.Number) {
      config.anchorTag = (int) map.getDouble("anchorTag");
    }

    ReadableMap anchor = map(map, "anchor");
    if (anchor != null) {
      config.anchorX = (float) number(anchor, "x", 0);
      config.anchorY = (float) number(anchor, "y", 0);
      config.anchorWidth = (float) number(anchor, "width", 0);
      config.anchorHeight = (float) number(anchor, "height", 0);
    }

    ReadableMap style = map(map, "style");
    if (style != null) {
      config.backgroundColor = color(style, "backgroundColor");
      config.borderColor = color(style, "borderColor");
      config.borderWidth = (float) number(style, "borderWidth", 0);
      config.borderRadius = (float) number(style, "borderRadius", 14);
      config.titleColor = color(style, "titleColor");
      config.messageColor = color(style, "messageColor");
      config.iconColor = color(style, "iconColor");
      config.actionColor = color(style, "actionColor");
      config.primaryBackgroundColor = color(style, "primaryBackgroundColor");
      config.primaryTextColor = color(style, "primaryTextColor");
      config.destructiveColor = color(style, "destructiveColor");
      config.closeColor = color(style, "closeColor");
      config.stepColor = color(style, "stepColor");
      config.backdropColor = color(style, "backdropColor");
      config.shadowColor = color(style, "shadowColor");
      config.fontFamily = string(style, "fontFamily", null);
      config.titleFontSize = (float) number(style, "titleFontSize", 15);
      config.titleFontWeight = weight(style, "titleFontWeight", 600);
      config.titleLineHeight = (float) number(style, "titleLineHeight", 20);
      config.messageFontSize = (float) number(style, "messageFontSize", 14);
      config.messageLineHeight = (float) number(style, "messageLineHeight", Math.round(config.messageFontSize * 1.35));
      config.actionFontSize = (float) number(style, "actionFontSize", 14);
      config.actionFontWeight = weight(style, "actionFontWeight", 600);
      config.stepFontSize = (float) number(style, "stepFontSize", 13);
      config.padding = (float) number(style, "padding", 14);
      config.maxWidth = (float) number(style, "maxWidth", 320);
      config.margin = (float) number(style, "margin", 12);
      config.offset = (float) number(style, "offset", 4);
      config.arrowSize = (float) number(style, "arrowSize", 7);
      config.iconSize = (float) number(style, "iconSize", 22);
      config.spotlightPadding = (float) number(style, "spotlightPadding", 8);
      config.spotlightRadius = (float) number(style, "spotlightRadius", 16);
      config.shadowEnabled = bool(style, "shadowEnabled", true);
      config.shadowOpacity = (float) number(style, "shadowOpacity", 0.12);
      config.shadowRadius = (float) number(style, "shadowRadius", 20);
      config.shadowOffsetY = (float) number(style, "shadowOffsetY", 8);
    }
    return config;
  }

  float arrowHeight() {
    return showArrow ? arrowSize : 0;
  }

  private static boolean present(ReadableMap map, String key) {
    return map.hasKey(key) && !map.isNull(key);
  }

  @Nullable
  private static ReadableMap map(ReadableMap map, String key) {
    return present(map, key) && map.getType(key) == ReadableType.Map ? map.getMap(key) : null;
  }

  @Nullable
  private static String string(ReadableMap map, String key, @Nullable String fallback) {
    if (!present(map, key) || map.getType(key) != ReadableType.String) return fallback;
    String value = map.getString(key);
    return value == null || value.isEmpty() ? fallback : value;
  }

  private static double number(ReadableMap map, String key, double fallback) {
    return present(map, key) && map.getType(key) == ReadableType.Number ? map.getDouble(key) : fallback;
  }

  private static boolean bool(ReadableMap map, String key, boolean fallback) {
    return present(map, key) && map.getType(key) == ReadableType.Boolean ? map.getBoolean(key) : fallback;
  }

  /** `processColor` produces a 32-bit ARGB number; wrap it into an `int`. */
  @Nullable
  private static Integer color(ReadableMap map, String key) {
    if (!present(map, key) || map.getType(key) != ReadableType.Number) return null;
    return (int) (long) map.getDouble(key);
  }

  private static int weight(ReadableMap map, String key, int fallback) {
    String value = string(map, key, null);
    if (value == null) return fallback;
    try {
      return Integer.parseInt(value);
    } catch (NumberFormatException ignored) {
      return fallback;
    }
  }

  private static List<Action> actions(ReadableMap map) {
    if (!present(map, "actions") || map.getType("actions") != ReadableType.Array) return Collections.emptyList();
    ReadableArray array = map.getArray("actions");
    List<Action> actions = new ArrayList<>();
    if (array == null) return actions;
    for (int index = 0; index < array.size(); index++) {
      if (array.getType(index) != ReadableType.Map) continue;
      ReadableMap action = array.getMap(index);
      if (action == null) continue;
      actions.add(new Action(
          string(action, "id", String.valueOf(index)),
          string(action, "label", ""),
          string(action, "style", "default"),
          bool(action, "dismissOnPress", true)));
    }
    return actions;
  }
}
