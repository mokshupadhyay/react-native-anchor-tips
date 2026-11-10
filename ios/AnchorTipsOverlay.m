#import "AnchorTipsOverlay.h"

#import <React/RCTConvert.h>

#import "AnchorTipView.h"

static CGFloat AnchorTipsNumber(NSDictionary *dict, NSString *key, CGFloat fallback)
{
  id value = dict[key];
  return [value isKindOfClass:[NSNumber class]] ? [value doubleValue] : fallback;
}

static BOOL AnchorTipsBool(NSDictionary *dict, NSString *key, BOOL fallback)
{
  id value = dict[key];
  return [value isKindOfClass:[NSNumber class]] ? [value boolValue] : fallback;
}

static NSString *AnchorTipsString(NSDictionary *dict, NSString *key, NSString *fallback)
{
  id value = dict[key];
  return [value isKindOfClass:[NSString class]] && [value length] > 0 ? value : fallback;
}

static NSDictionary *AnchorTipsStyle(NSDictionary *config)
{
  return [config[@"style"] isKindOfClass:[NSDictionary class]] ? config[@"style"] : @{};
}

static UIWindow *_Nullable AnchorTipsHostKeyWindow(UIWindow *_Nullable excluded)
{
  if (@available(iOS 13.0, *)) {
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
      if (![scene isKindOfClass:[UIWindowScene class]]) continue;
      for (UIWindow *window in ((UIWindowScene *)scene).windows) {
        if (window != excluded && window.isKeyWindow) return window;
      }
    }
    return nil;
  }
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
  UIWindow *key = UIApplication.sharedApplication.keyWindow;
#pragma clang diagnostic pop
  return key != excluded ? key : nil;
}

/** Forwards status bar and rotation preferences to the app's visible controller. */
@interface AnchorTipsRootViewController : UIViewController
@property (nonatomic, copy, nullable) void (^onLayout)(void);
@end

@implementation AnchorTipsRootViewController

- (UIViewController *)hostViewController
{
  UIViewController *controller = AnchorTipsHostKeyWindow(self.view.window).rootViewController;
  while (controller.presentedViewController != nil && !controller.presentedViewController.isBeingDismissed) {
    controller = controller.presentedViewController;
  }
  return controller != self ? controller : nil;
}

- (UIStatusBarStyle)preferredStatusBarStyle
{
  UIViewController *host = [self hostViewController];
  return host ? host.preferredStatusBarStyle : UIStatusBarStyleDefault;
}

- (BOOL)prefersStatusBarHidden
{
  UIViewController *host = [self hostViewController];
  return host ? host.prefersStatusBarHidden : NO;
}

- (UIInterfaceOrientationMask)supportedInterfaceOrientations
{
  UIViewController *host = [self hostViewController];
  return host ? host.supportedInterfaceOrientations : UIInterfaceOrientationMaskAll;
}

- (void)viewDidLayoutSubviews
{
  [super viewDidLayoutSubviews];
  if (self.onLayout) self.onLayout();
}

@end

/**
 * Tips and backdrops receive touches; everything else, including the
 * spotlight cutout, reaches the app below.
 */
@interface AnchorTipsWindow : UIWindow
@property (nonatomic, copy, nullable) void (^onOutsideTouch)(UIEvent *_Nullable event);
@end

@implementation AnchorTipsWindow

- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
  UIView *hit = [super hitTest:point withEvent:event];
  for (UIView *view = hit; view != nil; view = view.superview) {
    if ([view isKindOfClass:[AnchorTipView class]]) return hit;
    if ([view isKindOfClass:[AnchorTipBackdropView class]]) {
      AnchorTipBackdropView *backdrop = (AnchorTipBackdropView *)view;
      return [backdrop holeContainsPoint:[self convertPoint:point toView:backdrop]] ? nil : hit;
    }
  }
  if (self.onOutsideTouch) self.onOutsideTouch(event);
  return nil;
}

@end

@implementation AnchorTipsOverlay {
  AnchorTipsWindow *_window;
  NSMutableDictionary<NSString *, AnchorTipView *> *_tips;
  NSMutableDictionary<NSString *, AnchorTipBackdropView *> *_backdrops;
  NSMutableDictionary<NSString *, NSNumber *> *_timers;
  NSTimeInterval _lastOutsideTouch;
}

- (instancetype)init
{
  if (self = [super init]) {
    _tips = [NSMutableDictionary new];
    _backdrops = [NSMutableDictionary new];
    _timers = [NSMutableDictionary new];
  }
  return self;
}

#pragma mark - Public

- (void)show:(NSString *)tipId config:(NSDictionary *)config
{
  if (_tips[tipId] != nil) {
    [self update:tipId config:config];
    return;
  }
  [self ensureWindow];
  UIView *root = _window.rootViewController.view;

  [self syncBackdrop:tipId config:config animated:YES];

  AnchorTipView *view = [[AnchorTipView alloc] initWithTipId:tipId config:config];
  __weak AnchorTipsOverlay *weakSelf = self;
  __weak AnchorTipView *weakView = view;
  view.onEvent = ^(NSString *kind, NSDictionary *payload) {
    AnchorTipView *strongView = weakView;
    if (strongView != nil) [weakSelf handleEvent:kind payload:payload view:strongView];
  };
  _tips[tipId] = view;
  [root addSubview:view];
  [self layoutTip:tipId];
  [view animateIn];
  [self restartTimer:tipId];

  NSString *label = AnchorTipsString(config, @"accessibilityLabel", @"");
  if (label.length > 0) {
    UIAccessibilityPostNotification(UIAccessibilityAnnouncementNotification, label);
  }
}

- (void)update:(NSString *)tipId config:(NSDictionary *)config
{
  AnchorTipView *view = _tips[tipId];
  if (view == nil || view.dismissing) return;
  [view applyConfig:config];
  [self syncBackdrop:tipId config:config animated:YES];
  [UIView animateWithDuration:0.2
                   animations:^{
                     [self layoutTip:tipId];
                   }];
  [self restartTimer:tipId];
}

- (void)dismiss:(NSString *)tipId reason:(NSString *)reason
{
  AnchorTipView *view = _tips[tipId];
  if (view == nil) {
    // Unknown here (never shown or already gone): confirm so JavaScript can clean up.
    [self emit:@{ @"id" : tipId, @"kind" : @"hide", @"reason" : reason }];
    return;
  }
  if (view.dismissing) return;
  view.dismissing = YES;
  [_timers removeObjectForKey:tipId];
  AnchorTipBackdropView *backdrop = _backdrops[tipId];
  [UIView animateWithDuration:0.15
                   animations:^{
                     backdrop.alpha = 0;
                   }];
  [view animateOutWithCompletion:^{
    [self removeTip:view reason:reason];
  }];
}

- (void)dismissAll
{
  for (NSString *tipId in _tips.allKeys) {
    [self dismiss:tipId reason:@"dismissed"];
  }
}

#pragma mark - Layout

- (void)layoutTip:(NSString *)tipId
{
  AnchorTipView *view = _tips[tipId];
  if (view == nil) return;
  NSDictionary *config = view.config;
  NSDictionary *style = AnchorTipsStyle(config);
  UIView *root = _window.rootViewController.view;
  CGSize viewport = root.bounds.size;
  UIEdgeInsets insets = UIEdgeInsetsZero;
  if (@available(iOS 11.0, *)) insets = root.safeAreaInsets;

  CGFloat margin = AnchorTipsNumber(style, @"margin", 12);
  CGFloat maxWidth = MIN(AnchorTipsNumber(style, @"maxWidth", 320), viewport.width - insets.left - insets.right - 2 * margin);
  CGSize size = [view fittingSizeForMaxWidth:MAX(0, maxWidth)];
  CGRect anchor = [self anchorRectForConfig:config inView:root];
  BOOL showArrow = AnchorTipsBool(config, @"showArrow", YES);

  AnchorTipPlacement placement = AnchorTipComputePlacement(
      anchor,
      size,
      viewport,
      insets,
      AnchorTipsString(config, @"placement", @"auto"),
      AnchorTipsString(config, @"align", @"center"),
      AnchorTipsNumber(style, @"offset", 4),
      showArrow ? AnchorTipsNumber(style, @"arrowSize", 8) : 0,
      margin,
      AnchorTipsNumber(style, @"borderRadius", 14));
  [view applyPlacement:placement size:size];

  AnchorTipBackdropView *backdrop = _backdrops[tipId];
  if (backdrop != nil) {
    CGFloat padding = AnchorTipsNumber(style, @"spotlightPadding", 6);
    id rawColor = style[@"backdropColor"];
    UIColor *color = rawColor != nil && rawColor != [NSNull null] ? [RCTConvert UIColor:rawColor] : nil;
    [backdrop setHole:CGRectInset(anchor, -padding, -padding)
               radius:AnchorTipsNumber(style, @"spotlightRadius", 12)
                color:color ?: [UIColor colorWithWhite:0 alpha:0.55]];
  }
}

/** Anchors are measured in the app window; convert them into the overlay. */
- (CGRect)anchorRectForConfig:(NSDictionary *)config inView:(UIView *)root
{
  NSDictionary *anchor = [config[@"anchor"] isKindOfClass:[NSDictionary class]] ? config[@"anchor"] : @{};
  CGRect rect = CGRectMake(
      AnchorTipsNumber(anchor, @"x", 0),
      AnchorTipsNumber(anchor, @"y", 0),
      AnchorTipsNumber(anchor, @"width", 0),
      AnchorTipsNumber(anchor, @"height", 0));
  UIWindow *host = AnchorTipsHostKeyWindow(_window);
  return host != nil ? [root convertRect:rect fromView:host] : rect;
}

- (void)syncBackdrop:(NSString *)tipId config:(NSDictionary *)config animated:(BOOL)animated
{
  BOOL wanted = AnchorTipsBool(config, @"spotlight", NO);
  AnchorTipBackdropView *backdrop = _backdrops[tipId];
  if (!wanted) {
    if (backdrop != nil) {
      [_backdrops removeObjectForKey:tipId];
      [backdrop removeFromSuperview];
    }
    return;
  }
  if (backdrop != nil) return;
  UIView *root = _window.rootViewController.view;
  backdrop = [[AnchorTipBackdropView alloc] initWithFrame:root.bounds];
  backdrop.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  __weak AnchorTipsOverlay *weakSelf = self;
  backdrop.onTap = ^{
    [weakSelf handleBackdropTap:tipId];
  };
  _backdrops[tipId] = backdrop;
  AnchorTipView *view = _tips[tipId];
  if (view != nil) {
    [root insertSubview:backdrop belowSubview:view];
  } else {
    [root addSubview:backdrop];
  }
  if (animated) {
    backdrop.alpha = 0;
    [UIView animateWithDuration:0.2
                     animations:^{
                       backdrop.alpha = 1;
                     }];
  }
}

#pragma mark - Events

- (void)handleEvent:(NSString *)kind payload:(NSDictionary *)payload view:(AnchorTipView *)view
{
  NSString *tipId = view.tipId;
  if ([kind isEqualToString:@"press"]) {
    [self emit:@{ @"id" : tipId, @"kind" : @"press" }];
    if (AnchorTipsBool(view.config, @"dismissOnTipPress", NO)) [self dismiss:tipId reason:@"tip-press"];
  } else if ([kind isEqualToString:@"action"]) {
    [self emit:@{ @"id" : tipId, @"kind" : @"action", @"actionId" : payload[@"id"] ?: @"" }];
    if ([payload[@"dismissOnPress"] boolValue]) [self dismiss:tipId reason:@"action"];
  } else if ([kind isEqualToString:@"close"]) {
    [self dismiss:tipId reason:@"close-button"];
  }
}

- (void)handleBackdropTap:(NSString *)tipId
{
  AnchorTipView *view = _tips[tipId];
  if (view == nil || view.dismissing) return;
  if (AnchorTipsBool(view.config, @"dismissOnBackdropPress", YES)) [self dismiss:tipId reason:@"backdrop-press"];
}

- (void)handleOutsideTouch:(UIEvent *)event
{
  // Hit testing runs several times per touch; react once.
  NSTimeInterval timestamp = event != nil ? event.timestamp : CACurrentMediaTime();
  if (timestamp == _lastOutsideTouch) return;
  _lastOutsideTouch = timestamp;
  dispatch_async(dispatch_get_main_queue(), ^{
    for (NSString *tipId in self->_tips.allKeys) {
      AnchorTipView *view = self->_tips[tipId];
      if (!view.dismissing && AnchorTipsBool(view.config, @"dismissOnOutsidePress", YES)) {
        [self dismiss:tipId reason:@"outside-press"];
      }
    }
  });
}

- (void)emit:(NSDictionary *)event
{
  if (self.eventSink) self.eventSink(event);
}

#pragma mark - Timer

- (void)restartTimer:(NSString *)tipId
{
  AnchorTipView *view = _tips[tipId];
  NSTimeInterval duration = AnchorTipsNumber(view.config, @"duration", 0) / 1000.0;
  NSUInteger generation = _timers[tipId].unsignedIntegerValue + 1;
  _timers[tipId] = @(generation);
  if (duration <= 0) return;
  __weak AnchorTipsOverlay *weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(duration * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    AnchorTipsOverlay *strongSelf = weakSelf;
    if (strongSelf == nil || strongSelf->_timers[tipId].unsignedIntegerValue != generation) return;
    [strongSelf dismiss:tipId reason:@"timeout"];
  });
}

#pragma mark - Window

- (void)ensureWindow
{
  if (_window != nil) {
    _window.hidden = NO;
    return;
  }

  AnchorTipsWindow *window = nil;
  if (@available(iOS 13.0, *)) {
    UIWindowScene *scene = [self activeScene];
    if (scene != nil) window = [[AnchorTipsWindow alloc] initWithWindowScene:scene];
  }
  if (window == nil) {
    window = [[AnchorTipsWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
  }
  window.windowLevel = UIWindowLevelAlert + 1;
  window.backgroundColor = UIColor.clearColor;
  __weak AnchorTipsOverlay *weakSelf = self;
  window.onOutsideTouch = ^(UIEvent *event) {
    [weakSelf handleOutsideTouch:event];
  };

  AnchorTipsRootViewController *root = [AnchorTipsRootViewController new];
  root.view.backgroundColor = UIColor.clearColor;
  root.onLayout = ^{
    [weakSelf relayoutAll];
  };
  window.rootViewController = root;
  window.hidden = NO;
  _window = window;
}

- (void)relayoutAll
{
  for (NSString *tipId in _tips.allKeys) {
    if (!_tips[tipId].dismissing) [self layoutTip:tipId];
  }
}

- (nullable UIWindowScene *)activeScene API_AVAILABLE(ios(13.0))
{
  UIWindowScene *fallback = nil;
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) continue;
    if (scene.activationState == UISceneActivationStateForegroundActive) return (UIWindowScene *)scene;
    if (fallback == nil) fallback = (UIWindowScene *)scene;
  }
  return fallback;
}

- (void)removeTip:(AnchorTipView *)view reason:(NSString *)reason
{
  if (_tips[view.tipId] != view) return;
  [_tips removeObjectForKey:view.tipId];
  [_timers removeObjectForKey:view.tipId];
  [view removeFromSuperview];
  AnchorTipBackdropView *backdrop = _backdrops[view.tipId];
  if (backdrop != nil) {
    [_backdrops removeObjectForKey:view.tipId];
    [backdrop removeFromSuperview];
  }
  [self emit:@{ @"id" : view.tipId, @"kind" : @"hide", @"reason" : reason }];

  if (_tips.count == 0) {
    _window.hidden = YES;
    _window = nil;
  }
}

@end
