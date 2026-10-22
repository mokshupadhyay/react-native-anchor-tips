import type {
  EdgeInsets,
  Rect,
  Size,
  TipAlignment,
  TipPlacement,
  TipPlacementPreference,
} from './types';

export interface PlacementInput {
  /** Anchor frame in the same coordinate space as the viewport. */
  anchor: Rect;
  /** Size of the bubble body, without the arrow. */
  bubble: Size;
  viewport: Size;
  insets: EdgeInsets;
  placement: TipPlacementPreference;
  align: TipAlignment;
  /** Gap between the anchor and the tip of the arrow. */
  offset: number;
  /** `0` when the arrow is hidden. */
  arrowSize: number;
  /** Minimum distance from the safe edges. */
  margin: number;
  borderRadius: number;
}

export interface PlacementResult {
  placement: TipPlacement;
  /** Top-left corner of the bubble body. */
  x: number;
  y: number;
  /**
   * Center of the arrow along the edge facing the anchor, measured from the
   * bubble's left edge (top and bottom placements) or top edge (left and right).
   */
  arrowOffset: number;
}

const ORDER: Record<TipPlacementPreference, TipPlacement[]> = {
  auto: ['bottom', 'top', 'right', 'left'],
  bottom: ['bottom', 'top', 'right', 'left'],
  top: ['top', 'bottom', 'right', 'left'],
  right: ['right', 'left', 'bottom', 'top'],
  left: ['left', 'right', 'bottom', 'top'],
};

const clamp = (value: number, min: number, max: number) =>
  max < min ? min : Math.min(Math.max(value, min), max);

const isVertical = (placement: TipPlacement) => placement === 'top' || placement === 'bottom';

/** Room between the anchor and each safe edge, after the margin. */
function availableSpace(input: PlacementInput): Record<TipPlacement, number> {
  const { anchor, viewport, insets, margin } = input;
  return {
    top: anchor.y - insets.top - margin,
    bottom: viewport.height - insets.bottom - margin - (anchor.y + anchor.height),
    left: anchor.x - insets.left - margin,
    right: viewport.width - insets.right - margin - (anchor.x + anchor.width),
  };
}

function fits(input: PlacementInput, placement: TipPlacement, space: Record<TipPlacement, number>): boolean {
  const { bubble, viewport, insets, margin, offset, arrowSize } = input;
  const reach = offset + arrowSize;
  if (isVertical(placement)) {
    const width = viewport.width - insets.left - insets.right - 2 * margin;
    return space[placement] >= bubble.height + reach && bubble.width <= width;
  }
  const height = viewport.height - insets.top - insets.bottom - 2 * margin;
  return space[placement] >= bubble.width + reach && bubble.height <= height;
}

/** Pick the side for a tip. Nothing fits: the larger of above and below. */
export function choosePlacement(input: PlacementInput): TipPlacement {
  const space = availableSpace(input);
  for (const placement of ORDER[input.placement]) {
    if (fits(input, placement, space)) return placement;
  }
  return space.top > space.bottom ? 'top' : 'bottom';
}

function crossStart(anchorStart: number, anchorLength: number, length: number, align: TipAlignment): number {
  if (align === 'start') return anchorStart;
  if (align === 'end') return anchorStart + anchorLength - length;
  return anchorStart + anchorLength / 2 - length / 2;
}

/**
 * Position a bubble next to its anchor and keep it inside the safe area.
 * The native overlays port this function line by line.
 */
export function computePlacement(input: PlacementInput): PlacementResult {
  const { anchor, bubble, viewport, insets, align, offset, arrowSize, margin, borderRadius } = input;
  const placement = choosePlacement(input);
  const reach = offset + arrowSize;
  const minX = insets.left + margin;
  const maxX = viewport.width - insets.right - margin - bubble.width;
  const minY = insets.top + margin;
  const maxY = viewport.height - insets.bottom - margin - bubble.height;

  let x: number;
  let y: number;
  if (isVertical(placement)) {
    x = clamp(crossStart(anchor.x, anchor.width, bubble.width, align), minX, maxX);
    y = placement === 'bottom' ? anchor.y + anchor.height + reach : anchor.y - reach - bubble.height;
    y = clamp(y, minY, maxY);
  } else {
    y = clamp(crossStart(anchor.y, anchor.height, bubble.height, align), minY, maxY);
    x = placement === 'right' ? anchor.x + anchor.width + reach : anchor.x - reach - bubble.width;
    x = clamp(x, minX, maxX);
  }

  const length = isVertical(placement) ? bubble.width : bubble.height;
  const center = isVertical(placement) ? anchor.x + anchor.width / 2 - x : anchor.y + anchor.height / 2 - y;
  const edge = Math.min(length / 2, borderRadius + arrowSize);
  return { placement, x, y, arrowOffset: clamp(center, edge, length - edge) };
}

/** The spotlight cutout around an anchor. */
export function spotlightRect(anchor: Rect, padding: number): Rect {
  return {
    x: anchor.x - padding,
    y: anchor.y - padding,
    width: anchor.width + 2 * padding,
    height: anchor.height + 2 * padding,
  };
}

export function containsPoint(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
