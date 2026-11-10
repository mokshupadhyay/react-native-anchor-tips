import { TipStore, type NativePresenter, type NativeTipEvent } from '../core/store';
import { HISTORY_KEY } from '../core/history';
import { startTour } from '../core/tour';
import type { Rect, TipRecord, TipStorage } from '../core/types';

const RECT: Rect = { x: 10, y: 100, width: 80, height: 40 };

function anchor(store: TipStore, id: string, rect: Rect = RECT) {
  return store.anchors.register(id, { measure: (callback) => callback({ rect, tag: 7 }) });
}

const visible = (store: TipStore) => store.getSnapshot().filter((record) => record.phase === 'visible');

function memoryStorage(initial: Record<string, string> = {}): TipStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('TipStore', () => {
  it('waits for its anchor, then shows with the measured frame', () => {
    const store = new TipStore();
    const id = store.show('compose', { title: 'New message' });
    expect(id).toBe('compose');
    expect(store.getSnapshot()[0].phase).toBe('pending');

    anchor(store, 'compose');
    const [record] = visible(store);
    expect(record.anchorRect).toEqual(RECT);
    expect(record.anchorTag).toBe(7);
  });

  it('updates a visible tip with the same id instead of adding one', () => {
    const store = new TipStore();
    anchor(store, 'a');
    store.show('a', { title: 'One' });
    store.show('a', { title: 'Two' });
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0].options.title).toBe('Two');
  });

  it('shows one tip at a time by default and queues the rest', () => {
    const store = new TipStore();
    anchor(store, 'a');
    anchor(store, 'b');
    store.show('a', { title: 'A' });
    store.show('b', { title: 'B' });
    expect(visible(store).map((record) => record.id)).toEqual(['a']);

    store.dismiss('a');
    expect(visible(store).map((record) => record.id)).toEqual(['b']);
  });

  it('reports why a tip closed', () => {
    const store = new TipStore();
    const onHide = jest.fn();
    const unregister = anchor(store, 'a');
    store.show('a', { onHide });
    unregister();
    expect(onHide).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'anchor-removed');
  });

  it('measures ref anchors and drops them when the view is gone', () => {
    const store = new TipStore();
    const node = { measureInWindow: (callback: (...values: number[]) => void) => callback(5, 6, 7, 8) };
    const id = store.show({ current: node });
    expect(visible(store)[0].anchorRect).toEqual({ x: 5, y: 6, width: 7, height: 8 });

    store.dismiss(id);
    store.show({ current: null });
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it('limits how often a tip is shown and persists the count', () => {
    const storage = memoryStorage();
    const store = new TipStore();
    store.configure({ storage });
    anchor(store, 'a');

    store.show('a', { maxDisplayCount: 1 });
    expect(visible(store)).toHaveLength(1);
    store.dismiss('a');
    store.show('a', { maxDisplayCount: 1 });
    expect(store.getSnapshot()).toHaveLength(0);
    expect(JSON.parse(storage.data[HISTORY_KEY])).toEqual({ a: { count: 1 } });

    const relaunched = new TipStore();
    relaunched.configure({ storage });
    anchor(relaunched, 'a');
    relaunched.show('a', { maxDisplayCount: 1 });
    expect(relaunched.getSnapshot()).toHaveLength(0);

    relaunched.resetHistory('a');
    relaunched.show('a', { maxDisplayCount: 1 });
    expect(visible(relaunched)).toHaveLength(1);
  });

  it('waits for asynchronous storage before deciding', async () => {
    let resolve: (value: string) => void = () => {};
    const storage: TipStorage = {
      getItem: () => new Promise<string>((done) => (resolve = done)),
      setItem: jest.fn(),
    };
    const store = new TipStore();
    store.configure({ storage });
    anchor(store, 'a');
    store.show('a', { maxDisplayCount: 2 });
    expect(store.getSnapshot()[0].phase).toBe('pending');

    resolve(JSON.stringify({ a: { count: 2 } }));
    await Promise.resolve();
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it('never shows an invalidated tip again', () => {
    const store = new TipStore();
    anchor(store, 'a');
    store.show('a');
    store.invalidate('a');
    expect(store.getSnapshot()).toHaveLength(0);
    store.show('a');
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it('drives native tips through the presenter and its events', () => {
    let emit: (event: NativeTipEvent) => void = () => {};
    const shown: TipRecord[] = [];
    const presenter: NativePresenter = {
      isAvailable: () => true,
      show: (record) => shown.push(record),
      update: jest.fn(),
      dismiss: jest.fn(),
      setEventHandler: (handler) => (emit = handler),
    };
    const store = new TipStore(presenter);
    anchor(store, 'a');
    const onAction = jest.fn();
    const onHide = jest.fn();
    store.show('a', { presentation: 'native', actions: [{ id: 'ok', label: 'OK', onPress: onAction }], onHide });
    expect(shown).toHaveLength(1);
    const key = shown[0].key;

    emit({ key, kind: 'action', actionId: 'ok' });
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));

    store.dismiss('a');
    expect(presenter.dismiss).toHaveBeenCalledWith(key);
    expect(store.getSnapshot()[0].phase).toBe('exiting');
    emit({ key, kind: 'hide', reason: 'dismissed' });
    expect(store.getSnapshot()).toHaveLength(0);
    expect(onHide).toHaveBeenCalledWith(expect.anything(), 'dismissed');
  });

  it('falls back to React rendering when the native module is missing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new TipStore(null);
    anchor(store, 'a');
    store.show('a', { presentation: 'native' });
    expect(store.getSnapshot()[0].presentation).toBe('react');
    warn.mockRestore();
  });
});

describe('tours', () => {
  const setup = () => {
    const store = new TipStore();
    anchor(store, 'one');
    anchor(store, 'two');
    anchor(store, 'three');
    return store;
  };
  const press = (store: TipStore, label: string) => {
    const [record] = visible(store);
    const action = (record.options.actions ?? []).find((candidate) => candidate.label === label);
    if (!action || !action.onPress) throw new Error(`No ${label} action`);
    action.onPress(store.handle(record.id));
  };

  it('walks through the steps with Next, Back and Done', () => {
    const store = setup();
    const onFinish = jest.fn();
    const tour = startTour(
      store,
      [
        { anchor: 'one', title: 'First' },
        { anchor: 'two', title: 'Second' },
        { anchor: 'three', title: 'Third' },
      ],
      { id: 'intro', onFinish },
    );

    expect(visible(store)[0]).toMatchObject({ id: 'intro:0', options: { stepLabel: '1 of 3', spotlight: true } });
    expect(visible(store)[0].options.actions!.map((action) => action.label)).toEqual(['Next']);

    press(store, 'Next');
    expect(visible(store)[0].id).toBe('intro:1');
    expect(visible(store)[0].options.actions!.map((action) => action.label)).toEqual(['Back', 'Next']);

    press(store, 'Back');
    expect(tour.index).toBe(0);
    tour.goTo(2);
    expect(visible(store)[0].options.actions!.map((action) => action.label)).toEqual(['Back', 'Done']);

    press(store, 'Done');
    expect(store.getSnapshot()).toHaveLength(0);
    expect(onFinish).toHaveBeenCalledWith({ completed: true, index: 2, reason: undefined });
    expect(tour.active).toBe(false);
  });

  it('ends when a step is closed another way', () => {
    const store = setup();
    const onFinish = jest.fn();
    startTour(store, [{ anchor: 'one' }, { anchor: 'two' }], { onFinish });
    store.dismiss(visible(store)[0].id, 'close-button');
    expect(onFinish).toHaveBeenCalledWith({ completed: false, index: 0, reason: 'close-button' });
    expect(store.getSnapshot()).toHaveLength(0);
  });
});
