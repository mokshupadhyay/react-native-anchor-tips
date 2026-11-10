package com.anchortips;

import android.app.Activity;
import android.graphics.Rect;
import android.graphics.RectF;
import android.util.DisplayMetrics;
import android.view.View;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.uimanager.UIManagerHelper;

/** Shared implementation behind the old- and new-architecture modules. */
final class AnchorTipsModuleImpl implements LifecycleEventListener {
  static final String NAME = "AnchorTips";
  private static final String EVENT = "AnchorTipsEvent";

  private final ReactApplicationContext context;
  private final AnchorTipsOverlay overlay;
  private boolean invalidated;

  AnchorTipsModuleImpl(ReactApplicationContext context) {
    this.context = context;
    this.overlay = new AnchorTipsOverlay(new AnchorTipsOverlay.EventSink() {
      @Override
      public void emit(String id, String kind, @Nullable String actionId, @Nullable String reason) {
        emitEvent(id, kind, actionId, reason);
      }
    });
    context.addLifecycleEventListener(this);
  }

  void show(final String id, ReadableMap config) {
    final AnchorTipConfig parsed = AnchorTipConfig.from(config);
    UiThreadUtil.runOnUiThread(new Runnable() {
      @Override
      public void run() {
        Activity activity = context.getCurrentActivity();
        overlay.show(activity, id, parsed, anchorOnScreen(activity, parsed));
      }
    });
  }

  void update(final String id, ReadableMap config) {
    final AnchorTipConfig parsed = AnchorTipConfig.from(config);
    UiThreadUtil.runOnUiThread(new Runnable() {
      @Override
      public void run() {
        overlay.update(id, parsed, anchorOnScreen(context.getCurrentActivity(), parsed));
      }
    });
  }

  void dismiss(final String id) {
    UiThreadUtil.runOnUiThread(new Runnable() {
      @Override
      public void run() {
        overlay.dismiss(id, "dismissed");
      }
    });
  }

  void dismissAll() {
    UiThreadUtil.runOnUiThread(new Runnable() {
      @Override
      public void run() {
        overlay.dismissAll();
      }
    });
  }

  void invalidate() {
    if (invalidated) return;
    invalidated = true;
    context.removeLifecycleEventListener(this);
    UiThreadUtil.runOnUiThread(new Runnable() {
      @Override
      public void run() {
        overlay.removeAllImmediately();
      }
    });
  }

  /**
   * The anchor's frame on screen in pixels. The native view is exact; the
   * JavaScript measurement is relative to the visible window frame and is
   * the fallback when the view cannot be resolved.
   */
  private RectF anchorOnScreen(@Nullable Activity activity, AnchorTipConfig config) {
    if (config.anchorTag != null) {
      try {
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(context, config.anchorTag);
        View view = manager != null ? manager.resolveView(config.anchorTag) : null;
        if (view != null && view.getWidth() > 0 && view.isAttachedToWindow()) {
          int[] location = new int[2];
          view.getLocationOnScreen(location);
          return new RectF(location[0], location[1], location[0] + view.getWidth(), location[1] + view.getHeight());
        }
      } catch (Throwable ignored) {
        // Older releases or a view that is already gone: use the JavaScript frame.
      }
    }
    DisplayMetrics metrics = context.getResources().getDisplayMetrics();
    float density = metrics.density;
    Rect frame = new Rect();
    if (activity != null) activity.getWindow().getDecorView().getWindowVisibleDisplayFrame(frame);
    float left = frame.left + config.anchorX * density;
    float top = frame.top + config.anchorY * density;
    return new RectF(left, top, left + config.anchorWidth * density, top + config.anchorHeight * density);
  }

  private void emitEvent(String id, String kind, @Nullable String actionId, @Nullable String reason) {
    WritableMap event = Arguments.createMap();
    event.putString("id", id);
    event.putString("kind", kind);
    if (actionId != null) event.putString("actionId", actionId);
    if (reason != null) event.putString("reason", reason);
    try {
      context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(EVENT, event);
    } catch (RuntimeException ignored) {
      // The React instance is shutting down; there is no JavaScript to notify.
    }
  }

  @Override
  public void onHostResume() {}

  @Override
  public void onHostPause() {}

  @Override
  public void onHostDestroy() {
    UiThreadUtil.runOnUiThread(new Runnable() {
      @Override
      public void run() {
        overlay.removeAllImmediately();
      }
    });
  }
}
