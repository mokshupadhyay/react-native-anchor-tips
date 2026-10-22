package com.anchortips;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.List;

/**
 * One tip bubble drawn from an {@link AnchorTipConfig}. The view is sized to
 * the bubble body, plus the arrow on the side facing the anchor, plus room
 * for the shadow on every side.
 */
@SuppressLint("ViewConstructor")
final class AnchorTipView extends ViewGroup {
  interface Listener {
    void onPress(AnchorTipView view);
    void onAction(AnchorTipView view, AnchorTipConfig.Action action);
    void onClose(AnchorTipView view);
    void onOutsideTouch(AnchorTipView view);
  }

  private static final float ICON_GAP = 10;
  private static final float CLOSE_GAP = 12;
  private static final float CLOSE_TOUCH_PADDING = 6;
  private static final float TITLE_GAP = 3;
  private static final float FOOTER_GAP = 12;
  private static final float ACTION_GAP = 16;
  private static final float STEP_GAP = 12;

  final String tipId;
  private AnchorTipConfig config;
  private final Listener listener;

  private final TextView iconView;
  private final TextView titleView;
  private final TextView messageView;
  private final TextView closeView;
  private final TextView stepView;
  private final List<TextView> actionViews = new ArrayList<>();
  private final List<AnchorTipConfig.Action> actions = new ArrayList<>();

  private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Path path = new Path();
  private final RectF arc = new RectF();

  boolean dismissing;
  private int placement = AnchorTipGeometry.BOTTOM;
  private float arrowOffset;
  private int arrowSize;
  private int bodyWidth;
  private int bodyHeight;
  private int shadowRoom;

  AnchorTipView(Context context, String tipId, AnchorTipConfig config, Listener listener) {
    super(context);
    this.tipId = tipId;
    this.listener = listener;
    setWillNotDraw(false);
    setClipChildren(false);
    // Paint shadows on paths need software rendering before Android 9.
    setLayerType(LAYER_TYPE_SOFTWARE, null);
    stroke.setStyle(Paint.Style.STROKE);

    iconView = addText(context);
    iconView.setGravity(Gravity.CENTER);
    titleView = addText(context);
    messageView = addText(context);
    stepView = addText(context);
    closeView = addText(context);
    closeView.setText("\u2715");
    closeView.setContentDescription("Dismiss");
    int touch = dp(CLOSE_TOUCH_PADDING);
    closeView.setPadding(touch, touch, touch, touch);
    closeView.setOnClickListener(new OnClickListener() {
      @Override
      public void onClick(View view) {
        if (!dismissing) AnchorTipView.this.listener.onClose(AnchorTipView.this);
      }
    });

    setOnClickListener(new OnClickListener() {
      @Override
      public void onClick(View view) {
        if (!dismissing) AnchorTipView.this.listener.onPress(AnchorTipView.this);
      }
    });
    applyConfig(config);
  }

  private TextView addText(Context context) {
    TextView view = new TextView(context);
    view.setIncludeFontPadding(false);
    addView(view);
    return view;
  }

  AnchorTipConfig getConfig() {
    return config;
  }

  int getPlacement() {
    return placement;
  }

  int getShadowRoom() {
    return shadowRoom;
  }

  int getArrowSize() {
    return arrowSize;
  }

  int getBodyWidth() {
    return bodyWidth;
  }

  int getBodyHeight() {
    return bodyHeight;
  }

  private int dp(float value) {
    return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
  }

  private static int colorOr(@Nullable Integer value, int fallback) {
    return value != null ? value : fallback;
  }

  private static Typeface typeface(@Nullable String family, int weight) {
    Typeface base = family != null ? Typeface.create(family, Typeface.NORMAL) : Typeface.DEFAULT;
    if (Build.VERSION.SDK_INT >= 28) return Typeface.create(base, Math.max(1, Math.min(1000, weight)), false);
    return Typeface.create(base, weight >= 600 ? Typeface.BOLD : Typeface.NORMAL);
  }

  private static void setText(TextView view, @Nullable String text) {
    view.setVisibility(text != null ? VISIBLE : GONE);
    view.setText(text);
  }

  void applyConfig(AnchorTipConfig next) {
    config = next;

    fill.setColor(colorOr(next.backgroundColor, Color.WHITE));
    stroke.setStrokeWidth(dp(next.borderWidth));
    stroke.setColor(colorOr(next.borderColor, Color.TRANSPARENT));
    if (next.shadowEnabled) {
      int shadow = colorOr(next.shadowColor, Color.BLACK);
      int alpha = Math.round(Math.max(0, Math.min(1, next.shadowOpacity)) * 255);
      fill.setShadowLayer(Math.max(1, dp(next.shadowRadius / 2f)), 0, dp(next.shadowOffsetY),
          Color.argb(alpha, Color.red(shadow), Color.green(shadow), Color.blue(shadow)));
      shadowRoom = dp(next.shadowRadius / 2f + next.shadowOffsetY + 2);
    } else {
      fill.clearShadowLayer();
      shadowRoom = dp(2);
    }

    setText(iconView, next.icon);
    iconView.setTextColor(colorOr(next.iconColor, Color.BLUE));
    iconView.setTextSize(TypedValue.COMPLEX_UNIT_SP, next.iconSize);

    setText(titleView, next.title);
    titleView.setTextColor(colorOr(next.titleColor, Color.BLACK));
    titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, next.titleFontSize);
    titleView.setTypeface(typeface(next.fontFamily, next.titleFontWeight));

    setText(messageView, next.message);
    messageView.setTextColor(colorOr(next.messageColor, Color.DKGRAY));
    messageView.setTextSize(TypedValue.COMPLEX_UNIT_SP, next.messageFontSize);
    messageView.setTypeface(typeface(next.fontFamily, 400));
    messageView.setLineSpacing(0, 1.2f);

    setText(stepView, next.stepLabel);
    stepView.setTextColor(colorOr(next.stepColor, Color.GRAY));
    stepView.setTextSize(TypedValue.COMPLEX_UNIT_SP, next.stepFontSize);
    stepView.setTypeface(typeface(next.fontFamily, 400));

    closeView.setVisibility(next.showCloseButton ? VISIBLE : GONE);
    closeView.setTextColor(colorOr(next.closeColor, Color.GRAY));
    closeView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);

    rebuildActions(next);
    setContentDescription(next.accessibilityLabel);
    requestLayout();
    invalidate();
  }

  private void rebuildActions(AnchorTipConfig next) {
    for (TextView view : actionViews) removeView(view);
    actionViews.clear();
    actions.clear();
    for (final AnchorTipConfig.Action action : next.actions) {
      TextView button = new TextView(getContext());
      button.setIncludeFontPadding(false);
      button.setText(action.label);
      button.setGravity(Gravity.CENTER);
      button.setTextSize(TypedValue.COMPLEX_UNIT_SP, next.actionFontSize);
      button.setTypeface(typeface(next.fontFamily, "cancel".equals(action.style) ? 400 : next.actionFontWeight));
      if ("primary".equals(action.style)) {
        button.setTextColor(colorOr(next.primaryTextColor, Color.WHITE));
        GradientDrawable pill = new GradientDrawable();
        pill.setColor(colorOr(next.primaryBackgroundColor, Color.BLUE));
        pill.setCornerRadius(dp(999));
        button.setBackground(pill);
        button.setPadding(dp(14), dp(7), dp(14), dp(7));
      } else {
        boolean destructive = "destructive".equals(action.style);
        button.setTextColor(destructive ? colorOr(next.destructiveColor, Color.RED) : colorOr(next.actionColor, Color.BLUE));
        button.setPadding(0, dp(4), 0, dp(4));
      }
      button.setOnClickListener(new OnClickListener() {
        @Override
        public void onClick(View view) {
          if (!dismissing) listener.onAction(AnchorTipView.this, action);
        }
      });
      addView(button);
      actionViews.add(button);
      actions.add(action);
    }
  }

  // Measurement

  private static final class Metrics {
    int iconWidth;
    int iconHeight;
    int titleHeight;
    int messageHeight;
    int textWidth;
    int rowHeight;
    int stepWidth;
    int stepHeight;
    int footerWidth;
    int footerHeight;
    boolean hasFooter;
  }

  private static boolean visible(View view) {
    return view.getVisibility() != GONE;
  }

  private static void measureText(View view, int maxWidth) {
    if (!visible(view)) return;
    view.measure(MeasureSpec.makeMeasureSpec(Math.max(0, maxWidth), MeasureSpec.AT_MOST),
        MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED));
  }

  private int closeGlyphWidth() {
    return visible(closeView) ? closeView.getMeasuredWidth() - 2 * dp(CLOSE_TOUCH_PADDING) : 0;
  }

  private Metrics metrics(int width, boolean fitting) {
    Metrics metrics = new Metrics();
    int inner = Math.max(0, width - 2 * dp(config.padding));
    measureText(iconView, inner);
    measureText(closeView, inner);
    metrics.iconWidth = visible(iconView) ? iconView.getMeasuredWidth() : 0;
    metrics.iconHeight = visible(iconView) ? iconView.getMeasuredHeight() : 0;
    int iconSpace = visible(iconView) ? metrics.iconWidth + dp(ICON_GAP) : 0;
    int closeSpace = visible(closeView) ? closeGlyphWidth() + dp(CLOSE_GAP) : 0;
    int textMax = Math.max(0, inner - iconSpace - closeSpace);

    measureText(titleView, textMax);
    measureText(messageView, textMax);
    int titleWidth = visible(titleView) ? titleView.getMeasuredWidth() : 0;
    int messageWidth = visible(messageView) ? messageView.getMeasuredWidth() : 0;
    metrics.titleHeight = visible(titleView) ? titleView.getMeasuredHeight() : 0;
    metrics.messageHeight = visible(messageView) ? messageView.getMeasuredHeight() : 0;
    metrics.textWidth = fitting ? Math.max(titleWidth, messageWidth) : textMax;
    int gap = visible(titleView) && visible(messageView) ? dp(TITLE_GAP) : 0;
    int closeHeight = visible(closeView) ? closeView.getMeasuredHeight() - 2 * dp(CLOSE_TOUCH_PADDING) : 0;
    metrics.rowHeight = Math.max(metrics.titleHeight + gap + metrics.messageHeight, Math.max(metrics.iconHeight, closeHeight));

    measureText(stepView, inner);
    metrics.stepWidth = visible(stepView) ? stepView.getMeasuredWidth() : 0;
    metrics.stepHeight = visible(stepView) ? stepView.getMeasuredHeight() : 0;
    int actionsWidth = 0;
    int actionsHeight = 0;
    for (int index = 0; index < actionViews.size(); index++) {
      TextView button = actionViews.get(index);
      measureText(button, inner);
      actionsWidth += button.getMeasuredWidth() + (index > 0 ? dp(ACTION_GAP) : 0);
      actionsHeight = Math.max(actionsHeight, button.getMeasuredHeight());
    }
    metrics.hasFooter = !actionViews.isEmpty() || visible(stepView);
    metrics.footerWidth = metrics.stepWidth + (visible(stepView) && !actionViews.isEmpty() ? dp(STEP_GAP) : 0) + actionsWidth;
    metrics.footerHeight = Math.max(metrics.stepHeight, actionsHeight);
    return metrics;
  }

  /** Measure the bubble body, without arrow and shadow, for at most `maxWidth` px. */
  void fitBody(int maxWidth) {
    int padding = dp(config.padding);
    Metrics fitting = metrics(maxWidth, true);
    int iconSpace = visible(iconView) ? fitting.iconWidth + dp(ICON_GAP) : 0;
    int closeSpace = visible(closeView) ? closeGlyphWidth() + dp(CLOSE_GAP) : 0;
    int rowWidth = iconSpace + fitting.textWidth + closeSpace;
    bodyWidth = Math.min(maxWidth, Math.max(rowWidth, fitting.footerWidth) + 2 * padding);
    // Text wraps differently at the final width; measure the height there.
    Metrics atWidth = metrics(bodyWidth, false);
    bodyHeight = 2 * padding + atWidth.rowHeight + (atWidth.hasFooter ? dp(FOOTER_GAP) + atWidth.footerHeight : 0);
  }

  void setPlacement(int placement, float arrowOffset, int arrowSize) {
    this.placement = placement;
    this.arrowOffset = arrowOffset;
    this.arrowSize = arrowSize;
    requestLayout();
    invalidate();
  }

  private int bodyLeft() {
    return shadowRoom + (placement == AnchorTipGeometry.RIGHT ? arrowSize : 0);
  }

  private int bodyTop() {
    return shadowRoom + (placement == AnchorTipGeometry.BOTTOM ? arrowSize : 0);
  }

  int totalWidth() {
    return bodyWidth + 2 * shadowRoom + (AnchorTipGeometry.isVertical(placement) ? 0 : arrowSize);
  }

  int totalHeight() {
    return bodyHeight + 2 * shadowRoom + (AnchorTipGeometry.isVertical(placement) ? arrowSize : 0);
  }

  @Override
  protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
    metrics(bodyWidth, false);
    setMeasuredDimension(totalWidth(), totalHeight());
  }

  @Override
  protected void onLayout(boolean changed, int l, int t, int r, int b) {
    Metrics metrics = metrics(bodyWidth, false);
    int padding = dp(config.padding);
    int left = bodyLeft();
    int top = bodyTop();

    int x = left + padding;
    if (visible(iconView)) {
      iconView.layout(x, top + padding, x + metrics.iconWidth, top + padding + metrics.iconHeight);
      x += metrics.iconWidth + dp(ICON_GAP);
    }
    if (visible(titleView)) {
      titleView.layout(x, top + padding, x + metrics.textWidth, top + padding + metrics.titleHeight);
    }
    if (visible(messageView)) {
      int messageTop = top + padding + metrics.titleHeight + (visible(titleView) ? dp(TITLE_GAP) : 0);
      messageView.layout(x, messageTop, x + metrics.textWidth, messageTop + metrics.messageHeight);
    }
    if (visible(closeView)) {
      int touch = dp(CLOSE_TOUCH_PADDING);
      int closeRight = left + bodyWidth - padding + touch;
      int closeTop = top + padding - touch;
      closeView.layout(closeRight - closeView.getMeasuredWidth(), closeTop, closeRight, closeTop + closeView.getMeasuredHeight());
    }
    if (metrics.hasFooter) {
      int footerTop = top + padding + metrics.rowHeight + dp(FOOTER_GAP);
      if (visible(stepView)) {
        int stepTop = footerTop + (metrics.footerHeight - metrics.stepHeight) / 2;
        stepView.layout(left + padding, stepTop, left + padding + metrics.stepWidth, stepTop + metrics.stepHeight);
      }
      int right = left + bodyWidth - padding;
      for (int index = actionViews.size() - 1; index >= 0; index--) {
        TextView button = actionViews.get(index);
        int width = button.getMeasuredWidth();
        int height = button.getMeasuredHeight();
        int buttonTop = footerTop + (metrics.footerHeight - height) / 2;
        button.layout(right - width, buttonTop, right, buttonTop + height);
        right -= width + dp(ACTION_GAP);
      }
    }
  }

  // Drawing

  /** The rounded body with the arrow traced into the edge that faces the anchor. */
  private void buildPath() {
    float left = bodyLeft();
    float top = bodyTop();
    float w = bodyWidth;
    float h = bodyHeight;
    float r = Math.min(dp(config.borderRadius), Math.min(w, h) / 2f);
    float s = arrowSize;
    float a = arrowOffset;
    boolean arrow = s > 0;

    path.reset();
    path.moveTo(left + r, top);
    if (arrow && placement == AnchorTipGeometry.BOTTOM) {
      path.lineTo(left + a - s, top);
      path.lineTo(left + a, top - s);
      path.lineTo(left + a + s, top);
    }
    path.lineTo(left + w - r, top);
    arc.set(left + w - 2 * r, top, left + w, top + 2 * r);
    path.arcTo(arc, -90, 90, false);
    if (arrow && placement == AnchorTipGeometry.LEFT) {
      path.lineTo(left + w, top + a - s);
      path.lineTo(left + w + s, top + a);
      path.lineTo(left + w, top + a + s);
    }
    path.lineTo(left + w, top + h - r);
    arc.set(left + w - 2 * r, top + h - 2 * r, left + w, top + h);
    path.arcTo(arc, 0, 90, false);
    if (arrow && placement == AnchorTipGeometry.TOP) {
      path.lineTo(left + a + s, top + h);
      path.lineTo(left + a, top + h + s);
      path.lineTo(left + a - s, top + h);
    }
    path.lineTo(left + r, top + h);
    arc.set(left, top + h - 2 * r, left + 2 * r, top + h);
    path.arcTo(arc, 90, 90, false);
    if (arrow && placement == AnchorTipGeometry.RIGHT) {
      path.lineTo(left, top + a + s);
      path.lineTo(left - s, top + a);
      path.lineTo(left, top + a - s);
    }
    path.lineTo(left, top + r);
    arc.set(left, top, left + 2 * r, top + 2 * r);
    path.arcTo(arc, 180, 90, false);
    path.close();
  }

  @Override
  protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    buildPath();
    canvas.drawPath(path, fill);
    if (stroke.getStrokeWidth() > 0) canvas.drawPath(path, stroke);
  }

  // Touches

  @SuppressLint("ClickableViewAccessibility")
  @Override
  public boolean dispatchTouchEvent(MotionEvent event) {
    if (event.getActionMasked() == MotionEvent.ACTION_OUTSIDE) {
      if (!dismissing) listener.onOutsideTouch(this);
      return true;
    }
    return super.dispatchTouchEvent(event);
  }
}
