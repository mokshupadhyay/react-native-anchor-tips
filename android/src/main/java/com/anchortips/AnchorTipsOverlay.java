package com.anchortips;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.app.Activity;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.animation.AccelerateInterpolator;
import android.view.animation.DecelerateInterpolator;

import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Hosts native tips in small application windows added on top of the current
 * activity, so they appear above a React Native `Modal` that was open when
 * they appeared. Each bubble window is sized to its bubble; touches elsewhere
 * reach the app and are reported as outside touches. Spotlight tips add a
 * full-screen backdrop window below the bubble. Must be used on the main thread.
 */
final class AnchorTipsOverlay implements AnchorTipView.Listener {
  interface EventSink {
    void emit(String id, String kind, @Nullable String actionId, @Nullable String reason);
  }

  /** The anchor frame in screen pixels. */
  interface AnchorResolver {
    Rect resolve(Activity activity, AnchorTipConfig config);
  }

  private static final float TRAVEL_DP = 8;

  private final EventSink sink;
  private final AnchorResolver resolver;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Map<String, AnchorTipView> tips = new LinkedHashMap<>();
  private final Map<String, AnchorTipsBackdropView> backdrops = new HashMap<>();
  private final Map<String, Runnable> timers = new HashMap<>();
  @Nullable private Activity host;

  AnchorTipsOverlay(EventSink sink, AnchorResolver resolver) {
    this.sink = sink;
    this.resolver = resolver;
  }

  void show(@Nullable Activity activity, final String id, AnchorTipConfig config) {
    if (tips.containsKey(id)) {
      update(activity, id, config);
      return;
    }
    if (activity == null || activity.isFinishing()) {
      sink.emit(id, "hide", null, "dismissed");
      return;
    }
    if (host != activity) {
      removeAllImmediately();
      host = activity;
    }

    AnchorTipsBackdropView backdrop = null;
    if (config.spotlight) {
      backdrop = new AnchorTipsBackdropView(activity, new AnchorTipsBackdropView.Listener() {
        @Override
        public void onBackdropPress() {
          AnchorTipView view = tips.get(id);
          if (view != null && view.getConfig().dismissOnBackdropPress) dismiss(id, "backdrop-press");
        }
      });
      if (!attach(activity, backdrop, backdropParams())) {
        sink.emit(id, "hide", null, "dismissed");
        return;
      }
      backdrops.put(id, backdrop);
    }

    AnchorTipView view = new AnchorTipView(activity, id, config, this);
    WindowManager.LayoutParams params = bubbleParams();
    position(activity, view, params);
    if (!attach(activity, view, params)) {
      if (backdrop != null) detach(activity, backdrop);
      backdrops.remove(id);
      sink.emit(id, "hide", null, "dismissed");
      return;
    }
    tips.put(id, view);
    animateIn(view, backdrop);
    restartTimer(view);
    if (config.accessibilityLabel != null) view.announceForAccessibility(config.accessibilityLabel);
  }

  void update(@Nullable Activity activity, String id, AnchorTipConfig config) {
    AnchorTipView view = tips.get(id);
    if (view == null || view.dismissing || host == null) return;
    view.applyConfig(config);
    WindowManager.LayoutParams params = (WindowManager.LayoutParams) view.getLayoutParams();
    if (params != null) {
      position(host, view, params);
      try {
        host.getWindowManager().updateViewLayout(view, params);
      } catch (RuntimeException ignored) {
        // The window is gone together with the activity.
      }
    }
    restartTimer(view);
  }

  void dismiss(String id, final String reason) {
    final AnchorTipView view = tips.get(id);
    if (view == null) {
      sink.emit(id, "hide", null, reason);
      return;
    }
    if (view.dismissing) return;
    view.dismissing = true;
    stopTimer(id);
    final AnchorTipsBackdropView backdrop = backdrops.get(id);
    if ("none".equals(view.getConfig().animation)) {
      remove(view, reason);
      return;
    }
    if (backdrop != null) backdrop.animate().alpha(0f).setDuration(150).start();
    float[] travel = travel(view);
    float scale = "scale".equals(view.getConfig().animation) ? 0.9f : 1f;
    view.animate()
        .alpha(0f)
        .translationX(travel[0])
        .translationY(travel[1])
        .scaleX(scale)
        .scaleY(scale)
        .setDuration(150)
        .setInterpolator(new AccelerateInterpolator())
        .setListener(new AnimatorListenerAdapter() {
          @Override
          public void onAnimationEnd(Animator animation) {
            view.animate().setListener(null);
            remove(view, reason);
          }
        })
        .start();
  }

  void dismissAll() {
    for (String id : new ArrayList<>(tips.keySet())) dismiss(id, "dismissed");
  }

  /** Remove every window now, for example when the activity is destroyed. */
  void removeAllImmediately() {
    for (AnchorTipView view : new ArrayList<>(tips.values())) {
      stopTimer(view.tipId);
      sink.emit(view.tipId, "hide", null, "dismissed");
      if (host != null) detach(host, view);
    }
    if (host != null) {
      for (AnchorTipsBackdropView backdrop : backdrops.values()) detach(host, backdrop);
    }
    tips.clear();
    backdrops.clear();
    host = null;
  }

  // AnchorTipView.Listener

  @Override
  public void onPress(AnchorTipView view) {
    sink.emit(view.tipId, "press", null, null);
    if (view.getConfig().dismissOnTipPress) dismiss(view.tipId, "tip-press");
  }

  @Override
  public void onAction(AnchorTipView view, AnchorTipConfig.Action action) {
    sink.emit(view.tipId, "action", action.id, null);
    if (action.dismissOnPress) dismiss(view.tipId, "action");
  }

  @Override
  public void onClose(AnchorTipView view) {
    dismiss(view.tipId, "close-button");
  }

  @Override
  public void onOutsideTouch(AnchorTipView view) {
    if (view.getConfig().dismissOnOutsidePress) dismiss(view.tipId, "outside-press");
  }

  // Layout

  private void position(Activity activity, AnchorTipView view, WindowManager.LayoutParams params) {
    AnchorTipConfig config = view.getConfig();
    View decor = activity.getWindow().getDecorView();
    int[] origin = new int[2];
    decor.getLocationOnScreen(origin);
    int viewportWidth = decor.getWidth() > 0 ? decor.getWidth() : activity.getResources().getDisplayMetrics().widthPixels;
    int viewportHeight = decor.getHeight() > 0 ? decor.getHeight() : activity.getResources().getDisplayMetrics().heightPixels;
    Rect insets = systemInsets(activity);

    Rect anchor = new Rect(resolver.resolve(activity, config));
    anchor.offset(-origin[0], -origin[1]);

    int margin = dp(activity, config.margin);
    int maxBody = Math.max(0, Math.min(dp(activity, config.maxWidth), viewportWidth - insets.left - insets.right - 2 * margin));
    view.fitBody(maxBody);
    int arrow = config.showArrow ? dp(activity, config.arrowSize) : 0;
    AnchorTipGeometry.Layout layout = AnchorTipGeometry.compute(
        anchor, view.getBodyWidth(), view.getBodyHeight(), viewportWidth, viewportHeight, insets,
        config.placement, config.align, dp(activity, config.offset), arrow, margin, dp(activity, config.borderRadius));
    view.setPlacement(layout.placement, layout.arrowOffset, arrow);

    params.width = view.totalWidth();
    params.height = view.totalHeight();
    params.x = origin[0] + Math.round(layout.x) - view.getShadowRoom() - (layout.placement == AnchorTipGeometry.RIGHT ? arrow : 0);
    params.y = origin[1] + Math.round(layout.y) - view.getShadowRoom() - (layout.placement == AnchorTipGeometry.BOTTOM ? arrow : 0);

    AnchorTipsBackdropView backdrop = backdrops.get(view.tipId);
    if (backdrop != null) {
      float padding = dp(activity, config.spotlightPadding);
      RectF hole = new RectF(anchor);
      hole.offset(origin[0], origin[1]);
      hole.inset(-padding, -padding);
      int color = config.backdropColor != null ? config.backdropColor : 0x8C111827;
      backdrop.setHole(hole, dp(activity, config.spotlightRadius), color);
    }
  }

  private static WindowManager.LayoutParams bubbleParams() {
    WindowManager.LayoutParams params = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_APPLICATION,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
            | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH
            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT);
    params.gravity = Gravity.TOP | Gravity.LEFT;
    params.windowAnimations = 0;
    params.setTitle("AnchorTips:bubble");
    if (Build.VERSION.SDK_INT >= 28) {
      params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    }
    return params;
  }

  private static WindowManager.LayoutParams backdropParams() {
    WindowManager.LayoutParams params = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.TYPE_APPLICATION,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT);
    params.gravity = Gravity.TOP | Gravity.LEFT;
    params.windowAnimations = 0;
    params.setTitle("AnchorTips:backdrop");
    if (Build.VERSION.SDK_INT >= 28) {
      params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    }
    return params;
  }

  // Animation

  private float[] travel(AnchorTipView view) {
    if (!"scale".equals(view.getConfig().animation)) return new float[] {0, 0};
    float distance = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, TRAVEL_DP, view.getResources().getDisplayMetrics());
    switch (view.getPlacement()) {
      case AnchorTipGeometry.TOP:
        return new float[] {0, distance};
      case AnchorTipGeometry.BOTTOM:
        return new float[] {0, -distance};
      case AnchorTipGeometry.LEFT:
        return new float[] {distance, 0};
      default:
        return new float[] {-distance, 0};
    }
  }

  private void animateIn(AnchorTipView view, @Nullable AnchorTipsBackdropView backdrop) {
    String animation = view.getConfig().animation;
    if ("none".equals(animation)) return;
    float[] travel = travel(view);
    float scale = "scale".equals(animation) ? 0.9f : 1f;
    view.setAlpha(0f);
    view.setTranslationX(travel[0]);
    view.setTranslationY(travel[1]);
    view.setScaleX(scale);
    view.setScaleY(scale);
    view.animate().alpha(1f).translationX(0).translationY(0).scaleX(1f).scaleY(1f).setDuration(220)
        .setInterpolator(new DecelerateInterpolator()).setListener(null).start();
    if (backdrop != null) {
      backdrop.setAlpha(0f);
      backdrop.animate().alpha(1f).setDuration(220).start();
    }
  }

  // Timer

  private void restartTimer(final AnchorTipView view) {
    stopTimer(view.tipId);
    long duration = view.getConfig().durationMs;
    if (duration <= 0) return;
    Runnable timeout = new Runnable() {
      @Override
      public void run() {
        timers.remove(view.tipId);
        dismiss(view.tipId, "timeout");
      }
    };
    timers.put(view.tipId, timeout);
    handler.postDelayed(timeout, duration);
  }

  private void stopTimer(String id) {
    Runnable timeout = timers.remove(id);
    if (timeout != null) handler.removeCallbacks(timeout);
  }

  // Windows

  private void remove(AnchorTipView view, String reason) {
    if (tips.get(view.tipId) != view) return;
    tips.remove(view.tipId);
    stopTimer(view.tipId);
    AnchorTipsBackdropView backdrop = backdrops.remove(view.tipId);
    if (host != null) {
      detach(host, view);
      if (backdrop != null) detach(host, backdrop);
    }
    sink.emit(view.tipId, "hide", null, reason);
  }

  private static boolean attach(Activity activity, View view, WindowManager.LayoutParams params) {
    try {
      activity.getWindowManager().addView(view, params);
      return true;
    } catch (RuntimeException error) {
      // The activity window may be gone (for example during a configuration change).
      return false;
    }
  }

  private static void detach(Activity activity, View window) {
    try {
      activity.getWindowManager().removeViewImmediate(window);
    } catch (RuntimeException ignored) {
      // Already removed together with the activity.
    }
  }

  /** System bar insets of the activity window, plus the keyboard when it is visible. */
  @SuppressWarnings("deprecation")
  private static Rect systemInsets(Activity activity) {
    View decor = activity.getWindow().getDecorView();
    if (Build.VERSION.SDK_INT >= 23) {
      WindowInsets insets = decor.getRootWindowInsets();
      if (insets != null) {
        return new Rect(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
            insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
      }
    }
    int top = 0;
    int resource = activity.getResources().getIdentifier("status_bar_height", "dimen", "android");
    if (resource > 0) top = activity.getResources().getDimensionPixelSize(resource);
    return new Rect(0, top, 0, 0);
  }

  private static int dp(Activity activity, float value) {
    return Math.round(TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, value, activity.getResources().getDisplayMetrics()));
  }
}
