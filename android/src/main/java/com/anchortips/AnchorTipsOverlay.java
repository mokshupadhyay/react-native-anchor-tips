package com.anchortips;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;

import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Hosts native tips in application windows added over the current activity.
 * Each bubble has a window sized to itself, so touches elsewhere reach the
 * app and report an outside touch. Spotlight tips add a full-screen backdrop
 * window below their bubble. Must be used on the main thread.
 */
final class AnchorTipsOverlay implements AnchorTipView.Listener, AnchorTipBackdropView.Listener {
  interface EventSink {
    void emit(String id, String kind, @Nullable String actionId, @Nullable String reason);
  }

  private static final class Entry {
    final AnchorTipView view;
    @Nullable AnchorTipBackdropView backdrop;
    /** Anchor frame in screen pixels. */
    RectF anchor;
    @Nullable Runnable timeout;

    Entry(AnchorTipView view, RectF anchor) {
      this.view = view;
      this.anchor = anchor;
    }
  }

  private final EventSink sink;
  private final Map<String, Entry> tips = new LinkedHashMap<>();
  private final Handler handler = new Handler(Looper.getMainLooper());
  @Nullable private Activity host;

  AnchorTipsOverlay(EventSink sink) {
    this.sink = sink;
  }

  void show(@Nullable Activity activity, String id, AnchorTipConfig config, RectF anchor) {
    if (tips.containsKey(id)) {
      update(id, config, anchor);
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

    AnchorTipView view = new AnchorTipView(activity, id, config, this);
    Entry entry = new Entry(view, anchor);
    if (config.spotlight) entry.backdrop = addBackdrop(activity, id);

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
    params.setTitle("AnchorTip:" + id);
    if (Build.VERSION.SDK_INT >= 28) {
      params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    }
    position(activity, entry, params);

    try {
      activity.getWindowManager().addView(view, params);
    } catch (RuntimeException error) {
      // The activity window may be gone (for example during a configuration change).
      if (entry.backdrop != null) detach(activity, entry.backdrop);
      sink.emit(id, "hide", null, "dismissed");
      return;
    }
    tips.put(id, entry);
    view.animateIn();
    restartTimer(id, entry);
    if (config.accessibilityLabel != null) view.announceForAccessibility(config.accessibilityLabel);
  }

  void update(String id, AnchorTipConfig config, RectF anchor) {
    Entry entry = tips.get(id);
    if (entry == null || entry.view.dismissing || host == null) return;
    entry.anchor = anchor;
    entry.view.applyConfig(config);
    if (config.spotlight && entry.backdrop == null) {
      entry.backdrop = addBackdrop(host, id);
    } else if (!config.spotlight && entry.backdrop != null) {
      detach(host, entry.backdrop);
      entry.backdrop = null;
    }
    WindowManager.LayoutParams params = (WindowManager.LayoutParams) entry.view.getLayoutParams();
    if (params != null) {
      position(host, entry, params);
      try {
        host.getWindowManager().updateViewLayout(entry.view, params);
      } catch (RuntimeException ignored) {
        // Removed together with the activity.
      }
    }
    restartTimer(id, entry);
  }

  void dismiss(String id, final String reason) {
    final Entry entry = tips.get(id);
    if (entry == null) {
      sink.emit(id, "hide", null, reason);
      return;
    }
    if (entry.view.dismissing) return;
    entry.view.dismissing = true;
    cancelTimer(entry);
    if (entry.backdrop != null) entry.backdrop.animate().alpha(0f).setDuration(150).start();
    entry.view.animateOut(new Runnable() {
      @Override
      public void run() {
        remove(entry, reason);
      }
    });
  }

  void dismissAll() {
    for (String id : new ArrayList<>(tips.keySet())) dismiss(id, "dismissed");
  }

  /** Remove every window now, for example when the activity is destroyed. */
  void removeAllImmediately() {
    for (Entry entry : new ArrayList<>(tips.values())) {
      cancelTimer(entry);
      if (host != null) {
        detach(host, entry.view);
        if (entry.backdrop != null) detach(host, entry.backdrop);
      }
      sink.emit(entry.view.tipId, "hide", null, "dismissed");
    }
    tips.clear();
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
    AnchorTipConfig config = view.getConfig();
    if (config.dismissOnOutsidePress && !config.spotlight) dismiss(view.tipId, "outside-press");
  }

  // AnchorTipBackdropView.Listener

  @Override
  public void onBackdropTap(AnchorTipBackdropView backdrop) {
    Entry entry = tips.get(backdrop.tipId);
    if (entry == null || entry.view.dismissing) return;
    if (entry.view.getConfig().dismissOnBackdropPress) dismiss(backdrop.tipId, "backdrop-press");
  }

  // Layout

  /** Fit the bubble next to its anchor inside the activity's safe area. */
  private void position(Activity activity, Entry entry, WindowManager.LayoutParams params) {
    AnchorTipConfig config = entry.view.getConfig();
    View decor = activity.getWindow().getDecorView();
    int[] origin = new int[2];
    decor.getLocationOnScreen(origin);
    int[] insets = systemInsets(activity);
    float width = decor.getWidth() > 0 ? decor.getWidth() : activity.getResources().getDisplayMetrics().widthPixels;
    float height = decor.getHeight() > 0 ? decor.getHeight() : activity.getResources().getDisplayMetrics().heightPixels;

    AnchorTipGeometry.Input input = new AnchorTipGeometry.Input();
    input.anchor = new RectF(entry.anchor);
    input.anchor.offset(-origin[0], -origin[1]);
    input.viewportWidth = width;
    input.viewportHeight = height;
    input.insetTop = insets[0];
    input.insetBottom = insets[1];
    input.insetLeft = insets[2];
    input.insetRight = insets[3];
    input.preference = config.placement;
    input.align = config.align;
    input.offset = dp(activity, config.offset);
    input.arrowSize = dp(activity, config.arrowHeight());
    input.margin = dp(activity, config.margin);
    input.borderRadius = dp(activity, config.borderRadius);

    float maxWidth = Math.min(dp(activity, config.maxWidth), width - input.insetLeft - input.insetRight - 2 * input.margin);
    int[] size = entry.view.measureBubble(Math.round(maxWidth));
    input.bubbleWidth = size[0];
    input.bubbleHeight = size[1];

    AnchorTipGeometry.Result result = AnchorTipGeometry.compute(input);
    entry.view.setPlacement(result.side, result.arrowOffset);
    int inset = entry.view.inset();
    params.x = origin[0] + Math.round(result.x) - inset;
    params.y = origin[1] + Math.round(result.y) - inset;

    if (entry.backdrop != null) {
      float padding = dp(activity, config.spotlightPadding);
      RectF hole = new RectF(entry.anchor);
      hole.inset(-padding, -padding);
      int color = config.backdropColor != null ? config.backdropColor : Color.argb(140, 0, 0, 0);
      entry.backdrop.setHole(hole, dp(activity, config.spotlightRadius), color);
    }
  }

  private AnchorTipBackdropView addBackdrop(Activity activity, String id) {
    AnchorTipBackdropView backdrop = new AnchorTipBackdropView(activity, id, this);
    WindowManager.LayoutParams params = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.TYPE_APPLICATION,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT);
    params.windowAnimations = 0;
    params.setTitle("AnchorTipBackdrop:" + id);
    if (Build.VERSION.SDK_INT >= 28) {
      params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    }
    try {
      activity.getWindowManager().addView(backdrop, params);
    } catch (RuntimeException ignored) {
      return backdrop;
    }
    backdrop.setAlpha(0f);
    backdrop.animate().alpha(1f).setDuration(200).start();
    return backdrop;
  }

  private void remove(Entry entry, String reason) {
    String id = entry.view.tipId;
    if (tips.get(id) != entry) return;
    tips.remove(id);
    if (host != null) {
      detach(host, entry.view);
      if (entry.backdrop != null) detach(host, entry.backdrop);
    }
    sink.emit(id, "hide", null, reason);
  }

  // Timers

  private void restartTimer(final String id, Entry entry) {
    cancelTimer(entry);
    long duration = entry.view.getConfig().durationMs;
    if (duration <= 0) return;
    entry.timeout = new Runnable() {
      @Override
      public void run() {
        dismiss(id, "timeout");
      }
    };
    handler.postDelayed(entry.timeout, duration);
  }

  private void cancelTimer(Entry entry) {
    if (entry.timeout != null) handler.removeCallbacks(entry.timeout);
    entry.timeout = null;
  }

  private static void detach(Activity activity, View window) {
    try {
      activity.getWindowManager().removeViewImmediate(window);
    } catch (RuntimeException ignored) {
      // Already removed together with the activity.
    }
  }

  /** Top, bottom, left and right insets of the activity window, in pixels. */
  @SuppressWarnings("deprecation")
  private static int[] systemInsets(Activity activity) {
    View decor = activity.getWindow().getDecorView();
    if (Build.VERSION.SDK_INT >= 23) {
      WindowInsets insets = decor.getRootWindowInsets();
      if (insets != null) {
        return new int[] {
          insets.getSystemWindowInsetTop(),
          insets.getSystemWindowInsetBottom(),
          insets.getSystemWindowInsetLeft(),
          insets.getSystemWindowInsetRight(),
        };
      }
    }
    int top = 0;
    int resource = activity.getResources().getIdentifier("status_bar_height", "dimen", "android");
    if (resource > 0) top = activity.getResources().getDimensionPixelSize(resource);
    return new int[] {top, 0, 0, 0};
  }

  private static float dp(Activity activity, float value) {
    return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, activity.getResources().getDisplayMetrics());
  }
}
