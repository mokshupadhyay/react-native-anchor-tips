import { computePlacement, type PlacementInput } from '../core/geometry';

const base: Omit<PlacementInput, 'anchor'> = {
  bubble: { width: 200, height: 80 },
  viewport: { width: 400, height: 800 },
  insets: { top: 40, bottom: 30, left: 0, right: 0 },
  placement: 'auto',
  align: 'center',
  offset: 4,
  arrowSize: 8,
  margin: 12,
  borderRadius: 14,
};

const anchor = (x: number, y: number, width = 40, height = 40) => ({ x, y, width, height });

describe('computePlacement', () => {
  it('places the tip below and centered on the anchor when there is room', () => {
    const result = computePlacement({ ...base, anchor: anchor(180, 100) });
    expect(result.placement).toBe('bottom');
    expect(result.y).toBe(100 + 40 + 4 + 8);
    expect(result.x).toBe(200 - 100);
    expect(result.arrowOffset).toBe(100);
  });

  it('flips above when the anchor is near the bottom', () => {
    const result = computePlacement({ ...base, anchor: anchor(180, 700) });
    expect(result.placement).toBe('top');
    expect(result.y).toBe(700 - 4 - 8 - 80);
  });

  it('honors a preferred side and falls back to its opposite', () => {
    expect(computePlacement({ ...base, anchor: anchor(180, 400), placement: 'top' }).placement).toBe('top');
    expect(computePlacement({ ...base, anchor: anchor(180, 60), placement: 'top' }).placement).toBe('bottom');
  });

  it('keeps the bubble inside the margins and points the arrow at the anchor', () => {
    const result = computePlacement({ ...base, anchor: anchor(4, 100, 24, 24) });
    expect(result.x).toBe(12);
    // Anchor center is x = 16, 4 px into the bubble; the arrow stops clear of the corner.
    expect(result.arrowOffset).toBe(14 + 8);
  });

  it('aligns to the start or end of the anchor', () => {
    const wide = anchor(100, 100, 260, 40);
    expect(computePlacement({ ...base, anchor: wide, align: 'start' }).x).toBe(100);
    expect(computePlacement({ ...base, anchor: wide, align: 'end' }).x).toBe(160);
  });

  it('uses the sides when neither above nor below fits', () => {
    const result = computePlacement({
      ...base,
      bubble: { width: 120, height: 300 },
      viewport: { width: 400, height: 400 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
      anchor: anchor(20, 180),
    });
    expect(result.placement).toBe('right');
    expect(result.x).toBe(20 + 40 + 4 + 8);
    expect(result.arrowOffset).toBe(200 - result.y);
  });

  it('falls back to the larger vertical side and clamps when nothing fits', () => {
    const result = computePlacement({
      ...base,
      bubble: { width: 380, height: 500 },
      viewport: { width: 400, height: 600 },
      anchor: anchor(180, 400),
    });
    expect(result.placement).toBe('top');
    expect(result.y).toBe(40 + 12);
  });

  it('leaves no gap for a hidden arrow', () => {
    expect(computePlacement({ ...base, arrowSize: 0, anchor: anchor(180, 100) }).y).toBe(100 + 40 + 4);
  });
});
