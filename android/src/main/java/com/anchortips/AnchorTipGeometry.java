package com.anchortips;

import android.graphics.RectF;

/** Port of `computePlacement` in `src/core/geometry.ts`; keep the two in sync. All values in pixels. */
final class AnchorTipGeometry {
  static final int TOP = 0;
  static final int BOTTOM = 1;
  static final int LEFT = 2;
  static final int RIGHT = 3;

  static final class Result {
    int side;
    /** Top-left corner of the bubble body, relative to the viewport. */
    float x;
    float y;
    /** Arrow center along the edge facing the anchor. */
    float arrowOffset;
  }

  static final class Input {
    RectF anchor;
    float bubbleWidth;
    float bubbleHeight;
    float viewportWidth;
    float viewportHeight;
    float insetTop;
    float insetBottom;
    float insetLeft;
    float insetRight;
    String preference = "auto";
    String align = "center";
    float offset;
    float arrowSize;
    float margin;
    float borderRadius;
  }

  private AnchorTipGeometry() {}

  private static float clamp(float value, float min, float max) {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  }

  private static boolean vertical(int side) {
    return side == TOP || side == BOTTOM;
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
    return anchorStart + anchorLength / 2 - length / 2;
  }

  static Result compute(Input in) {
    float reach = in.offset + in.arrowSize;
    float[] space = new float[4];
    space[TOP] = in.anchor.top - in.insetTop - in.margin;
    space[BOTTOM] = in.viewportHeight - in.insetBottom - in.margin - in.anchor.bottom;
    space[LEFT] = in.anchor.left - in.insetLeft - in.margin;
    space[RIGHT] = in.viewportWidth - in.insetRight - in.margin - in.anchor.right;
    float usableWidth = in.viewportWidth - in.insetLeft - in.insetRight - 2 * in.margin;
    float usableHeight = in.viewportHeight - in.insetTop - in.insetBottom - 2 * in.margin;

    int side = space[TOP] > space[BOTTOM] ? TOP : BOTTOM;
    for (int candidate : order(in.preference)) {
      boolean fits = vertical(candidate)
          ? space[candidate] >= in.bubbleHeight + reach && in.bubbleWidth <= usableWidth
          : space[candidate] >= in.bubbleWidth + reach && in.bubbleHeight <= usableHeight;
      if (fits) {
        side = candidate;
        break;
      }
    }

    float minX = in.insetLeft + in.margin;
    float maxX = in.viewportWidth - in.insetRight - in.margin - in.bubbleWidth;
    float minY = in.insetTop + in.margin;
    float maxY = in.viewportHeight - in.insetBottom - in.margin - in.bubbleHeight;
    float x;
    float y;
    if (vertical(side)) {
      x = clamp(crossStart(in.anchor.left, in.anchor.width(), in.bubbleWidth, in.align), minX, maxX);
      y = side == BOTTOM ? in.anchor.bottom + reach : in.anchor.top - reach - in.bubbleHeight;
      y = clamp(y, minY, maxY);
    } else {
      y = clamp(crossStart(in.anchor.top, in.anchor.height(), in.bubbleHeight, in.align), minY, maxY);
      x = side == RIGHT ? in.anchor.right + reach : in.anchor.left - reach - in.bubbleWidth;
      x = clamp(x, minX, maxX);
    }

    float length = vertical(side) ? in.bubbleWidth : in.bubbleHeight;
    float center = vertical(side) ? in.anchor.centerX() - x : in.anchor.centerY() - y;
    float edge = Math.min(length / 2, in.borderRadius + in.arrowSize);

    Result result = new Result();
    result.side = side;
    result.x = x;
    result.y = y;
    result.arrowOffset = clamp(center, edge, length - edge);
    return result;
  }
}
