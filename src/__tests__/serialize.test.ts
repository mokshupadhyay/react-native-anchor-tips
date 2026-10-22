import { serializeNativeTip } from '../native/serialize';
import type { TipOptions, TipRecord } from '../core/types';

function record(options: TipOptions): TipRecord {
  return {
    id: 'a',
    key: '1',
    anchor: 'a',
    options,
    presentation: 'native',
    phase: 'visible',
    anchorRect: { x: 10, y: 20, width: 30, height: 40 },
    anchorTag: 12,
    createdAt: 0,
    revision: 0,
  };
}

describe('serializeNativeTip', () => {
  it('produces plain values with processed colors from the resolved theme', () => {
    const config = serializeNativeTip(
      record({ title: 'Filters', message: 'Narrow results', icon: '★', actions: [{ label: 'Got it', style: 'primary' }] }),
      { theme: { colors: { accent: '#ff0000' } } },
      'light',
    );

    expect(config).toMatchObject({
      title: 'Filters',
      message: 'Narrow results',
      icon: '★',
      placement: 'auto',
      align: 'center',
      showArrow: true,
      showCloseButton: true,
      duration: 0,
      dismissOnOutsidePress: true,
      spotlight: false,
      animation: 'scale',
      accessibilityLabel: 'Filters. Narrow results',
      anchor: { x: 10, y: 20, width: 30, height: 40 },
      anchorTag: 12,
      actions: [{ id: '0', label: 'Got it', style: 'primary', dismissOnPress: true }],
    });
    const style = config.style as Record<string, unknown>;
    expect(typeof style.backgroundColor).toBe('number');
    expect(style.primaryBackgroundColor).toBe(style.iconColor);
    expect(style.arrowSize).toBe(8);
    expect(JSON.parse(JSON.stringify(config))).toEqual(config);
  });

  it('applies variants and the dark scheme', () => {
    const style = (options: TipOptions, scheme: 'light' | 'dark' = 'light') =>
      serializeNativeTip(record(options), {}, scheme).style as Record<string, unknown>;
    expect(style({ variant: 'filled' }).backgroundColor).toBe(style({}).primaryBackgroundColor);
    expect(style({ variant: 'inverted' }).backgroundColor).not.toBe(style({}).backgroundColor);
    expect(style({}, 'dark').backgroundColor).not.toBe(style({}).backgroundColor);
  });

  it('never dismisses spotlight tips on outside touches and drops React-only content', () => {
    const config = serializeNativeTip(
      record({ spotlight: true, icon: null, showArrow: false, theme: { layout: { arrowSize: 12 } } }),
      {},
      'light',
    );
    expect(config).toMatchObject({ spotlight: true, dismissOnOutsidePress: false, icon: null, showArrow: false });
  });
});
