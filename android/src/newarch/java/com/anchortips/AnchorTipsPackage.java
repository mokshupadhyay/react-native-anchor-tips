package com.anchortips;

import androidx.annotation.Nullable;

import com.facebook.react.TurboReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;

import java.util.HashMap;
import java.util.Map;

/**
 * `TurboReactPackage` is deprecated in favor of `BaseReactPackage` (0.74+),
 * but it is the base class available on every New Architecture release
 * from 0.68.
 */
@SuppressWarnings("deprecation")
public class AnchorTipsPackage extends TurboReactPackage {
  @Nullable
  @Override
  public NativeModule getModule(String name, ReactApplicationContext context) {
    return AnchorTipsModule.NAME.equals(name) ? new AnchorTipsModule(context) : null;
  }

  @Override
  public ReactModuleInfoProvider getReactModuleInfoProvider() {
    return new ReactModuleInfoProvider() {
      @Override
      public Map<String, ReactModuleInfo> getReactModuleInfos() {
        Map<String, ReactModuleInfo> infos = new HashMap<>();
        infos.put(AnchorTipsModule.NAME, new ReactModuleInfo(
            AnchorTipsModule.NAME,
            AnchorTipsModule.class.getName(),
            false, // canOverrideExistingModule
            false, // needsEagerInit
            false, // hasConstants
            false, // isCxxModule
            true)); // isTurboModule
        return infos;
      }
    };
  }
}
