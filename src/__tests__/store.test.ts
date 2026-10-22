import { AnchorRegistry, type AnchorHandle } from '../core/anchors';
import { HISTORY_KEY } from '../core/history';
import { type NativePresenter, type NativeTipEvent, TipStore } from '../core/store';
import { startTour } from '../core/tour';
import type { Rect, TipRecord, TipStorage } from '../core/types';

const rect: Rect = { x: 10, y: 20, width: 100, height: 40 };

function fixedAnchor(frame: Rect = rect, tag: number | null = 7): AnchorHandle {
  return { measure: (callback) => callback({ rect: frame, tag }) };
}

function setup(presenter: NativePresenter | null = null) {
  const anchors = new AnchorRegistry();
  const store = new TipStore(presenter, anchors);
  return { store, anchors };
}

const phaseOf = (store: TipStore, id: string) => store.getSnapshot().find((record) => record.id === id)?.phase;

describe('TipStore', () => {
  it('waits for an anchor to register, then shows the tip with its frame', () => {
    const { store, anchors } = setup();
    const onShow = jest.fn();
    const id = store.show('compose', { title: 'Write', onShow });
    expect(id).toBe('compose');
    expect(phaseOf(store, 'compose')).toBe('pending');

    anchors.register('compose', fixedAnchor());
    const record = store.getSnapshot()[0];
    expect(record.phase).toBe('visible');
    expect(record.anchorRect).toEqual(rect);
    expect(record.anchorTag).toBe(7);
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  it('updates a visible tip in place when its id is shown again', () => {
    const { store, anchors } = setup();
    anchors.register('a', fixedAnchor());
    store.show('a', { title: 'One' });
    store.show('a', { title: 'Two' });
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0].options.title).toBe('Two');
  });

  it('shows one tip at a time by default and queues the rest', () => {
    const { store, anchors } = setup();
    anchors.register('a', fixedAnchor());
    anchors.register('b', fixedAnchor());
    store.show('a', { title: 'A' });
    store.show('b', { title: 'B' });
    expect(phaseOf(store, 'a')).toBe('visible');
    expect(phaseOf(store, 'b')).toBe('pending');

    // Without a host there is no exit animation to wait for.
    store.dismiss('a');
    expect(phaseOf(store, 'a')).toBeUndefined();
    expect(phaseOf(store, 'b')).toBe('visible');
  });

  it('keeps the exiting tip in its slot until its renderer removes it', () => {
    const { store, anchors } = setup();
    store.registerHost({});
    anchors.register('a', fixedAnchor());
    anchors.register('b', fixedAnchor());
    store.show('a');
    store.show('b');
    store.dismiss('a');
    expect(phaseOf(store, 'a')).toBe('exiting');
    expect(phaseOf(store, 'b')).toBe('pending');
    store.remove(store.getSnapshot()[0].key);
    expect(phaseOf(store, 'b')).toBe('visible');
  });

  it('dismisses a visible tip when its anchor unmounts', () => {
    const { store, anchors } = setup();
    const onHide = jest.fn();
    const unregister = anchors.register('a', fixedAnchor());
    store.show('a', { onHide });
    unregister();
    expect(onHide).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'anchor-removed');
  });

  it('measures ref anchors directly and drops tips whose view is gone', () => {
    const { store } = setup();
    const node = { measureInWindow: (callback: (...args: number[]) => void) => callback(1, 2, 3, 4) };
    const id = store.show({ current: node });
    expect(id).toMatch(/^tip-/);
    expect(store.getSnapshot()[0].anchorRect).toEqual({ x: 1, y: 2, width: 3, height: 4 });

    store.dismiss(id);
    store.show({ current: null });
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it('re-measures anchors on reposition', () => {
    const { store, anchors } = setup();
    let frame = rect;
    anchors.register('a', { measure: (callback) => callback({ rect: frame, tag: null }) });
    store.show('a');
    frame = { ...rect, y: 300 };
    store.reposition('a');
    expect(store.getSnapshot()[0].anchorRect).toEqual(frame);
  });

  it('respects maxDisplayCount and invalidation', () => {
    const { store, anchors } = setup();
    anchors.register('a', fixedAnchor());
    store.show('a', { maxDisplayCount: 2 });
    store.dismiss('a');
    store.show('a', { maxDisplayCount: 2 });
    store.dismiss('a');
    store.show('a', { maxDisplayCount: 2 });
    expect(store.getSnapshot()).toHaveLength(0);
    expect(store.history.displayCount('a')).toBe(2);

    anchors.register('b', fixedAnchor());
    store.invalidate('b');
    store.show('b');
    expect(store.getSnapshot()).toHaveLength(0);

    store.resetHistory();
    store.show('a', { maxDisplayCount: 2 });
    expect(phaseOf(store, 'a')).toBe('visible');
  });

  it('persists display history and waits for async storage', async () => {
    const values: Record<string, string> = { [HISTORY_KEY]: JSON.stringify({ a: { count: 1 } }) };
    const storage: TipStorage = {
      getItem: jest.fn((key: string) => Promise.resolve(values[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        values[key] = value;
        return Promise.resolve();
      }),
    };
    const { store, anchors } = setup();
    anchors.register('a', fixedAnchor());
    store.configure({ storage });
    store.show('a', { maxDisplayCount: 2 });
    expect(phaseOf(store, 'a')).toBe('pending');

    await Promise.resolve();
    await Promise.resolve();
    expect(phaseOf(store, 'a')).toBe('visible');
    expect(JSON.parse(values[HISTORY_KEY])).toEqual({ a: { count: 2 } });

    store.dismiss('a');
    store.show('a', { maxDisplayCount: 2 });
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it('falls back to React rendering when the native module is missing', () => {
    const presenter: NativePresenter = {
      isAvailable: () => false,
      show: jest.fn(),
      update: jest.fn(),
      dismiss: jest.fn(),
      setEventHandler: jest.fn(),
    };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store, anchors } = setup(presenter);
    anchors.register('a', fixedAnchor());
    store.show('a', { presentation: 'native' });
    expect(store.getSnapshot()[0].presentation).toBe('react');
    expect(presenter.show).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('drives native tips through the presenter and its events', () => {
    let emit: (event: NativeTipEvent) => void = () => undefined;
    const shown: TipRecord[] = [];
    const presenter: NativePresenter = {
      isAvailable: () => true,
      show: jest.fn((record: TipRecord) => shown.push(record)),
      update: jest.fn(),
      dismiss: jest.fn(),
      setEventHandler: (handler) => {
        emit = handler;
      },
    };
    const { store, anchors } = setup(presenter);
    const onAction = jest.fn();
    const onHide = jest.fn();
    anchors.register('a', fixedAnchor());
    store.show('a', { presentation: 'native', actions: [{ label: 'Try', onPress: onAction }], onHide });
    expect(shown).toHaveLength(1);
    const key = shown[0].key;

    emit({ key, kind: 'action', actionId: '0' });
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));

    store.reposition();
    emit({ key, kind: 'hide', reason: 'outside-press' });
    expect(onHide).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'outside-press');
    expect(store.getSnapshot()).toHaveLength(0);
  });
});

describe('startTour', () => {
  function tourSetup() {
    const { store, anchors } = setup();
    anchors.register('one', fixedAnchor());
    anchors.register('two', fixedAnchor());
    anchors.register('three', fixedAnchor());
    const steps = [
      { anchor: 'one', title: 'First' },
      { anchor: 'two', title: 'Second' },
      { anchor: 'three', title: 'Third' },
    ];
    return { store, steps };
  }

  const visible = (store: TipStore) => store.getSnapshot().filter((record) => record.phase === 'visible');

  it('walks forward and back with step labels and spotlight', () => {
    const { store, steps } = tourSetup();
    const onFinish = jest.fn();
    const tour = startTour(store, steps, { id: 'intro', onFinish });

    let [current] = visible(store);
    expect(current.id).toBe('intro:0');
    expect(current.options).toMatchObject({ title: 'First', stepLabel: '1 of 3', spotlight: true });
    expect(current.options.actions?.map((action) => action.label)).toEqual(['Next']);

    tour.next();
    [current] = visible(store);
    expect(current.options.actions?.map((action) => action.label)).toEqual(['Back', 'Next']);

    current.options.actions?.[0].onPress?.(store.handle(current.id));
    expect(tour.index).toBe(0);

    tour.goTo(2);
    [current] = visible(store);
    expect(current.options.stepLabel).toBe('3 of 3');
    current.options.actions?.[1].onPress?.(store.handle(current.id));
    expect(onFinish).toHaveBeenCalledWith({ completed: true, index: 2, reason: undefined });
    expect(store.getSnapshot()).toHaveLength(0);
    expect(tour.active).toBe(false);
  });

  it('ends when the user closes a step', () => {
    const { store, steps } = tourSetup();
    const onFinish = jest.fn();
    startTour(store, steps, { onFinish, showSkip: true });
    const [current] = visible(store);
    expect(current.options.actions?.map((action) => action.label)).toEqual(['Skip', 'Next']);
    store.dismiss(current.id, 'close-button');
    expect(onFinish).toHaveBeenCalledWith({ completed: false, index: 0, reason: 'close-button' });
  });
});
