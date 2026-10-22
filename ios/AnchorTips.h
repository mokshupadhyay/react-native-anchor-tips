#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNAnchorTipsSpec/RNAnchorTipsSpec.h>

@interface AnchorTips : RCTEventEmitter <NativeAnchorTipsSpec>
#else
#import <React/RCTBridgeModule.h>

@interface AnchorTips : RCTEventEmitter <RCTBridgeModule>
#endif

@end
