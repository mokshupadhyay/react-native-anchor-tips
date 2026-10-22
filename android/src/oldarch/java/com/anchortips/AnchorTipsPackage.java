package com.anchortips;

import androidx.annotation.NonNull;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Collections;
import java.util.List;

public class AnchorTipsPackage implements ReactPackage {
  @NonNull
  @Override
  public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext context) {
    return Collections.<NativeModule>singletonList(new AnchorTipsModule(context));
  }

  @NonNull
  @Override
  @SuppressWarnings("rawtypes")
  public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext context) {
    return Collections.emptyList();
  }
}
