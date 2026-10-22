#import "AnchorTipsOverlay.h"

#import "AnchorTipGeometry.h"
#import "AnchorTipView.h"

static const CGFloat AnchorTipTravel = 8;

static UIWindow *_Nullable AnchorTipsHostWindow(UIWindow *_Nullable excluded)
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
@end

@implementation AnchorTipsRootViewController

- (UIViewController *)hostViewController
{
  UIViewController *controller = AnchorTipsHostWindow(self.view.window).rootViewController;
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

@end

/** Dims the screen except a rounded hole around the anchor. Touches in the hole reach the app. */
@interface AnchorTipsBackdropView : UIView
@property (nonatomic, assign) CGRect hole;
@property (nonatomic, assign) CGFloat holeRadius;
@property (nonatomic, strong) UIColor *dimColor;
@property (nonatomic, copy, nullable) void (^onPress)(void);
@end

@implementation AnchorTipsBackdropView {
  CAShapeLayer *_shape;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _shape = [CAShapeLayer layer];
    _shape.fillRule = kCAFillRuleEvenOdd;
    [self.layer addSublayer:_shape];
    _dimColor = [UIColor colorWithWhite:0 alpha:0.5];
    self.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [self addGestureRecognizer:[[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleTap)]];
  }
  return self;
}

- (void)handleTap
{
  if (self.onPress) self.onPress();
}

- (BOOL)pointInside:(CGPoint)point withEvent:(UIEvent *)event
{
  return [super pointInside:point withEvent:event] && !CGRectContainsPoint(self.hole, point);
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  [self updateShape];
}

- (void)updateShape
{
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  UIBezierPath *path = [UIBezierPath bezierPathWithRect:self.bounds];
  if (!CGRectIsEmpty(self.hole)) {
    [path appendPath:[UIBezierPath bezierPathWithRoundedRect:self.hole cornerRadius:self.holeRadius]];
  }
  _shape.frame = self.bounds;
  _shape.path = path.CGPath;
  _shape.fillColor = self.dimColor.CGColor;
  [CATransaction commit];
}

@end

@class AnchorTipsOverlay;

/** Only tips and backdrops receive touches; every other touch reaches the app below. */
@interface AnchorTipsWindow : UIWindow
@property (nonatomic, copy, nullable) void (^onOutsideTouch)(UIEvent *event);
@end

@implementation AnchorTipsWindow

- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
  UIView *hit = [super hitTest:point withEvent:event];
  for (UIView *view = hit; view != nil; view = view.superview) {
    if ([view isKindOfClass:[AnchorTipView class]] || [view isKindOfClass:[AnchorTipsBackdropView class]]) return hit;
  }
  if (event != nil && event.type == UIEventTypeTouches && self.onOutsideTouch) self.onOutsideTouch(event);
  return nil;
}

@end

@implementation AnchorTipsOverlay {
  AnchorTipsWindow *_window;
  NSMutableDictionary<NSString *, AnchorTipView *> *_tips;
  NSMutableDictionary<NSString *, AnchorTipsBackdropView *> *_backdrops;
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

  AnchorTipView *view = [[AnchorTipView alloc] initWithTipId:tipId config:config];
  __weak AnchorTipsOverlay *weakSelf = self;
  __weak AnchorTipView *weakView = view;
  view.onEvent = ^(NSString *kind, NSDictionary *payload) {
    AnchorTipView *strongView = weakView;
    if (strongView != nil) [weakSelf handleEvent:kind payload:payload view:strongView];
  };

  if (AnchorTipBool(config, @"spotlight", NO)) {
    AnchorTipsBackdropView *backdrop = [[AnchorTipsBackdropView alloc] initWithFrame:root.bounds];
    backdrop.onPress = ^{
      [weakSelf handleBackdropPress:tipId];
    };
    [root addSubview:backdrop];
    _backdrops[tipId] = backdrop;
  }
  [root addSubview:view];
  _tips[tipId] = view;

  [self layoutTip:view];
  [self animateIn:view];
  [self restartTimer:tipId];

  NSString *label = AnchorTipString(config, @"accessibilityLabel");
  if (label.length > 0) UIAccessibilityPostNotification(UIAccessibilityAnnouncementNotification, label);
}

- (void)update:(NSString *)tipId config:(NSDictionary *)config
{
  AnchorTipView *view = _tips[tipId];
  if (view == nil || view.dismissing) return;
  [view applyConfig:config];
  [UIView animateWithDuration:0.2
                        delay:0
                      options:UIViewAnimationOptionBeginFromCurrentState | UIViewAnimationOptionAllowUserInteraction
                   animations:^{
                     [self layoutTip:view];
                     [view layoutIfNeeded];
                   }
                   completion:nil];
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
  AnchorTipsBackdropView *backdrop = _backdrops[tipId];
  void (^finish)(void) = ^{
    [self removeTip:tipId reason:reason];
  };
  if ([[self animationFor:view] isEqualToString:@"none"]) {
    finish();
    return;
  }
  [UIView animateWithDuration:0.15
      delay:0
      options:UIViewAnimationOptionCurveEaseIn | UIViewAnimationOptionBeginFromCurrentState
      animations:^{
        view.alpha = 0;
        view.transform = [self hiddenTransformFor:view];
        backdrop.alpha = 0;
      }
      completion:^(__unused BOOL finished) {
        finish();
      }];
}

- (void)dismissAll
{
  for (NSString *tipId in _tips.allKeys) [self dismiss:tipId reason:@"dismissed"];
}

#pragma mark - Layout

- (void)layoutTip:(AnchorTipView *)view
{
  UIView *root = _window.rootViewController.view;
  NSDictionary *config = view.config;
  NSDictionary *style = AnchorTipStyle(config);
  CGRect bounds = root.bounds;
  UIEdgeInsets insets = UIEdgeInsetsZero;
  if (@available(iOS 11.0, *)) insets = root.safeAreaInsets;

  CGFloat margin = AnchorTipNumber(style, @"margin", 12);
  CGFloat maxWidth = MIN(AnchorTipNumber(style, @"maxWidth", 320), bounds.size.width - insets.left - insets.right - 2 * margin);
  CGSize size = [view fittingSizeForMaxWidth:MAX(0, maxWidth)];

  NSDictionary *rect = [config[@"anchor"] isKindOfClass:[NSDictionary class]] ? config[@"anchor"] : @{};
  CGRect anchor = CGRectMake(AnchorTipNumber(rect, @"x", 0), AnchorTipNumber(rect, @"y", 0),
                             AnchorTipNumber(rect, @"width", 0), AnchorTipNumber(rect, @"height", 0));
  // JavaScript measures in the app window; convert in case the windows differ.
  UIWindow *host = AnchorTipsHostWindow(_window);
  if (host != nil) anchor = [root convertRect:anchor fromView:host];

  CGFloat arrowSize = AnchorTipBool(config, @"showArrow", YES) ? AnchorTipNumber(style, @"arrowSize", 8) : 0;
  AnchorTipLayout layout = AnchorTipComputeLayout(
      anchor, size, bounds.size, insets, AnchorTipString(config, @"placement"), AnchorTipString(config, @"align"),
      AnchorTipNumber(style, @"offset", 4), arrowSize, margin, AnchorTipNumber(style, @"borderRadius", 14));

  // Set bounds and center so an in-flight transform is not baked into the frame.
  view.bounds = CGRectMake(0, 0, layout.frame.size.width, layout.frame.size.height);
  view.center = CGPointMake(CGRectGetMidX(layout.frame), CGRectGetMidY(layout.frame));
  [view setPlacement:layout.placement arrowOffset:layout.arrowOffset arrowSize:arrowSize];
  [view setNeedsLayout];

  AnchorTipsBackdropView *backdrop = _backdrops[view.tipId];
  if (backdrop != nil) {
    CGFloat padding = AnchorTipNumber(style, @"spotlightPadding", 6);
    backdrop.hole = CGRectInset(anchor, -padding, -padding);
    backdrop.holeRadius = AnchorTipNumber(style, @"spotlightRadius", 12);
    backdrop.dimColor = AnchorTipColor(style, @"backdropColor", [UIColor colorWithWhite:0 alpha:0.5]);
    [backdrop updateShape];
  }
}

#pragma mark - Animation

- (NSString *)animationFor:(AnchorTipView *)view
{
  return AnchorTipString(view.config, @"animation") ?: @"scale";
}

- (CGAffineTransform)hiddenTransformFor:(AnchorTipView *)view
{
  if (![[self animationFor:view] isEqualToString:@"scale"]) return CGAffineTransformIdentity;
  CGFloat dx = 0;
  CGFloat dy = 0;
  switch (view.placement) {
    case AnchorTipPlacementTop:
      dy = AnchorTipTravel;
      break;
    case AnchorTipPlacementBottom:
      dy = -AnchorTipTravel;
      break;
    case AnchorTipPlacementLeft:
      dx = AnchorTipTravel;
      break;
    case AnchorTipPlacementRight:
      dx = -AnchorTipTravel;
      break;
  }
  return CGAffineTransformScale(CGAffineTransformMakeTranslation(dx, dy), 0.9, 0.9);
}

- (void)animateIn:(AnchorTipView *)view
{
  AnchorTipsBackdropView *backdrop = _backdrops[view.tipId];
  if ([[self animationFor:view] isEqualToString:@"none"]) return;
  view.alpha = 0;
  view.transform = [self hiddenTransformFor:view];
  backdrop.alpha = 0;
  [UIView animateWithDuration:0.22
                        delay:0
                      options:UIViewAnimationOptionCurveEaseOut | UIViewAnimationOptionAllowUserInteraction
                   animations:^{
                     view.alpha = 1;
                     view.transform = CGAffineTransformIdentity;
                     backdrop.alpha = 1;
                   }
                   completion:nil];
}

#pragma mark - Timer

- (void)restartTimer:(NSString *)tipId
{
  AnchorTipView *view = _tips[tipId];
  NSTimeInterval duration = AnchorTipNumber(view.config, @"duration", 0) / 1000.0;
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

#pragma mark - Events

- (void)handleEvent:(NSString *)kind payload:(NSDictionary *)payload view:(AnchorTipView *)view
{
  NSString *tipId = view.tipId;
  if ([kind isEqualToString:@"press"]) {
    [self emit:@{ @"id" : tipId, @"kind" : @"press" }];
    if (AnchorTipBool(view.config, @"dismissOnTipPress", NO)) [self dismiss:tipId reason:@"tip-press"];
  } else if ([kind isEqualToString:@"action"]) {
    [self emit:@{ @"id" : tipId, @"kind" : @"action", @"actionId" : payload[@"id"] ?: @"" }];
    if ([payload[@"dismissOnPress"] boolValue]) [self dismiss:tipId reason:@"action"];
  } else if ([kind isEqualToString:@"close"]) {
    [self dismiss:tipId reason:@"close-button"];
  }
}

- (void)handleBackdropPress:(NSString *)tipId
{
  AnchorTipView *view = _tips[tipId];
  if (view != nil && AnchorTipBool(view.config, @"dismissOnBackdropPress", YES)) {
    [self dismiss:tipId reason:@"backdrop-press"];
  }
}

- (void)handleOutsideTouch:(UIEvent *)event
{
  // Hit testing runs more than once per touch.
  if (event.timestamp == _lastOutsideTouch) return;
  _lastOutsideTouch = event.timestamp;
  NSMutableArray<NSString *> *targets = [NSMutableArray new];
  for (NSString *tipId in _tips) {
    AnchorTipView *view = _tips[tipId];
    if (!view.dismissing && AnchorTipBool(view.config, @"dismissOnOutsidePress", YES)) [targets addObject:tipId];
  }
  if (targets.count == 0) return;
  // Leave hit testing before changing the view hierarchy.
  dispatch_async(dispatch_get_main_queue(), ^{
    for (NSString *tipId in targets) [self dismiss:tipId reason:@"outside-press"];
  });
}

- (void)emit:(NSDictionary *)event
{
  if (self.eventSink) self.eventSink(event);
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
  if (window == nil) window = [[AnchorTipsWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
  window.windowLevel = UIWindowLevelAlert + 1;
  window.backgroundColor = UIColor.clearColor;
  __weak AnchorTipsOverlay *weakSelf = self;
  window.onOutsideTouch = ^(UIEvent *event) {
    [weakSelf handleOutsideTouch:event];
  };

  AnchorTipsRootViewController *root = [AnchorTipsRootViewController new];
  root.view.backgroundColor = UIColor.clearColor;
  window.rootViewController = root;
  window.hidden = NO;
  _window = window;
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

- (void)removeTip:(NSString *)tipId reason:(NSString *)reason
{
  AnchorTipView *view = _tips[tipId];
  if (view == nil) return;
  [_tips removeObjectForKey:tipId];
  [_timers removeObjectForKey:tipId];
  [view removeFromSuperview];
  [_backdrops[tipId] removeFromSuperview];
  [_backdrops removeObjectForKey:tipId];
  [self emit:@{ @"id" : tipId, @"kind" : @"hide", @"reason" : reason }];

  if (_tips.count == 0) {
    _window.hidden = YES;
    _window = nil;
  }
}

@end
