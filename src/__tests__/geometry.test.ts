import { computePlacement, type PlacementInput } from '../core/geometry';

const base: Omit<PlacementInput, 'anchor'> = {
  bubble: { width: 200, height: 80 },
  viewport: { width: 400, height: 800 },
  insets: { top: 50, bottom: 34, left: 0, right: 0 },
  placement: 'auto',
  align: 'center',
  offset: 4,
  arrowSize: 8,
  margin: 12,
  borderRadius: 14,
};

const input = (overrides: Partial<PlacementInput> & Pick<PlacementInput, 'anchor'>): PlacementInput => ({
  ...base,
  ...overrides,
});

describe('computePlacement', () => {
  it('places the tip below a centered anchor with the arrow on the anchor center', () => {
    const result = computePlacement(input({ anchor: { x: 150, y: 200, width: 100, height: 40 } }));
    expect(result.placement).toBe('bottom');
    expect(result.x).toBe(100);
    expect(result.y).toBe(200 + 40 + 4 + 8);
    expect(result.arrowOffset).toBe(100);
  });

  it('flips above when there is no room below', () => {
    const result = computePlacement(input({ anchor: { x: 150, y: 700, width: 100, height: 40 } }));
    expect(result.placement).toBe('top');
    expect(result.y).toBe(700 - 4 - 8 - 80);
  });

  it('honors a preferred side when it fits', () => {
    expect(computePlacement(input({ anchor: { x: 150, y: 400, width: 100, height: 40 }, placement: 'top' })).placement).toBe(
      'top',
    );
    const right = computePlacement(
      input({ anchor: { x: 20, y: 400, width: 60, height: 40 }, placement: 'right', bubble: { width: 150, height: 60 } }),
    );
    expect(right.placement).toBe('right');
    expect(right.x).toBe(20 + 60 + 12);
    expect(right.arrowOffset).toBe(30);
  });

  it('keeps the bubble inside the margins and the arrow on the anchor near an edge', () => {
    const result = computePlacement(input({ anchor: { x: 300, y: 200, width: 30, height: 30 } }));
    expect(result.x).toBe(400 - 12 - 200);
    // The anchor center (315) sits 127px into the bubble.
    expect(result.arrowOffset).toBe(127);

    // The arrow stays clear of the rounded corner.
    const corner = computePlacement(input({ anchor: { x: 392, y: 200, width: 8, height: 30 } }));
    expect(corner.arrowOffset).toBe(200 - (14 + 8));
  });

  it('aligns to the start or end of the anchor', () => {
    const anchor = { x: 100, y: 200, width: 120, height: 40 };
    expect(computePlacement(input({ anchor, align: 'start' })).x).toBe(100);
    expect(computePlacement(input({ anchor, align: 'end' })).x).toBe(220 - 200);
  });

  it('falls back to the larger vertical side when nothing fits', () => {
    const result = computePlacement(
      input({ anchor: { x: 0, y: 300, width: 400, height: 200 }, bubble: { width: 200, height: 400 } }),
    );
    expect(result.placement).toBe('bottom');
    expect(result.y).toBe(800 - 34 - 12 - 400);
  });
});
