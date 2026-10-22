package com.anchortips;

import android.app.Activity;
import android.graphics.Rect;
import android.util.TypedValue;
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
    this.overlay = new AnchorTipsOverlay(
        new AnchorTipsOverlay.EventSink() {
          @Override
          public void emit(String id, String kind, @Nullable String actionId, @Nullable String reason) {
            emitEvent(id, kind, actionId, reason);
          }
        },
        new AnchorTipsOverlay.AnchorResolver() {
          @Override
          public Rect resolve(Activity activity, AnchorTipConfig config) {
            return anchorOnScreen(activity, config);
          }
        });
    context.addLifecycleEventListener(this);
  }

  void show(final String id, ReadableMap config) {
    final AnchorTipConfig parsed = AnchorTipConfig.from(config);
    UiThreadUtil.runOnUiThread(new Runnable() {
      @Override
      public void run() {
        overlay.show(context.getCurrentActivity(), id, parsed);
      }
    });
  }

  void update(final String id, ReadableMap config) {
    final AnchorTipConfig parsed = AnchorTipConfig.from(config);
    UiThreadUtil.runOnUiThread(new Runnable() {
      @Override
      public void run() {
        overlay.update(context.getCurrentActivity(), id, parsed);
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
   * The anchor view's frame on screen. The view is looked up by its tag so
   * the frame matches what is drawn; the JavaScript measurement is the fallback.
   */
  private Rect anchorOnScreen(Activity activity, AnchorTipConfig config) {
    if (config.anchorTag != null) {
      try {
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(context, config.anchorTag);
        View view = manager != null ? manager.resolveView(config.anchorTag) : null;
        if (view != null && view.getWidth() > 0 && view.getHeight() > 0) {
          int[] location = new int[2];
          view.getLocationOnScreen(location);
          return new Rect(location[0], location[1], location[0] + view.getWidth(), location[1] + view.getHeight());
        }
      } catch (Throwable ignored) {
        // Older releases cannot resolve views by tag; use the measured frame.
      }
    }
    // `measureInWindow` is relative to the window's visible frame.
    Rect frame = new Rect();
    activity.getWindow().getDecorView().getWindowVisibleDisplayFrame(frame);
    int left = frame.left + px(config.anchorX);
    int top = frame.top + px(config.anchorY);
    return new Rect(left, top, left + px(config.anchorWidth), top + px(config.anchorHeight));
  }

  private int px(float dp) {
    return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, context.getResources().getDisplayMetrics()));
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
