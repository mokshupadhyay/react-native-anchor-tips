#import "AnchorTipView.h"

#import <React/RCTConvert.h>

static const CGFloat AnchorTipIconGap = 10;
static const CGFloat AnchorTipCloseSize = 14;
static const CGFloat AnchorTipCloseGap = 12;
static const CGFloat AnchorTipTitleGap = 3;
static const CGFloat AnchorTipFooterGap = 12;
static const CGFloat AnchorTipActionGap = 16;
static const CGFloat AnchorTipStepGap = 12;

CGFloat AnchorTipNumber(NSDictionary *dict, NSString *key, CGFloat fallback)
{
  id value = dict[key];
  return [value isKindOfClass:[NSNumber class]] ? [value doubleValue] : fallback;
}

BOOL AnchorTipBool(NSDictionary *dict, NSString *key, BOOL fallback)
{
  id value = dict[key];
  return [value isKindOfClass:[NSNumber class]] ? [value boolValue] : fallback;
}

NSString *AnchorTipString(NSDictionary *dict, NSString *key)
{
  id value = dict[key];
  return [value isKindOfClass:[NSString class]] && [value length] > 0 ? value : nil;
}

UIColor *AnchorTipColor(NSDictionary *dict, NSString *key, UIColor *fallback)
{
  id value = dict[key];
  if (value == nil || value == [NSNull null]) return fallback;
  return [RCTConvert UIColor:value] ?: fallback;
}

NSDictionary *AnchorTipStyle(NSDictionary *config)
{
  id style = config[@"style"];
  return [style isKindOfClass:[NSDictionary class]] ? style : @{};
}

static UIFontWeight AnchorTipFontWeight(NSString *_Nullable weight)
{
  NSInteger numeric = weight.integerValue;
  if (numeric >= 800) return UIFontWeightHeavy;
  if (numeric >= 700) return UIFontWeightBold;
  if (numeric >= 600) return UIFontWeightSemibold;
  if (numeric >= 500) return UIFontWeightMedium;
  if (numeric > 0 && numeric <= 300) return UIFontWeightLight;
  return UIFontWeightRegular;
}

static UIFont *AnchorTipFont(NSString *_Nullable family, CGFloat size, NSString *_Nullable weight)
{
  if (family != nil) {
    UIFont *custom = [UIFont fontWithName:family size:size];
    if (custom != nil) return custom;
  }
  return [UIFont systemFontOfSize:size weight:AnchorTipFontWeight(weight)];
}

static CGSize AnchorTipLabelSize(UILabel *label, CGFloat maxWidth)
{
  if (label.hidden || maxWidth <= 0) return CGSizeZero;
  CGSize size = [label sizeThatFits:CGSizeMake(maxWidth, CGFLOAT_MAX)];
  return CGSizeMake(MIN(ceil(size.width), maxWidth), ceil(size.height));
}

/** Measured pieces of the layout for one width. */
typedef struct {
  CGSize icon;
  CGSize title;
  CGSize message;
  CGFloat textWidth;
  CGFloat rowHeight;
  CGSize step;
  CGFloat footerWidth;
  CGFloat footerHeight;
  BOOL hasFooter;
} AnchorTipMetrics;

@interface AnchorTipView () <UIGestureRecognizerDelegate>
@end

@implementation AnchorTipView {
  NSDictionary *_style;
  CAShapeLayer *_shape;
  UILabel *_iconLabel;
  UILabel *_titleLabel;
  UILabel *_messageLabel;
  UIButton *_closeButton;
  UILabel *_stepLabel;
  NSMutableArray<UIButton *> *_actionButtons;
  NSMutableArray<NSValue *> *_actionSizes;
  CGFloat _arrowOffset;
  CGFloat _arrowSize;
}

- (instancetype)initWithTipId:(NSString *)tipId config:(NSDictionary *)config
{
  if (self = [super initWithFrame:CGRectZero]) {
    _tipId = [tipId copy];
    _placement = AnchorTipPlacementBottom;
    _actionButtons = [NSMutableArray new];
    _actionSizes = [NSMutableArray new];

    _shape = [CAShapeLayer layer];
    [self.layer insertSublayer:_shape atIndex:0];

    _iconLabel = [UILabel new];
    _iconLabel.textAlignment = NSTextAlignmentCenter;
    _titleLabel = [UILabel new];
    _titleLabel.numberOfLines = 0;
    _messageLabel = [UILabel new];
    _messageLabel.numberOfLines = 0;
    _stepLabel = [UILabel new];

    _closeButton = [UIButton buttonWithType:UIButtonTypeSystem];
    [_closeButton setTitle:@"\u2715" forState:UIControlStateNormal];
    _closeButton.titleLabel.font = [UIFont systemFontOfSize:AnchorTipCloseSize];
    _closeButton.accessibilityLabel = @"Dismiss";
    [_closeButton addTarget:self action:@selector(handleClose) forControlEvents:UIControlEventTouchUpInside];

    for (UIView *view in @[ _iconLabel, _titleLabel, _messageLabel, _stepLabel, _closeButton ]) {
      [self addSubview:view];
    }

    UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleTap)];
    tap.cancelsTouchesInView = NO;
    tap.delegate = self;
    [self addGestureRecognizer:tap];

    self.isAccessibilityElement = NO;
    [self applyConfig:config];
  }
  return self;
}

#pragma mark - Config

- (void)applyConfig:(NSDictionary *)config
{
  _config = [config copy];
  _style = AnchorTipStyle(config);
  NSDictionary *style = _style;
  NSString *family = AnchorTipString(style, @"fontFamily");

  _shape.fillColor = AnchorTipColor(style, @"backgroundColor", UIColor.whiteColor).CGColor;
  CGFloat borderWidth = AnchorTipNumber(style, @"borderWidth", 0);
  _shape.lineWidth = borderWidth;
  _shape.strokeColor = borderWidth > 0 ? AnchorTipColor(style, @"borderColor", UIColor.clearColor).CGColor : nil;

  if (AnchorTipBool(style, @"shadowEnabled", YES)) {
    self.layer.shadowColor = AnchorTipColor(style, @"shadowColor", UIColor.blackColor).CGColor;
    self.layer.shadowOpacity = AnchorTipNumber(style, @"shadowOpacity", 0.16);
    self.layer.shadowRadius = AnchorTipNumber(style, @"shadowRadius", 16) / 2.0;
    self.layer.shadowOffset = CGSizeMake(0, AnchorTipNumber(style, @"shadowOffsetY", 6));
  } else {
    self.layer.shadowOpacity = 0;
  }

  NSString *icon = AnchorTipString(config, @"icon");
  CGFloat iconSize = AnchorTipNumber(style, @"iconSize", 22);
  _iconLabel.hidden = icon == nil;
  _iconLabel.text = icon;
  _iconLabel.textColor = AnchorTipColor(style, @"iconColor", UIColor.systemBlueColor);
  _iconLabel.font = [UIFont systemFontOfSize:iconSize weight:UIFontWeightSemibold];

  NSString *title = AnchorTipString(config, @"title");
  _titleLabel.hidden = title == nil;
  _titleLabel.text = title;
  _titleLabel.textColor = AnchorTipColor(style, @"titleColor", UIColor.blackColor);
  _titleLabel.font = AnchorTipFont(family, AnchorTipNumber(style, @"titleFontSize", 15), AnchorTipString(style, @"titleFontWeight"));

  NSString *message = AnchorTipString(config, @"message");
  _messageLabel.hidden = message == nil;
  CGFloat messageSize = AnchorTipNumber(style, @"messageFontSize", 14);
  UIFont *messageFont = AnchorTipFont(family, messageSize, @"400");
  if (message != nil) {
    NSMutableParagraphStyle *paragraph = [NSMutableParagraphStyle new];
    paragraph.minimumLineHeight = round(messageSize * 1.35);
    paragraph.maximumLineHeight = round(messageSize * 1.35);
    _messageLabel.attributedText = [[NSAttributedString alloc]
        initWithString:message
            attributes:@{
              NSFontAttributeName : messageFont,
              NSForegroundColorAttributeName : AnchorTipColor(style, @"messageColor", UIColor.darkGrayColor),
              NSParagraphStyleAttributeName : paragraph,
            }];
  } else {
    _messageLabel.attributedText = nil;
  }

  _closeButton.hidden = !AnchorTipBool(config, @"showCloseButton", YES);
  _closeButton.tintColor = AnchorTipColor(style, @"closeColor", UIColor.grayColor);

  NSString *step = AnchorTipString(config, @"stepLabel");
  _stepLabel.hidden = step == nil;
  _stepLabel.text = step;
  _stepLabel.textColor = AnchorTipColor(style, @"stepColor", UIColor.grayColor);
  _stepLabel.font = AnchorTipFont(family, AnchorTipNumber(style, @"stepFontSize", 13), @"400");

  [self rebuildActionsWithFamily:family];

  self.accessibilityLabel = AnchorTipString(config, @"accessibilityLabel");
  [self setNeedsLayout];
}

- (void)rebuildActionsWithFamily:(NSString *)family
{
  for (UIButton *button in _actionButtons) [button removeFromSuperview];
  [_actionButtons removeAllObjects];
  [_actionSizes removeAllObjects];

  NSDictionary *style = _style;
  NSArray *actions = [_config[@"actions"] isKindOfClass:[NSArray class]] ? _config[@"actions"] : @[];
  CGFloat size = AnchorTipNumber(style, @"actionFontSize", 15);
  NSString *weight = AnchorTipString(style, @"actionFontWeight");
  for (NSUInteger index = 0; index < actions.count; index++) {
    NSDictionary *action = actions[index];
    if (![action isKindOfClass:[NSDictionary class]]) continue;
    NSString *actionStyle = AnchorTipString(action, @"style") ?: @"default";
    BOOL primary = [actionStyle isEqualToString:@"primary"];
    UIColor *color = primary ? AnchorTipColor(style, @"primaryTextColor", UIColor.whiteColor)
        : [actionStyle isEqualToString:@"destructive"] ? AnchorTipColor(style, @"destructiveColor", UIColor.systemRedColor)
                                                        : AnchorTipColor(style, @"actionColor", UIColor.systemBlueColor);
    UIFont *font = AnchorTipFont(family, size, [actionStyle isEqualToString:@"cancel"] ? @"400" : weight);

    UIButton *button = [UIButton buttonWithType:UIButtonTypeCustom];
    [button setTitle:AnchorTipString(action, @"label") forState:UIControlStateNormal];
    [button setTitleColor:color forState:UIControlStateNormal];
    [button setTitleColor:[color colorWithAlphaComponent:0.5] forState:UIControlStateHighlighted];
    button.titleLabel.font = font;
    button.tag = (NSInteger)index;
    [button addTarget:self action:@selector(handleAction:) forControlEvents:UIControlEventTouchUpInside];

    CGSize text = [[button titleForState:UIControlStateNormal] ?: @"" sizeWithAttributes:@{NSFontAttributeName : font}];
    CGSize buttonSize = primary ? CGSizeMake(ceil(text.width) + 28, ceil(text.height) + 14)
                                : CGSizeMake(ceil(text.width), ceil(text.height) + 8);
    if (primary) {
      button.backgroundColor = AnchorTipColor(style, @"primaryBackgroundColor", UIColor.systemBlueColor);
      button.layer.cornerRadius = buttonSize.height / 2;
    }
    [self addSubview:button];
    [_actionButtons addObject:button];
    [_actionSizes addObject:[NSValue valueWithCGSize:buttonSize]];
  }
}

#pragma mark - Layout

- (CGFloat)padding
{
  return AnchorTipNumber(_style, @"padding", 14);
}

- (AnchorTipMetrics)metricsForWidth:(CGFloat)width fitting:(BOOL)fitting
{
  AnchorTipMetrics metrics;
  CGFloat inner = MAX(0, width - 2 * [self padding]);
  metrics.icon = AnchorTipLabelSize(_iconLabel, inner);
  CGFloat iconWidth = _iconLabel.hidden ? 0 : metrics.icon.width + AnchorTipIconGap;
  CGFloat closeWidth = _closeButton.hidden ? 0 : AnchorTipCloseSize + AnchorTipCloseGap;
  CGFloat textMax = MAX(0, inner - iconWidth - closeWidth);
  metrics.title = AnchorTipLabelSize(_titleLabel, textMax);
  metrics.message = AnchorTipLabelSize(_messageLabel, textMax);
  metrics.textWidth = fitting ? MAX(metrics.title.width, metrics.message.width) : textMax;
  CGFloat gap = (!_titleLabel.hidden && !_messageLabel.hidden) ? AnchorTipTitleGap : 0;
  CGFloat textHeight = metrics.title.height + gap + metrics.message.height;
  metrics.rowHeight = MAX(textHeight, MAX(metrics.icon.height, _closeButton.hidden ? 0 : AnchorTipCloseSize + 2));

  metrics.step = AnchorTipLabelSize(_stepLabel, inner);
  CGFloat actionsWidth = 0;
  CGFloat actionsHeight = 0;
  for (NSUInteger index = 0; index < _actionSizes.count; index++) {
    CGSize size = _actionSizes[index].CGSizeValue;
    actionsWidth += size.width + (index > 0 ? AnchorTipActionGap : 0);
    actionsHeight = MAX(actionsHeight, size.height);
  }
  metrics.hasFooter = _actionSizes.count > 0 || !_stepLabel.hidden;
  metrics.footerWidth = metrics.step.width + (!_stepLabel.hidden && _actionSizes.count > 0 ? AnchorTipStepGap : 0) + actionsWidth;
  metrics.footerHeight = MAX(metrics.step.height, actionsHeight);
  return metrics;
}

- (CGSize)fittingSizeForMaxWidth:(CGFloat)maxWidth
{
  CGFloat padding = [self padding];
  AnchorTipMetrics metrics = [self metricsForWidth:maxWidth fitting:YES];
  CGFloat iconWidth = _iconLabel.hidden ? 0 : metrics.icon.width + AnchorTipIconGap;
  CGFloat closeWidth = _closeButton.hidden ? 0 : AnchorTipCloseSize + AnchorTipCloseGap;
  CGFloat rowWidth = iconWidth + metrics.textWidth + closeWidth;
  CGFloat width = MIN(maxWidth, ceil(MAX(rowWidth, metrics.footerWidth) + 2 * padding));
  // Text wraps differently at the final width; measure the height there.
  AnchorTipMetrics final = [self metricsForWidth:width fitting:NO];
  CGFloat height = 2 * padding + final.rowHeight + (final.hasFooter ? AnchorTipFooterGap + final.footerHeight : 0);
  return CGSizeMake(width, ceil(height));
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  CGFloat width = self.bounds.size.width;
  CGFloat padding = [self padding];
  AnchorTipMetrics metrics = [self metricsForWidth:width fitting:NO];

  CGFloat x = padding;
  if (!_iconLabel.hidden) {
    _iconLabel.frame = CGRectMake(x, padding, metrics.icon.width, metrics.icon.height);
    x += metrics.icon.width + AnchorTipIconGap;
  }
  _titleLabel.frame = CGRectMake(x, padding, metrics.textWidth, metrics.title.height);
  CGFloat messageY = padding + metrics.title.height + (_titleLabel.hidden ? 0 : AnchorTipTitleGap);
  _messageLabel.frame = CGRectMake(x, messageY, metrics.textWidth, metrics.message.height);
  _closeButton.frame = CGRectMake(width - padding - AnchorTipCloseSize - 6, padding - 6, AnchorTipCloseSize + 12, AnchorTipCloseSize + 12);

  if (metrics.hasFooter) {
    CGFloat footerY = padding + metrics.rowHeight + AnchorTipFooterGap;
    _stepLabel.frame = CGRectMake(padding, footerY + (metrics.footerHeight - metrics.step.height) / 2, metrics.step.width, metrics.step.height);
    CGFloat right = width - padding;
    for (NSInteger index = (NSInteger)_actionButtons.count - 1; index >= 0; index--) {
      CGSize size = _actionSizes[(NSUInteger)index].CGSizeValue;
      _actionButtons[(NSUInteger)index].frame =
          CGRectMake(right - size.width, footerY + (metrics.footerHeight - size.height) / 2, size.width, size.height);
      right -= size.width + AnchorTipActionGap;
    }
  }
  [self updateShape];
}

- (void)setPlacement:(AnchorTipPlacement)placement arrowOffset:(CGFloat)arrowOffset arrowSize:(CGFloat)arrowSize
{
  _placement = placement;
  _arrowOffset = arrowOffset;
  _arrowSize = arrowSize;
  [self updateShape];
}

/** The rounded body with the arrow traced into the edge that faces the anchor. */
- (UIBezierPath *)bubblePath
{
  CGFloat w = self.bounds.size.width;
  CGFloat h = self.bounds.size.height;
  CGFloat r = MIN(AnchorTipNumber(_style, @"borderRadius", 14), MIN(w, h) / 2);
  CGFloat s = _arrowSize;
  CGFloat a = _arrowOffset;
  BOOL arrow = s > 0;
  UIBezierPath *path = [UIBezierPath bezierPath];

  [path moveToPoint:CGPointMake(r, 0)];
  if (arrow && _placement == AnchorTipPlacementBottom) {
    [path addLineToPoint:CGPointMake(a - s, 0)];
    [path addLineToPoint:CGPointMake(a, -s)];
    [path addLineToPoint:CGPointMake(a + s, 0)];
  }
  [path addLineToPoint:CGPointMake(w - r, 0)];
  [path addArcWithCenter:CGPointMake(w - r, r) radius:r startAngle:-M_PI_2 endAngle:0 clockwise:YES];
  if (arrow && _placement == AnchorTipPlacementLeft) {
    [path addLineToPoint:CGPointMake(w, a - s)];
    [path addLineToPoint:CGPointMake(w + s, a)];
    [path addLineToPoint:CGPointMake(w, a + s)];
  }
  [path addLineToPoint:CGPointMake(w, h - r)];
  [path addArcWithCenter:CGPointMake(w - r, h - r) radius:r startAngle:0 endAngle:M_PI_2 clockwise:YES];
  if (arrow && _placement == AnchorTipPlacementTop) {
    [path addLineToPoint:CGPointMake(a + s, h)];
    [path addLineToPoint:CGPointMake(a, h + s)];
    [path addLineToPoint:CGPointMake(a - s, h)];
  }
  [path addLineToPoint:CGPointMake(r, h)];
  [path addArcWithCenter:CGPointMake(r, h - r) radius:r startAngle:M_PI_2 endAngle:M_PI clockwise:YES];
  if (arrow && _placement == AnchorTipPlacementRight) {
    [path addLineToPoint:CGPointMake(0, a + s)];
    [path addLineToPoint:CGPointMake(-s, a)];
    [path addLineToPoint:CGPointMake(0, a - s)];
  }
  [path addLineToPoint:CGPointMake(0, r)];
  [path addArcWithCenter:CGPointMake(r, r) radius:r startAngle:M_PI endAngle:3 * M_PI_2 clockwise:YES];
  [path closePath];
  return path;
}

- (void)updateShape
{
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  CGPathRef path = [self bubblePath].CGPath;
  _shape.frame = self.bounds;
  _shape.path = path;
  self.layer.shadowPath = path;
  [CATransaction commit];
}

#pragma mark - Interaction

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch
{
  return ![touch.view isKindOfClass:[UIButton class]];
}

- (void)handleTap
{
  if (self.dismissing || self.onEvent == nil) return;
  self.onEvent(@"press", @{});
}

- (void)handleClose
{
  if (self.dismissing || self.onEvent == nil) return;
  self.onEvent(@"close", @{});
}

- (void)handleAction:(UIButton *)button
{
  if (self.dismissing || self.onEvent == nil) return;
  NSArray *actions = _config[@"actions"];
  if (![actions isKindOfClass:[NSArray class]] || button.tag >= (NSInteger)actions.count) return;
  NSDictionary *action = actions[(NSUInteger)button.tag];
  NSString *actionId = AnchorTipString(action, @"id") ?: [NSString stringWithFormat:@"%ld", (long)button.tag];
  self.onEvent(@"action", @{ @"id" : actionId, @"dismissOnPress" : @(AnchorTipBool(action, @"dismissOnPress", YES)) });
}

#pragma mark - Accessibility

- (NSArray *)accessibilityElements
{
  NSMutableArray *elements = [NSMutableArray new];
  for (UIView *view in @[ _titleLabel, _messageLabel, _stepLabel ]) {
    if (!view.hidden) [elements addObject:view];
  }
  [elements addObjectsFromArray:_actionButtons];
  if (!_closeButton.hidden) [elements addObject:_closeButton];
  return elements;
}

@end
