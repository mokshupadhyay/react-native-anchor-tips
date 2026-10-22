package com.anchortips;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

/** Legacy bridge module with the same surface as the TurboModule spec. */
public class AnchorTipsModule extends ReactContextBaseJavaModule {
  public static final String NAME = AnchorTipsModuleImpl.NAME;

  private final AnchorTipsModuleImpl impl;

  public AnchorTipsModule(ReactApplicationContext context) {
    super(context);
    impl = new AnchorTipsModuleImpl(context);
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void show(String id, ReadableMap config) {
    impl.show(id, config);
  }

  @ReactMethod
  public void update(String id, ReadableMap config) {
    impl.update(id, config);
  }

  @ReactMethod
  public void dismiss(String id) {
    impl.dismiss(id);
  }

  @ReactMethod
  public void dismissAll() {
    impl.dismissAll();
  }

  @ReactMethod
  public void addListener(String eventName) {
    // Required by NativeEventEmitter; events are emitted unconditionally.
  }

  @ReactMethod
  public void removeListeners(double count) {
    // Required by NativeEventEmitter.
  }

  // React Native 0.65+ tears modules down through invalidate().
  public void invalidate() {
    impl.invalidate();
  }

  // React Native 0.60-0.64.
  @Override
  public void onCatalystInstanceDestroy() {
    impl.invalidate();
  }
}
