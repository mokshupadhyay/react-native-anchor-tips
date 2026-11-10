#import "AnchorTipGeometry.h"

static CGFloat AnchorTipClamp(CGFloat value, CGFloat min, CGFloat max)
{
  if (max < min) return min;
  return MIN(MAX(value, min), max);
}

static BOOL AnchorTipIsVertical(AnchorTipSide side)
{
  return side == AnchorTipSideTop || side == AnchorTipSideBottom;
}

static NSArray<NSNumber *> *AnchorTipOrder(NSString *preference)
{
  if ([preference isEqualToString:@"top"]) {
    return @[ @(AnchorTipSideTop), @(AnchorTipSideBottom), @(AnchorTipSideRight), @(AnchorTipSideLeft) ];
  }
  if ([preference isEqualToString:@"right"]) {
    return @[ @(AnchorTipSideRight), @(AnchorTipSideLeft), @(AnchorTipSideBottom), @(AnchorTipSideTop) ];
  }
  if ([preference isEqualToString:@"left"]) {
    return @[ @(AnchorTipSideLeft), @(AnchorTipSideRight), @(AnchorTipSideBottom), @(AnchorTipSideTop) ];
  }
  return @[ @(AnchorTipSideBottom), @(AnchorTipSideTop), @(AnchorTipSideRight), @(AnchorTipSideLeft) ];
}

static CGFloat AnchorTipCrossStart(CGFloat anchorStart, CGFloat anchorLength, CGFloat length, NSString *align)
{
  if ([align isEqualToString:@"start"]) return anchorStart;
  if ([align isEqualToString:@"end"]) return anchorStart + anchorLength - length;
  return anchorStart + anchorLength / 2 - length / 2;
}

AnchorTipPlacement AnchorTipComputePlacement(
    CGRect anchor,
    CGSize bubble,
    CGSize viewport,
    UIEdgeInsets insets,
    NSString *preference,
    NSString *align,
    CGFloat offset,
    CGFloat arrowSize,
    CGFloat margin,
    CGFloat borderRadius)
{
  CGFloat reach = offset + arrowSize;
  CGFloat space[4];
  space[AnchorTipSideTop] = CGRectGetMinY(anchor) - insets.top - margin;
  space[AnchorTipSideBottom] = viewport.height - insets.bottom - margin - CGRectGetMaxY(anchor);
  space[AnchorTipSideLeft] = CGRectGetMinX(anchor) - insets.left - margin;
  space[AnchorTipSideRight] = viewport.width - insets.right - margin - CGRectGetMaxX(anchor);
  CGFloat usableWidth = viewport.width - insets.left - insets.right - 2 * margin;
  CGFloat usableHeight = viewport.height - insets.top - insets.bottom - 2 * margin;

  AnchorTipSide side = space[AnchorTipSideTop] > space[AnchorTipSideBottom] ? AnchorTipSideTop : AnchorTipSideBottom;
  for (NSNumber *candidate in AnchorTipOrder(preference)) {
    AnchorTipSide value = (AnchorTipSide)candidate.integerValue;
    BOOL fits = AnchorTipIsVertical(value)
        ? space[value] >= bubble.height + reach && bubble.width <= usableWidth
        : space[value] >= bubble.width + reach && bubble.height <= usableHeight;
    if (fits) {
      side = value;
      break;
    }
  }

  CGFloat minX = insets.left + margin;
  CGFloat maxX = viewport.width - insets.right - margin - bubble.width;
  CGFloat minY = insets.top + margin;
  CGFloat maxY = viewport.height - insets.bottom - margin - bubble.height;
  CGFloat x;
  CGFloat y;
  if (AnchorTipIsVertical(side)) {
    x = AnchorTipClamp(AnchorTipCrossStart(CGRectGetMinX(anchor), anchor.size.width, bubble.width, align), minX, maxX);
    y = side == AnchorTipSideBottom ? CGRectGetMaxY(anchor) + reach : CGRectGetMinY(anchor) - reach - bubble.height;
    y = AnchorTipClamp(y, minY, maxY);
  } else {
    y = AnchorTipClamp(AnchorTipCrossStart(CGRectGetMinY(anchor), anchor.size.height, bubble.height, align), minY, maxY);
    x = side == AnchorTipSideRight ? CGRectGetMaxX(anchor) + reach : CGRectGetMinX(anchor) - reach - bubble.width;
    x = AnchorTipClamp(x, minX, maxX);
  }

  CGFloat length = AnchorTipIsVertical(side) ? bubble.width : bubble.height;
  CGFloat center = AnchorTipIsVertical(side) ? CGRectGetMidX(anchor) - x : CGRectGetMidY(anchor) - y;
  CGFloat edge = MIN(length / 2, borderRadius + arrowSize);

  AnchorTipPlacement placement;
  placement.side = side;
  placement.x = x;
  placement.y = y;
  placement.arrowOffset = AnchorTipClamp(center, edge, length - edge);
  return placement;
}
