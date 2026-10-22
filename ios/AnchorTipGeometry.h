#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, AnchorTipPlacement) {
  AnchorTipPlacementTop,
  AnchorTipPlacementBottom,
  AnchorTipPlacementLeft,
  AnchorTipPlacementRight,
};

typedef struct {
  AnchorTipPlacement placement;
  /** Frame of the bubble body, without the arrow. */
  CGRect frame;
  /** Arrow center along the edge facing the anchor, from the body's left (top/bottom) or top (left/right). */
  CGFloat arrowOffset;
} AnchorTipLayout;

/** Port of `computePlacement` in src/core/geometry.ts; keep the two in sync. */
FOUNDATION_EXPORT AnchorTipLayout AnchorTipComputeLayout(
    CGRect anchor,
    CGSize bubble,
    CGSize viewport,
    UIEdgeInsets insets,
    NSString *_Nullable preference,
    NSString *_Nullable align,
    CGFloat offset,
    CGFloat arrowSize,
    CGFloat margin,
    CGFloat borderRadius);

FOUNDATION_EXPORT BOOL AnchorTipPlacementIsVertical(AnchorTipPlacement placement);

NS_ASSUME_NONNULL_END
