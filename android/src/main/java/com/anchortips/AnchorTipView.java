package com.anchortips;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.TouchDelegate;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.PathInterpolator;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;

/**
 * One tip bubble drawn from an {@link AnchorTipConfig}. The view is the root
 * of its own window: the bubble sits inside a transparent margin that leaves
 * room for the arrow and the shadow.
 */
@SuppressLint("ViewConstructor")
final class AnchorTipView extends ViewGroup {
  /** Radius of the rounded arrow apex, measured along each arrow edge, in dp. */
  private static final float APEX_ROUNDING = 2;
  /** Distance the bubble travels toward its anchor while it scales in, in dp. */
  private static final float TRAVEL = 6;

  interface Listener {
    void onPress(AnchorTipView view);
    void onAction(AnchorTipView view, AnchorTipConfig.Action action);
    void onClose(AnchorTipView view);
    void onOutsideTouch(AnchorTipView view);
  }

  final String tipId;
  private AnchorTipConfig config;
  private final Listener listener;

  private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Path path = new Path();
  private final LinearLayout content;
  private final LinearLayout row;
  private final TextView iconView;
  private final LinearLayout textColumn;
  private final TextView titleView;
  private final TextView messageView;
  private final TextView closeButton;
  private final LinearLayout footer;
  private final TextView stepView;
  private final LinearLayout actionsRow;

  boolean dismissing;
  private int side = AnchorTipGeometry.BOTTOM;
  private float arrowOffset;
  private int bubbleWidth;
  private int bubbleHeight;
  private int maxBubbleWidth = Integer.MAX_VALUE;

  AnchorTipView(Context context, String tipId, AnchorTipConfig config, Listener listener) {
    super(context);
    this.tipId = tipId;
    this.listener = listener;
    setWillNotDraw(false);
    setClipChildren(false);
    // Paint shadows need a software layer.
    setLayerType(LAYER_TYPE_SOFTWARE, null);
    fill.setStyle(Paint.Style.FILL);
    stroke.setStyle(Paint.Style.STROKE);

    content = new LinearLayout(context);
    content.setOrientation(LinearLayout.VERTICAL);
    content.setOnClickListener(new OnClickListener() {
      @Override
      public void onClick(View view) {
        if (!dismissing) AnchorTipView.this.listener.onPress(AnchorTipView.this);
      }
    });
    addView(content);

    row = new LinearLayout(context);
    row.setOrientation(LinearLayout.HORIZONTAL);
    // The close box overhangs the row by a few dp, like the React renderer.
    row.setClipChildren(false);
    content.setClipChildren(false);
    content.addView(row, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

    iconView = new TextView(context);
    iconView.setIncludeFontPadding(false);
    row.addView(iconView);

    textColumn = new LinearLayout(context);
    textColumn.setOrientation(LinearLayout.VERTICAL);
    row.addView(textColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
    titleView = new TextView(context);
    textColumn.addView(titleView);
    messageView = new TextView(context);
    textColumn.addView(messageView);

    closeButton = new TextView(context);
    closeButton.setText("\u2715");
    closeButton.setGravity(Gravity.CENTER);
    closeButton.setIncludeFontPadding(false);
    closeButton.setContentDescription("Dismiss");
    closeButton.setOnClickListener(new OnClickListener() {
      @Override
      public void onClick(View view) {
        if (!dismissing) AnchorTipView.this.listener.onClose(AnchorTipView.this);
      }
    });
    row.addView(closeButton, closeParams());

    footer = new LinearLayout(context);
    footer.setOrientation(LinearLayout.HORIZONTAL);
    footer.setGravity(Gravity.CENTER_VERTICAL);
    content.addView(footer, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
    stepView = new TextView(context);
    footer.addView(stepView, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
    actionsRow = new LinearLayout(context);
    actionsRow.setOrientation(LinearLayout.HORIZONTAL);
    actionsRow.setGravity(Gravity.CENTER_VERTICAL);
    footer.addView(actionsRow);

    applyConfig(config);
  }

  AnchorTipConfig getConfig() {
    return config;
  }

  private int dp(float value) {
    return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
  }

  /** A 28dp box, 8dp after the text, overhanging the row by 4dp at the top and 6dp at the end. */
  private LinearLayout.LayoutParams closeParams() {
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(28), dp(28));
    params.leftMargin = dp(8);
    params.topMargin = dp(-4);
    params.rightMargin = dp(-6);
    return params;
  }

  /** Sets a fixed line height in sp, like React Native's `lineHeight`. */
  private void setLineHeightSp(TextView view, float lineHeight) {
    int px = Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, lineHeight, getResources().getDisplayMetrics()));
    if (Build.VERSION.SDK_INT >= 28) {
      view.setLineHeight(px);
    } else {
      int fontHeight = view.getPaint().getFontMetricsInt(null);
      view.setLineSpacing(px - fontHeight, 1f);
    }
  }

  private static int colorOr(@Nullable Integer value, int fallback) {
    return value != null ? value : fallback;
  }

  private Typeface typeface(@Nullable String family, int weight) {
    Typeface base = family != null ? Typeface.create(family, Typeface.NORMAL) : Typeface.DEFAULT;
    if (Build.VERSION.SDK_INT >= 28) {
      return Typeface.create(base, Math.max(1, Math.min(1000, weight)), false);
    }
    return Typeface.create(base, weight >= 600 ? Typeface.BOLD : Typeface.NORMAL);
  }

  /** Transparent space around the bubble for the arrow and the shadow. */
  int inset() {
    AnchorTipConfig c = config;
    float shadow = c.shadowEnabled ? c.shadowRadius / 2 + Math.abs(c.shadowOffsetY) : 0;
    return dp(c.arrowHeight() + Math.max(4, shadow));
  }

  void applyConfig(AnchorTipConfig next) {
    this.config = next;

    fill.setColor(colorOr(next.backgroundColor, Color.WHITE));
    if (next.shadowEnabled) {
      int shadow = colorOr(next.shadowColor, Color.BLACK);
      int alpha = Math.round(Math.max(0, Math.min(1, next.shadowOpacity)) * 255);
      fill.setShadowLayer(dp(next.shadowRadius / 2), 0, dp(next.shadowOffsetY),
          Color.argb(alpha, Color.red(shadow), Color.green(shadow), Color.blue(shadow)));
    } else {
      fill.clearShadowLayer();
    }
    stroke.setStrokeWidth(dp(next.borderWidth));
    stroke.setColor(colorOr(next.borderColor, Color.TRANSPARENT));

    int padding = dp(next.padding);
    content.setPadding(padding, padding, padding, padding);

    iconView.setVisibility(next.icon != null ? VISIBLE : GONE);
    iconView.setText(next.icon);
    iconView.setTextColor(colorOr(next.iconColor, Color.BLUE));
    iconView.setTextSize(TypedValue.COMPLEX_UNIT_DIP, next.iconSize);
    iconView.setPadding(0, 0, dp(10), 0);

    titleView.setVisibility(next.title != null ? VISIBLE : GONE);
    titleView.setText(next.title);
    titleView.setTextColor(colorOr(next.titleColor, Color.BLACK));
    titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, next.titleFontSize);
    titleView.setTypeface(typeface(next.fontFamily, next.titleFontWeight));
    setLineHeightSp(titleView, next.titleLineHeight);

    messageView.setVisibility(next.message != null ? VISIBLE : GONE);
    messageView.setText(next.message);
    messageView.setTextColor(colorOr(next.messageColor, Color.DKGRAY));
    messageView.setTextSize(TypedValue.COMPLEX_UNIT_SP, next.messageFontSize);
    messageView.setTypeface(typeface(next.fontFamily, 400));
    setLineHeightSp(messageView, next.messageLineHeight);
    messageView.setPadding(0, next.title != null ? dp(2) : 0, 0, 0);

    closeButton.setVisibility(next.showCloseButton ? VISIBLE : GONE);
    closeButton.setTextColor(colorOr(next.closeColor, Color.GRAY));
    closeButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
    closeButton.setTypeface(typeface(null, 500));

    stepView.setText(next.stepLabel);
    stepView.setTextColor(colorOr(next.stepColor, Color.GRAY));
    stepView.setTextSize(TypedValue.COMPLEX_UNIT_SP, next.stepFontSize);
    stepView.setTypeface(typeface(next.fontFamily, 500));
    // Digits of equal width, so "2 of 3" keeps its width between steps.
    stepView.setFontFeatureSettings("tnum");

    rebuildActions(next);
    boolean hasFooter = next.stepLabel != null || !next.actions.isEmpty();
    footer.setVisibility(hasFooter ? VISIBLE : GONE);
    footer.setPadding(0, hasFooter ? dp(14) : 0, 0, 0);

    setContentDescription(next.accessibilityLabel);
    bubbleWidth = 0;
    requestLayout();
    invalidate();
  }

  private void rebuildActions(AnchorTipConfig next) {
    actionsRow.removeAllViews();
    for (final AnchorTipConfig.Action action : next.actions) {
      TextView button = new TextView(getContext());
      button.setText(action.label);
      boolean primary = "primary".equals(action.style);
      boolean cancel = "cancel".equals(action.style);
      // Hierarchy: a filled primary, colored default and destructive actions, and a neutral cancel.
      int color = primary
          ? colorOr(next.primaryTextColor, Color.WHITE)
          : "destructive".equals(action.style) ? colorOr(next.destructiveColor, Color.RED)
          : cancel ? colorOr(next.messageColor, Color.DKGRAY)
          : colorOr(next.actionColor, Color.BLUE);
      button.setTextColor(color);
      button.setTextSize(TypedValue.COMPLEX_UNIT_SP, next.actionFontSize);
      button.setTypeface(typeface(next.fontFamily, cancel ? 500 : next.actionFontWeight));
      if (primary) {
        GradientDrawable pill = new GradientDrawable();
        pill.setColor(colorOr(next.primaryBackgroundColor, Color.BLUE));
        pill.setCornerRadius(dp(999));
        button.setBackground(pill);
        button.setPadding(dp(16), dp(8), dp(16), dp(8));
      } else {
        button.setPadding(0, dp(6), 0, dp(6));
      }
      button.setOnClickListener(new OnClickListener() {
        @Override
        public void onClick(View view) {
          if (!dismissing) listener.onAction(AnchorTipView.this, action);
        }
      });
      LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
      params.leftMargin = dp(primary ? 12 : 20);
      actionsRow.addView(button, params);
    }
    actionsRow.setVisibility(next.actions.isEmpty() ? GONE : VISIBLE);
  }

  // Measurement

  /** Measure the bubble for a maximum width and return `{ width, height }` in pixels. */
  int[] measureBubble(int maxWidth) {
    maxBubbleWidth = Math.max(0, maxWidth);
    int unspecified = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED);
    content.measure(unspecified, unspecified);
    bubbleWidth = Math.min(content.getMeasuredWidth(), maxBubbleWidth);
    content.measure(MeasureSpec.makeMeasureSpec(bubbleWidth, MeasureSpec.EXACTLY), unspecified);
    bubbleHeight = content.getMeasuredHeight();
    return new int[] {bubbleWidth, bubbleHeight};
  }

  void setPlacement(int side, float arrowOffset) {
    this.side = side;
    this.arrowOffset = arrowOffset;
    invalidate();
  }

  @Override
  protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
    if (bubbleWidth == 0) measureBubble(maxBubbleWidth);
    content.measure(
        MeasureSpec.makeMeasureSpec(bubbleWidth, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(bubbleHeight, MeasureSpec.EXACTLY));
    int inset = inset();
    setMeasuredDimension(bubbleWidth + 2 * inset, bubbleHeight + 2 * inset);
  }

  @Override
  protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
    int inset = inset();
    content.layout(inset, inset, inset + bubbleWidth, inset + bubbleHeight);
    setPivotX(arrowPivotX());
    setPivotY(arrowPivotY());
    updateCloseTouchTarget();
  }

  /** Grows the 28dp close box to a 44dp touch target. */
  private void updateCloseTouchTarget() {
    if (closeButton.getVisibility() != VISIBLE) {
      content.setTouchDelegate(null);
      return;
    }
    Rect hit = new Rect();
    closeButton.getHitRect(hit);
    hit.offset(row.getLeft(), row.getTop());
    int grow = dp(8);
    hit.inset(-grow, -grow);
    content.setTouchDelegate(new TouchDelegate(hit, closeButton));
  }

  private float arrowPivotX() {
    int inset = inset();
    if (side == AnchorTipGeometry.LEFT) return inset + bubbleWidth;
    if (side == AnchorTipGeometry.RIGHT) return inset;
    return inset + arrowOffset;
  }

  private float arrowPivotY() {
    int inset = inset();
    if (side == AnchorTipGeometry.TOP) return inset + bubbleHeight;
    if (side == AnchorTipGeometry.BOTTOM) return inset;
    return inset + arrowOffset;
  }

  // Drawing

  @Override
  protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    buildPath();
    canvas.drawPath(path, fill);
    if (config.borderWidth > 0) canvas.drawPath(path, stroke);
  }

  /** Rounded rect with the arrow notched into the edge that faces the anchor, clockwise. */
  private void buildPath() {
    float inset = inset();
    float l = inset;
    float t = inset;
    float w = bubbleWidth;
    float h = bubbleHeight;
    float r = Math.min(dp(config.borderRadius), Math.min(w, h) / 2);
    float a = dp(config.arrowHeight());
    float o = arrowOffset;
    boolean arrow = a > 0;

    path.reset();
    path.moveTo(l + r, t);
    if (arrow && side == AnchorTipGeometry.BOTTOM) {
      addArrow(l + o - a, t, l + o, t - a, l + o + a, t);
    }
    path.lineTo(l + w - r, t);
    path.arcTo(new RectF(l + w - 2 * r, t, l + w, t + 2 * r), -90, 90);
    if (arrow && side == AnchorTipGeometry.LEFT) {
      addArrow(l + w, t + o - a, l + w + a, t + o, l + w, t + o + a);
    }
    path.lineTo(l + w, t + h - r);
    path.arcTo(new RectF(l + w - 2 * r, t + h - 2 * r, l + w, t + h), 0, 90);
    if (arrow && side == AnchorTipGeometry.TOP) {
      addArrow(l + o + a, t + h, l + o, t + h + a, l + o - a, t + h);
    }
    path.lineTo(l + r, t + h);
    path.arcTo(new RectF(l, t + h - 2 * r, l + 2 * r, t + h), 90, 90);
    if (arrow && side == AnchorTipGeometry.RIGHT) {
      addArrow(l, t + o + a, l - a, t + o, l, t + o - a);
    }
    path.lineTo(l, t + r);
    path.arcTo(new RectF(l, t, l + 2 * r, t + 2 * r), 180, 90);
    path.close();
  }

  /** Draws the arrow from (fx, fy) to the apex (ax, ay) to (tx, ty), with a rounded apex. */
  private void addArrow(float fx, float fy, float ax, float ay, float tx, float ty) {
    float length = (float) Math.hypot(ax - fx, ay - fy);
    float k = length > 0 ? Math.max(0, 1 - dp(APEX_ROUNDING) / length) : 0;
    path.lineTo(fx, fy);
    path.lineTo(fx + (ax - fx) * k, fy + (ay - fy) * k);
    path.quadTo(ax, ay, tx + (ax - tx) * k, ty + (ay - ty) * k);
    path.lineTo(tx, ty);
  }

  // Touches

  @Override
  public boolean dispatchTouchEvent(MotionEvent event) {
    if (event.getActionMasked() == MotionEvent.ACTION_OUTSIDE) {
      if (!dismissing) listener.onOutsideTouch(this);
      return true;
    }
    return super.dispatchTouchEvent(event);
  }

  // Animation

  /** Offset toward the anchor while hidden: `{ x, y }` in pixels. */
  private float[] hiddenTravel() {
    float travel = dp(TRAVEL);
    switch (side) {
      case AnchorTipGeometry.TOP:
        return new float[] {0, travel};
      case AnchorTipGeometry.BOTTOM:
        return new float[] {0, -travel};
      case AnchorTipGeometry.LEFT:
        return new float[] {travel, 0};
      default:
        return new float[] {-travel, 0};
    }
  }

  void animateIn() {
    if ("none".equals(config.animation)) return;
    boolean scale = "scale".equals(config.animation);
    float[] travel = scale ? hiddenTravel() : new float[] {0, 0};
    setAlpha(0f);
    setScaleX(scale ? 0.94f : 1f);
    setScaleY(scale ? 0.94f : 1f);
    setTranslationX(travel[0]);
    setTranslationY(travel[1]);
    // 240ms on cubic-bezier(0.2, 0.9, 0.3, 1), matching the React and iOS renderers.
    animate().alpha(1f).scaleX(1f).scaleY(1f).translationX(0f).translationY(0f).setDuration(240)
        .setInterpolator(new PathInterpolator(0.2f, 0.9f, 0.3f, 1f)).setListener(null).start();
  }

  void animateOut(final Runnable completion) {
    if ("none".equals(config.animation)) {
      completion.run();
      return;
    }
    boolean scale = "scale".equals(config.animation);
    float[] travel = scale ? hiddenTravel() : new float[] {0, 0};
    // 140ms on cubic-bezier(0.4, 0, 1, 1).
    animate().alpha(0f).scaleX(scale ? 0.96f : 1f).scaleY(scale ? 0.96f : 1f)
        .translationX(travel[0]).translationY(travel[1]).setDuration(140)
        .setInterpolator(new PathInterpolator(0.4f, 0f, 1f, 1f))
        .setListener(new AnimatorListenerAdapter() {
          @Override
          public void onAnimationEnd(Animator animation) {
            animate().setListener(null);
            completion.run();
          }
        })
        .start();
  }
}
