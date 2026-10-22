#import "AnchorTips.h"

#import "AnchorTipsOverlay.h"

static NSString *const AnchorTipsEventName = @"AnchorTipsEvent";

@implementation AnchorTips {
  AnchorTipsOverlay *_overlay;
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE(AnchorTips)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ AnchorTipsEventName ];
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

- (AnchorTipsOverlay *)overlay
{
  if (_overlay == nil) {
    _overlay = [AnchorTipsOverlay new];
    __weak AnchorTips *weakSelf = self;
    _overlay.eventSink = ^(NSDictionary *event) {
      AnchorTips *strongSelf = weakSelf;
      if (strongSelf != nil && strongSelf->_hasListeners) {
        [strongSelf sendEventWithName:AnchorTipsEventName body:event];
      }
    };
  }
  return _overlay;
}

- (void)invalidate
{
  // Reloads tear the module down; take the tips with it.
  AnchorTipsOverlay *overlay = _overlay;
  _overlay = nil;
  overlay.eventSink = nil;
  dispatch_async(dispatch_get_main_queue(), ^{
    [overlay dismissAll];
  });
  [super invalidate];
}

RCT_EXPORT_METHOD(show : (NSString *)tipId config : (NSDictionary *)config)
{
  [[self overlay] show:tipId config:config];
}

RCT_EXPORT_METHOD(update : (NSString *)tipId config : (NSDictionary *)config)
{
  [[self overlay] update:tipId config:config];
}

RCT_EXPORT_METHOD(dismiss : (NSString *)tipId)
{
  [[self overlay] dismiss:tipId reason:@"dismissed"];
}

RCT_EXPORT_METHOD(dismissAll)
{
  [[self overlay] dismissAll];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeAnchorTipsSpecJSI>(params);
}
#endif

@end
