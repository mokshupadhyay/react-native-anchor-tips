#import "AnchorTipGeometry.h"

static CGFloat AnchorTipClamp(CGFloat value, CGFloat min, CGFloat max)
{
  if (max < min) return min;
  return MIN(MAX(value, min), max);
}

BOOL AnchorTipPlacementIsVertical(AnchorTipPlacement placement)
{
  return placement == AnchorTipPlacementTop || placement == AnchorTipPlacementBottom;
}

static NSArray<NSNumber *> *AnchorTipOrder(NSString *_Nullable preference)
{
  if ([preference isEqualToString:@"top"]) {
    return @[ @(AnchorTipPlacementTop), @(AnchorTipPlacementBottom), @(AnchorTipPlacementRight), @(AnchorTipPlacementLeft) ];
  }
  if ([preference isEqualToString:@"right"]) {
    return @[ @(AnchorTipPlacementRight), @(AnchorTipPlacementLeft), @(AnchorTipPlacementBottom), @(AnchorTipPlacementTop) ];
  }
  if ([preference isEqualToString:@"left"]) {
    return @[ @(AnchorTipPlacementLeft), @(AnchorTipPlacementRight), @(AnchorTipPlacementBottom), @(AnchorTipPlacementTop) ];
  }
  return @[ @(AnchorTipPlacementBottom), @(AnchorTipPlacementTop), @(AnchorTipPlacementRight), @(AnchorTipPlacementLeft) ];
}

static CGFloat AnchorTipCrossStart(CGFloat anchorStart, CGFloat anchorLength, CGFloat length, NSString *_Nullable align)
{
  if ([align isEqualToString:@"start"]) return anchorStart;
  if ([align isEqualToString:@"end"]) return anchorStart + anchorLength - length;
  return anchorStart + anchorLength / 2 - length / 2;
}

AnchorTipLayout AnchorTipComputeLayout(
    CGRect anchor,
    CGSize bubble,
    CGSize viewport,
    UIEdgeInsets insets,
    NSString *_Nullable preference,
    NSString *_Nullable align,
    CGFloat offset,
    CGFloat arrowSize,
    CGFloat margin,
    CGFloat borderRadius)
{
  CGFloat spaceTop = CGRectGetMinY(anchor) - insets.top - margin;
  CGFloat spaceBottom = viewport.height - insets.bottom - margin - CGRectGetMaxY(anchor);
  CGFloat spaceLeft = CGRectGetMinX(anchor) - insets.left - margin;
  CGFloat spaceRight = viewport.width - insets.right - margin - CGRectGetMaxX(anchor);
  CGFloat reach = offset + arrowSize;
  CGFloat usableWidth = viewport.width - insets.left - insets.right - 2 * margin;
  CGFloat usableHeight = viewport.height - insets.top - insets.bottom - 2 * margin;

  AnchorTipPlacement placement = spaceTop > spaceBottom ? AnchorTipPlacementTop : AnchorTipPlacementBottom;
  for (NSNumber *candidate in AnchorTipOrder(preference)) {
    AnchorTipPlacement side = (AnchorTipPlacement)candidate.integerValue;
    BOOL fits;
    switch (side) {
      case AnchorTipPlacementTop:
        fits = spaceTop >= bubble.height + reach && bubble.width <= usableWidth;
        break;
      case AnchorTipPlacementBottom:
        fits = spaceBottom >= bubble.height + reach && bubble.width <= usableWidth;
        break;
      case AnchorTipPlacementLeft:
        fits = spaceLeft >= bubble.width + reach && bubble.height <= usableHeight;
        break;
      case AnchorTipPlacementRight:
        fits = spaceRight >= bubble.width + reach && bubble.height <= usableHeight;
        break;
    }
    if (fits) {
      placement = side;
      break;
    }
  }

  CGFloat minX = insets.left + margin;
  CGFloat maxX = viewport.width - insets.right - margin - bubble.width;
  CGFloat minY = insets.top + margin;
  CGFloat maxY = viewport.height - insets.bottom - margin - bubble.height;
  CGFloat x;
  CGFloat y;
  if (AnchorTipPlacementIsVertical(placement)) {
    x = AnchorTipClamp(AnchorTipCrossStart(CGRectGetMinX(anchor), CGRectGetWidth(anchor), bubble.width, align), minX, maxX);
    y = placement == AnchorTipPlacementBottom ? CGRectGetMaxY(anchor) + reach : CGRectGetMinY(anchor) - reach - bubble.height;
    y = AnchorTipClamp(y, minY, maxY);
  } else {
    y = AnchorTipClamp(AnchorTipCrossStart(CGRectGetMinY(anchor), CGRectGetHeight(anchor), bubble.height, align), minY, maxY);
    x = placement == AnchorTipPlacementRight ? CGRectGetMaxX(anchor) + reach : CGRectGetMinX(anchor) - reach - bubble.width;
    x = AnchorTipClamp(x, minX, maxX);
  }

  BOOL vertical = AnchorTipPlacementIsVertical(placement);
  CGFloat length = vertical ? bubble.width : bubble.height;
  CGFloat center = vertical ? CGRectGetMidX(anchor) - x : CGRectGetMidY(anchor) - y;
  CGFloat edge = MIN(length / 2, borderRadius + arrowSize);

  AnchorTipLayout layout;
  layout.placement = placement;
  layout.frame = CGRectMake(x, y, bubble.width, bubble.height);
  layout.arrowOffset = AnchorTipClamp(center, edge, length - edge);
  return layout;
}
