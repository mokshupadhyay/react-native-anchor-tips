#import "AnchorTipView.h"

#import <CoreText/CoreText.h>
#import <React/RCTConvert.h>

static CGFloat AnchorTipNumber(NSDictionary *dict, NSString *key, CGFloat fallback)
{
  id value = dict[key];
  return [value isKindOfClass:[NSNumber class]] ? [value doubleValue] : fallback;
}

static BOOL AnchorTipBool(NSDictionary *dict, NSString *key, BOOL fallback)
{
  id value = dict[key];
  return [value isKindOfClass:[NSNumber class]] ? [value boolValue] : fallback;
}

static NSString *_Nullable AnchorTipString(NSDictionary *dict, NSString *key)
{
  id value = dict[key];
  return [value isKindOfClass:[NSString class]] && [value length] > 0 ? value : nil;
}

static UIColor *AnchorTipColor(NSDictionary *dict, NSString *key, UIColor *fallback)
{
  id value = dict[key];
  if (value == nil || value == [NSNull null]) return fallback;
  UIColor *color = [RCTConvert UIColor:value];
  return color ?: fallback;
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

/** Largest Dynamic Type scale applied to tip text. */
static const CGFloat AnchorTipMaxFontScale = 1.35;

/** Scales a font with Dynamic Type, up to `AnchorTipMaxFontScale`. */
static UIFont *AnchorTipScaled(UIFont *font, CGFloat size)
{
  return [[UIFontMetrics defaultMetrics] scaledFontForFont:font maximumPointSize:size * AnchorTipMaxFontScale];
}

static UIFont *AnchorTipFont(NSString *_Nullable family, CGFloat size, NSString *_Nullable weight)
{
  if (family != nil) {
    UIFont *custom = [UIFont fontWithName:family size:size];
    if (custom != nil) return AnchorTipScaled(custom, size);
  }
  return AnchorTipScaled([UIFont systemFontOfSize:size weight:AnchorTipFontWeight(weight)], size);
}

/** Like `AnchorTipFont`, with digits of equal width so a step counter keeps its width. */
static UIFont *AnchorTipTabularFont(NSString *_Nullable family, CGFloat size, NSString *_Nullable weight)
{
  UIFont *base = nil;
  if (family != nil) base = [UIFont fontWithName:family size:size];
  if (base == nil) base = [UIFont systemFontOfSize:size weight:AnchorTipFontWeight(weight)];
  UIFontDescriptor *descriptor = [base.fontDescriptor fontDescriptorByAddingAttributes:@{
    UIFontDescriptorFeatureSettingsAttribute : @[ @{
      UIFontFeatureTypeIdentifierKey : @(kNumberSpacingType),
      UIFontFeatureSelectorIdentifierKey : @(kMonospacedNumbersSelector),
    } ],
  }];
  return AnchorTipScaled([UIFont fontWithDescriptor:descriptor size:size], size);
}

/** Text with a fixed line height that grows with the font's Dynamic Type scale. */
static NSAttributedString *AnchorTipText(NSString *text, UIFont *font, CGFloat size, CGFloat lineHeight, UIColor *color)
{
  NSMutableParagraphStyle *paragraph = [NSMutableParagraphStyle new];
  CGFloat scaled = round(lineHeight * (size > 0 ? font.pointSize / size : 1));
  paragraph.minimumLineHeight = scaled;
  paragraph.maximumLineHeight = scaled;
  return [[NSAttributedString alloc] initWithString:text
                                         attributes:@{
                                           NSFontAttributeName : font,
                                           NSForegroundColorAttributeName : color,
                                           NSParagraphStyleAttributeName : paragraph,
                                         }];
}

/** Radius of the rounded arrow apex, measured along each arrow edge. */
static const CGFloat AnchorTipApexRounding = 2;

/** Draws the arrow from `from` to `apex` to `to`, with a rounded apex. */
static void AnchorTipAddArrow(UIBezierPath *path, CGPoint from, CGPoint apex, CGPoint to)
{
  CGFloat length = hypot(apex.x - from.x, apex.y - from.y);
  CGFloat t = length > 0 ? MAX(0, 1 - AnchorTipApexRounding / length) : 0;
  CGPoint before = CGPointMake(from.x + (apex.x - from.x) * t, from.y + (apex.y - from.y) * t);
  CGPoint after = CGPointMake(to.x + (apex.x - to.x) * t, to.y + (apex.y - to.y) * t);
  [path addLineToPoint:from];
  [path addLineToPoint:before];
  [path addQuadCurveToPoint:after controlPoint:apex];
  [path addLineToPoint:to];
}

/** The close button: a 28pt box that overhangs the row like the React version, with a 44pt touch target. */
@interface AnchorTipCloseButton : UIButton
@end

@implementation AnchorTipCloseButton

- (CGSize)intrinsicContentSize
{
  // In alignment-rect terms; see `alignmentRectInsets`.
  return CGSizeMake(22, 24);
}

- (UIEdgeInsets)alignmentRectInsets
{
  // The 28pt frame sits 4pt above the row and 6pt past its trailing edge.
  return UIEdgeInsetsMake(4, 0, 0, 6);
}

- (BOOL)pointInside:(CGPoint)point withEvent:(UIEvent *)event
{
  return CGRectContainsPoint(CGRectInset(self.bounds, -8, -8), point);
}

@end

/** Rounded rect with the arrow notched into the edge that faces the anchor, clockwise. */
static UIBezierPath *AnchorTipBubblePath(CGSize size, CGFloat radius, AnchorTipSide side, CGFloat offset, CGFloat arrow)
{
  CGFloat w = size.width;
  CGFloat h = size.height;
  CGFloat r = MIN(radius, MIN(w, h) / 2);
  BOOL hasArrow = arrow > 0;
  UIBezierPath *path = [UIBezierPath bezierPath];
  [path moveToPoint:CGPointMake(r, 0)];
  if (hasArrow && side == AnchorTipSideBottom) {
    AnchorTipAddArrow(path, CGPointMake(offset - arrow, 0), CGPointMake(offset, -arrow), CGPointMake(offset + arrow, 0));
  }
  [path addLineToPoint:CGPointMake(w - r, 0)];
  [path addArcWithCenter:CGPointMake(w - r, r) radius:r startAngle:-M_PI_2 endAngle:0 clockwise:YES];
  if (hasArrow && side == AnchorTipSideLeft) {
    AnchorTipAddArrow(path, CGPointMake(w, offset - arrow), CGPointMake(w + arrow, offset), CGPointMake(w, offset + arrow));
  }
  [path addLineToPoint:CGPointMake(w, h - r)];
  [path addArcWithCenter:CGPointMake(w - r, h - r) radius:r startAngle:0 endAngle:M_PI_2 clockwise:YES];
  if (hasArrow && side == AnchorTipSideTop) {
    AnchorTipAddArrow(path, CGPointMake(offset + arrow, h), CGPointMake(offset, h + arrow), CGPointMake(offset - arrow, h));
  }
  [path addLineToPoint:CGPointMake(r, h)];
  [path addArcWithCenter:CGPointMake(r, h - r) radius:r startAngle:M_PI_2 endAngle:M_PI clockwise:YES];
  if (hasArrow && side == AnchorTipSideRight) {
    AnchorTipAddArrow(path, CGPointMake(0, offset + arrow), CGPointMake(-arrow, offset), CGPointMake(0, offset - arrow));
  }
  [path addLineToPoint:CGPointMake(0, r)];
  [path addArcWithCenter:CGPointMake(r, r) radius:r startAngle:M_PI endAngle:3 * M_PI_2 clockwise:YES];
  [path closePath];
  return path;
}

/** A primary action that keeps a full pill shape at whatever height Auto Layout gives it. */
@interface AnchorTipPillButton : UIButton
@end

@implementation AnchorTipPillButton
- (void)layoutSubviews
{
  [super layoutSubviews];
  self.layer.cornerRadius = self.bounds.size.height / 2;
}
@end

@implementation AnchorTipView {
  NSDictionary *_style;
  CAShapeLayer *_shape;
  UIStackView *_content;
  NSArray<NSLayoutConstraint *> *_paddingConstraints;
  UIStackView *_row;
  UILabel *_iconLabel;
  UIStackView *_textStack;
  UILabel *_titleLabel;
  UILabel *_messageLabel;
  AnchorTipCloseButton *_closeButton;
  UIStackView *_footer;
  UILabel *_stepLabel;
  UIStackView *_actionsStack;
  NSMutableArray<UIButton *> *_primaryButtons;
  AnchorTipSide _side;
  CGFloat _arrowOffset;
}

- (instancetype)initWithTipId:(NSString *)tipId config:(NSDictionary *)config
{
  if (self = [super initWithFrame:CGRectZero]) {
    _tipId = [tipId copy];
    _primaryButtons = [NSMutableArray new];
    _side = AnchorTipSideBottom;
    [self buildHierarchy];
    [self applyConfig:config];

    UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleTap)];
    [self addGestureRecognizer:tap];
  }
  return self;
}

#pragma mark - Hierarchy

- (void)buildHierarchy
{
  self.backgroundColor = UIColor.clearColor;
  self.clipsToBounds = NO;
  self.isAccessibilityElement = NO;

  _shape = [CAShapeLayer layer];
  [self.layer insertSublayer:_shape atIndex:0];

  _content = [UIStackView new];
  _content.translatesAutoresizingMaskIntoConstraints = NO;
  _content.axis = UILayoutConstraintAxisVertical;
  _content.alignment = UIStackViewAlignmentFill;
  _content.spacing = 14;
  [self addSubview:_content];
  _paddingConstraints = @[
    [_content.topAnchor constraintEqualToAnchor:self.topAnchor constant:14],
    [_content.leadingAnchor constraintEqualToAnchor:self.leadingAnchor constant:14],
    [self.trailingAnchor constraintEqualToAnchor:_content.trailingAnchor constant:14],
    [self.bottomAnchor constraintEqualToAnchor:_content.bottomAnchor constant:14],
  ];
  [NSLayoutConstraint activateConstraints:_paddingConstraints];

  _row = [UIStackView new];
  _row.axis = UILayoutConstraintAxisHorizontal;
  _row.alignment = UIStackViewAlignmentTop;
  _row.spacing = 10;
  [_content addArrangedSubview:_row];

  _iconLabel = [UILabel new];
  [_iconLabel setContentHuggingPriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
  [_iconLabel setContentCompressionResistancePriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
  [_row addArrangedSubview:_iconLabel];

  _textStack = [UIStackView new];
  _textStack.axis = UILayoutConstraintAxisVertical;
  _textStack.alignment = UIStackViewAlignmentLeading;
  _textStack.spacing = 2;
  [_textStack setContentHuggingPriority:UILayoutPriorityDefaultLow forAxis:UILayoutConstraintAxisHorizontal];
  _titleLabel = [UILabel new];
  _titleLabel.numberOfLines = 0;
  _messageLabel = [UILabel new];
  _messageLabel.numberOfLines = 0;
  [_textStack addArrangedSubview:_titleLabel];
  [_textStack addArrangedSubview:_messageLabel];
  [_row addArrangedSubview:_textStack];
  [_row setCustomSpacing:8 afterView:_textStack];

  _closeButton = [AnchorTipCloseButton buttonWithType:UIButtonTypeSystem];
  [_closeButton setTitle:@"\u2715" forState:UIControlStateNormal];
  _closeButton.titleLabel.font = [UIFont systemFontOfSize:13 weight:UIFontWeightMedium];
  _closeButton.accessibilityLabel = @"Dismiss";
  [_closeButton setContentHuggingPriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
  [_closeButton setContentCompressionResistancePriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
  [_closeButton addTarget:self action:@selector(handleClose) forControlEvents:UIControlEventTouchUpInside];
  [_row addArrangedSubview:_closeButton];

  _footer = [UIStackView new];
  _footer.axis = UILayoutConstraintAxisHorizontal;
  _footer.alignment = UIStackViewAlignmentCenter;
  _footer.spacing = 12;
  [_content addArrangedSubview:_footer];

  _stepLabel = [UILabel new];
  [_stepLabel setContentHuggingPriority:UILayoutPriorityDefaultLow forAxis:UILayoutConstraintAxisHorizontal];
  [_footer addArrangedSubview:_stepLabel];

  _actionsStack = [UIStackView new];
  _actionsStack.axis = UILayoutConstraintAxisHorizontal;
  _actionsStack.alignment = UIStackViewAlignmentCenter;
  _actionsStack.spacing = 20;
  [_actionsStack setContentHuggingPriority:UILayoutPriorityRequired forAxis:UILayoutConstraintAxisHorizontal];
  [_footer addArrangedSubview:_actionsStack];
}

#pragma mark - Config

- (void)applyConfig:(NSDictionary *)config
{
  _config = [config copy];
  NSDictionary *style = [config[@"style"] isKindOfClass:[NSDictionary class]] ? config[@"style"] : @{};
  _style = style;
  NSString *fontFamily = AnchorTipString(style, @"fontFamily");

  CGFloat padding = AnchorTipNumber(style, @"padding", 14);
  for (NSLayoutConstraint *constraint in _paddingConstraints) constraint.constant = padding;

  _shape.fillColor = AnchorTipColor(style, @"backgroundColor", UIColor.whiteColor).CGColor;
  CGFloat borderWidth = AnchorTipNumber(style, @"borderWidth", 0);
  _shape.lineWidth = borderWidth;
  _shape.strokeColor = borderWidth > 0 ? AnchorTipColor(style, @"borderColor", UIColor.clearColor).CGColor : nil;

  if (AnchorTipBool(style, @"shadowEnabled", YES)) {
    self.layer.shadowColor = AnchorTipColor(style, @"shadowColor", UIColor.blackColor).CGColor;
    self.layer.shadowOpacity = AnchorTipNumber(style, @"shadowOpacity", 0.12);
    // Halved like the React renderer, which passes `shadow.radius / 2` to the same CALayer property.
    self.layer.shadowRadius = AnchorTipNumber(style, @"shadowRadius", 20) / 2.0;
    self.layer.shadowOffset = CGSizeMake(0, AnchorTipNumber(style, @"shadowOffsetY", 8));
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
  CGFloat titleSize = AnchorTipNumber(style, @"titleFontSize", 15);
  _titleLabel.attributedText = title == nil
      ? nil
      : AnchorTipText(title,
                      AnchorTipFont(fontFamily, titleSize, AnchorTipString(style, @"titleFontWeight")),
                      titleSize,
                      AnchorTipNumber(style, @"titleLineHeight", 20),
                      AnchorTipColor(style, @"titleColor", UIColor.blackColor));

  NSString *message = AnchorTipString(config, @"message");
  _messageLabel.hidden = message == nil;
  CGFloat messageSize = AnchorTipNumber(style, @"messageFontSize", 14);
  _messageLabel.attributedText = message == nil
      ? nil
      : AnchorTipText(message,
                      AnchorTipFont(fontFamily, messageSize, @"400"),
                      messageSize,
                      AnchorTipNumber(style, @"messageLineHeight", round(messageSize * 1.35)),
                      AnchorTipColor(style, @"messageColor", UIColor.darkGrayColor));

  _closeButton.hidden = !AnchorTipBool(config, @"showCloseButton", YES);
  _closeButton.tintColor = AnchorTipColor(style, @"closeColor", UIColor.grayColor);

  NSString *step = AnchorTipString(config, @"stepLabel");
  _stepLabel.text = step;
  _stepLabel.textColor = AnchorTipColor(style, @"stepColor", UIColor.grayColor);
  _stepLabel.font = AnchorTipTabularFont(fontFamily, AnchorTipNumber(style, @"stepFontSize", 13), @"500");

  [self rebuildActions:config style:style fontFamily:fontFamily];
  _footer.hidden = step == nil && _actionsStack.arrangedSubviews.count == 0;

  NSString *label = AnchorTipString(config, @"accessibilityLabel");
  self.accessibilityLabel = label;
  [self setNeedsLayout];
}

- (void)rebuildActions:(NSDictionary *)config style:(NSDictionary *)style fontFamily:(NSString *)fontFamily
{
  for (UIView *view in _actionsStack.arrangedSubviews) {
    [_actionsStack removeArrangedSubview:view];
    [view removeFromSuperview];
  }
  [_primaryButtons removeAllObjects];
  NSArray *actions = [config[@"actions"] isKindOfClass:[NSArray class]] ? config[@"actions"] : @[];
  CGFloat size = AnchorTipNumber(style, @"actionFontSize", 14);
  UIButton *previous = nil;
  NSString *weight = AnchorTipString(style, @"actionFontWeight");
  for (NSUInteger index = 0; index < actions.count; index++) {
    NSDictionary *action = actions[index];
    if (![action isKindOfClass:[NSDictionary class]]) continue;
    NSString *actionStyle = AnchorTipString(action, @"style") ?: @"default";
    BOOL primary = [actionStyle isEqualToString:@"primary"];
    BOOL cancel = [actionStyle isEqualToString:@"cancel"];
    UIButton *button = primary ? [AnchorTipPillButton buttonWithType:UIButtonTypeSystem]
                               : [UIButton buttonWithType:UIButtonTypeSystem];
    // Hierarchy: a filled primary, colored default and destructive actions, and a neutral cancel.
    UIColor *color = primary ? AnchorTipColor(style, @"primaryTextColor", UIColor.whiteColor)
        : [actionStyle isEqualToString:@"destructive"] ? AnchorTipColor(style, @"destructiveColor", UIColor.systemRedColor)
        : cancel                                         ? AnchorTipColor(style, @"messageColor", UIColor.darkGrayColor)
                                                         : AnchorTipColor(style, @"actionColor", UIColor.systemBlueColor);
    [button setTitle:AnchorTipString(action, @"label") forState:UIControlStateNormal];
    [button setTitleColor:color forState:UIControlStateNormal];
    button.titleLabel.font = AnchorTipFont(fontFamily, size, cancel ? @"500" : weight);
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    button.contentEdgeInsets = primary ? UIEdgeInsetsMake(8, 16, 8, 16) : UIEdgeInsetsMake(6, 0, 6, 0);
#pragma clang diagnostic pop
    if (primary) {
      button.backgroundColor = AnchorTipColor(style, @"primaryBackgroundColor", UIColor.systemBlueColor);
      button.clipsToBounds = YES;
      [_primaryButtons addObject:button];
    }
    button.tag = (NSInteger)index;
    [button addTarget:self action:@selector(handleAction:) forControlEvents:UIControlEventTouchUpInside];
    [_actionsStack addArrangedSubview:button];
    // 12pt before a primary button, 20pt before a text action, as in the React renderer.
    if (previous != nil) [_actionsStack setCustomSpacing:primary ? 12 : 20 afterView:previous];
    previous = button;
  }
  _actionsStack.hidden = _actionsStack.arrangedSubviews.count == 0;
}

#pragma mark - Layout

- (CGSize)fittingSizeForMaxWidth:(CGFloat)maxWidth
{
  CGFloat padding = AnchorTipNumber(_style, @"padding", 14);
  _titleLabel.preferredMaxLayoutWidth = 0;
  _messageLabel.preferredMaxLayoutWidth = 0;
  CGSize natural = [_content systemLayoutSizeFittingSize:UILayoutFittingCompressedSize];
  CGFloat width = MIN(ceil(natural.width) + 2 * padding, maxWidth);
  CGFloat inner = MAX(0, width - 2 * padding);

  CGFloat textWidth = inner;
  if (!_iconLabel.hidden) textWidth -= _iconLabel.intrinsicContentSize.width + _row.spacing;
  if (!_closeButton.hidden) textWidth -= _closeButton.intrinsicContentSize.width + [_row customSpacingAfterView:_textStack];
  _titleLabel.preferredMaxLayoutWidth = MAX(0, textWidth);
  _messageLabel.preferredMaxLayoutWidth = MAX(0, textWidth);

  CGSize fitted = [_content systemLayoutSizeFittingSize:CGSizeMake(inner, UILayoutFittingCompressedSize.height)
                          withHorizontalFittingPriority:UILayoutPriorityRequired
                                verticalFittingPriority:UILayoutPriorityFittingSizeLevel];
  return CGSizeMake(width, ceil(fitted.height) + 2 * padding);
}

- (void)applyPlacement:(AnchorTipPlacement)placement size:(CGSize)size
{
  _side = placement.side;
  _arrowOffset = placement.arrowOffset;
  CGAffineTransform transform = self.transform;
  self.transform = CGAffineTransformIdentity;
  self.frame = CGRectMake(placement.x, placement.y, size.width, size.height);
  self.transform = transform;
  [self updateShape];
}

- (void)updateShape
{
  BOOL showArrow = AnchorTipBool(_config, @"showArrow", YES);
  CGFloat arrow = showArrow ? AnchorTipNumber(_style, @"arrowSize", 7) : 0;
  CGFloat radius = AnchorTipNumber(_style, @"borderRadius", 14);
  UIBezierPath *path = AnchorTipBubblePath(self.bounds.size, radius, _side, _arrowOffset, arrow);
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _shape.frame = self.bounds;
  _shape.path = path.CGPath;
  [CATransaction commit];
  self.layer.shadowPath = path.CGPath;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  for (UIButton *button in _primaryButtons) {
    button.layer.cornerRadius = button.bounds.size.height / 2;
  }
  [self updateShape];
}

#pragma mark - Interaction

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

#pragma mark - Animation

- (NSString *)animationPreset
{
  return AnchorTipString(_config, @"animation") ?: @"scale";
}

/** Slightly shrunk to `scale` and pulled toward the anchor. */
- (CGAffineTransform)hiddenTransformWithScale:(CGFloat)scale
{
  if (![[self animationPreset] isEqualToString:@"scale"]) return CGAffineTransformIdentity;
  CGFloat travel = 6;
  CGFloat dx = 0;
  CGFloat dy = 0;
  switch (_side) {
    case AnchorTipSideTop:
      dy = travel;
      break;
    case AnchorTipSideBottom:
      dy = -travel;
      break;
    case AnchorTipSideLeft:
      dx = travel;
      break;
    case AnchorTipSideRight:
      dx = -travel;
      break;
  }
  return CGAffineTransformScale(CGAffineTransformMakeTranslation(dx, dy), scale, scale);
}

- (void)animateIn
{
  if ([[self animationPreset] isEqualToString:@"none"]) {
    self.alpha = 1;
    self.transform = CGAffineTransformIdentity;
    return;
  }
  self.alpha = 0;
  self.transform = [self hiddenTransformWithScale:0.94];
  // 240ms on cubic-bezier(0.2, 0.9, 0.3, 1), matching the React and Android renderers.
  UICubicTimingParameters *timing = [[UICubicTimingParameters alloc] initWithControlPoint1:CGPointMake(0.2, 0.9)
                                                                             controlPoint2:CGPointMake(0.3, 1)];
  UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc] initWithDuration:0.24 timingParameters:timing];
  animator.userInteractionEnabled = YES;
  [animator addAnimations:^{
    self.alpha = 1;
    self.transform = CGAffineTransformIdentity;
  }];
  [animator startAnimation];
}

- (void)animateOutWithCompletion:(void (^)(void))completion
{
  if ([[self animationPreset] isEqualToString:@"none"]) {
    completion();
    return;
  }
  // 140ms on cubic-bezier(0.4, 0, 1, 1).
  UICubicTimingParameters *timing = [[UICubicTimingParameters alloc] initWithControlPoint1:CGPointMake(0.4, 0)
                                                                             controlPoint2:CGPointMake(1, 1)];
  UIViewPropertyAnimator *animator = [[UIViewPropertyAnimator alloc] initWithDuration:0.14 timingParameters:timing];
  [animator addAnimations:^{
    self.alpha = 0;
    self.transform = [self hiddenTransformWithScale:0.96];
  }];
  [animator addCompletion:^(__unused UIViewAnimatingPosition position) {
    completion();
  }];
  [animator startAnimation];
}

@end

@implementation AnchorTipBackdropView {
  CAShapeLayer *_dim;
  CGRect _hole;
  CGFloat _radius;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    self.backgroundColor = UIColor.clearColor;
    _dim = [CAShapeLayer layer];
    _dim.fillRule = kCAFillRuleEvenOdd;
    [self.layer addSublayer:_dim];
    UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleTap)];
    [self addGestureRecognizer:tap];
  }
  return self;
}

- (void)setHole:(CGRect)hole radius:(CGFloat)radius color:(UIColor *)color
{
  _hole = hole;
  _radius = radius;
  _dim.fillColor = color.CGColor;
  [self setNeedsLayout];
}

- (BOOL)holeContainsPoint:(CGPoint)point
{
  return CGRectContainsPoint(_hole, point);
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  UIBezierPath *path = [UIBezierPath bezierPathWithRect:self.bounds];
  [path appendPath:[UIBezierPath bezierPathWithRoundedRect:_hole cornerRadius:_radius]];
  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _dim.frame = self.bounds;
  _dim.path = path.CGPath;
  [CATransaction commit];
}

- (void)handleTap
{
  if (self.onTap) self.onTap();
}

@end
