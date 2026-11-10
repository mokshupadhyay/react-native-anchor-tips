#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/** The side of the anchor the bubble sits on. */
typedef NS_ENUM(NSInteger, AnchorTipSide) {
  AnchorTipSideTop,
  AnchorTipSideBottom,
  AnchorTipSideLeft,
  AnchorTipSideRight,
};

typedef struct {
  AnchorTipSide side;
  /** Top-left corner of the bubble body. */
  CGFloat x;
  CGFloat y;
  /** Arrow center along the edge facing the anchor. */
  CGFloat arrowOffset;
} AnchorTipPlacement;

/** Port of `computePlacement` in `src/core/geometry.ts`; keep the two in sync. */
FOUNDATION_EXPORT AnchorTipPlacement AnchorTipComputePlacement(
    CGRect anchor,
    CGSize bubble,
    CGSize viewport,
    UIEdgeInsets insets,
    NSString *preference,
    NSString *align,
    CGFloat offset,
    CGFloat arrowSize,
    CGFloat margin,
    CGFloat borderRadius);

NS_ASSUME_NONNULL_END
