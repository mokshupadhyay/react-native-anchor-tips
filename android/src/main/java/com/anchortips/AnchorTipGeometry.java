package com.anchortips;

import android.graphics.Rect;

/** Port of `computePlacement` in src/core/geometry.ts; keep the two in sync. All values in px. */
final class AnchorTipGeometry {
  static final int TOP = 0;
  static final int BOTTOM = 1;
  static final int LEFT = 2;
  static final int RIGHT = 3;

  static final class Layout {
    int placement;
    /** Top-left corner of the bubble body. */
    float x;
    float y;
    /** Arrow center along the edge facing the anchor, from the body's left (top/bottom) or top (left/right). */
    float arrowOffset;
  }

  private AnchorTipGeometry() {}

  static boolean isVertical(int placement) {
    return placement == TOP || placement == BOTTOM;
  }

  private static float clamp(float value, float min, float max) {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  }

  private static int[] order(String preference) {
    if ("top".equals(preference)) return new int[] {TOP, BOTTOM, RIGHT, LEFT};
    if ("right".equals(preference)) return new int[] {RIGHT, LEFT, BOTTOM, TOP};
    if ("left".equals(preference)) return new int[] {LEFT, RIGHT, BOTTOM, TOP};
    return new int[] {BOTTOM, TOP, RIGHT, LEFT};
  }

  private static float crossStart(float anchorStart, float anchorLength, float length, String align) {
    if ("start".equals(align)) return anchorStart;
    if ("end".equals(align)) return anchorStart + anchorLength - length;
    return anchorStart + anchorLength / 2f - length / 2f;
  }

  static Layout compute(
      Rect anchor,
      float bubbleWidth,
      float bubbleHeight,
      float viewportWidth,
      float viewportHeight,
      Rect insets,
      String preference,
      String align,
      float offset,
      float arrowSize,
      float margin,
      float borderRadius) {
    float spaceTop = anchor.top - insets.top - margin;
    float spaceBottom = viewportHeight - insets.bottom - margin - anchor.bottom;
    float spaceLeft = anchor.left - insets.left - margin;
    float spaceRight = viewportWidth - insets.right - margin - anchor.right;
    float reach = offset + arrowSize;
    float usableWidth = viewportWidth - insets.left - insets.right - 2 * margin;
    float usableHeight = viewportHeight - insets.top - insets.bottom - 2 * margin;

    int placement = spaceTop > spaceBottom ? TOP : BOTTOM;
    for (int side : order(preference)) {
      boolean fits;
      switch (side) {
        case TOP:
          fits = spaceTop >= bubbleHeight + reach && bubbleWidth <= usableWidth;
          break;
        case BOTTOM:
          fits = spaceBottom >= bubbleHeight + reach && bubbleWidth <= usableWidth;
          break;
        case LEFT:
          fits = spaceLeft >= bubbleWidth + reach && bubbleHeight <= usableHeight;
          break;
        default:
          fits = spaceRight >= bubbleWidth + reach && bubbleHeight <= usableHeight;
          break;
      }
      if (fits) {
        placement = side;
        break;
      }
    }

    float minX = insets.left + margin;
    float maxX = viewportWidth - insets.right - margin - bubbleWidth;
    float minY = insets.top + margin;
    float maxY = viewportHeight - insets.bottom - margin - bubbleHeight;
    float x;
    float y;
    if (isVertical(placement)) {
      x = clamp(crossStart(anchor.left, anchor.width(), bubbleWidth, align), minX, maxX);
      y = placement == BOTTOM ? anchor.bottom + reach : anchor.top - reach - bubbleHeight;
      y = clamp(y, minY, maxY);
    } else {
      y = clamp(crossStart(anchor.top, anchor.height(), bubbleHeight, align), minY, maxY);
      x = placement == RIGHT ? anchor.right + reach : anchor.left - reach - bubbleWidth;
      x = clamp(x, minX, maxX);
    }

    boolean vertical = isVertical(placement);
    float length = vertical ? bubbleWidth : bubbleHeight;
    float center = vertical ? anchor.exactCenterX() - x : anchor.exactCenterY() - y;
    float edge = Math.min(length / 2f, borderRadius + arrowSize);

    Layout layout = new Layout();
    layout.placement = placement;
    layout.x = x;
    layout.y = y;
    layout.arrowOffset = clamp(center, edge, length - edge);
    return layout;
  }
}
