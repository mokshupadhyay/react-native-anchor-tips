import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TipHost, tips, tipStore, type TipRenderProps } from '../index';

const anchorFrame = { x: 100, y: 200, width: 60, height: 40 };

function registerAnchor(id: string, frame = anchorFrame) {
  return tipStore.anchors.register(id, { measure: (callback) => callback({ rect: frame, tag: null }) });
}

beforeEach(() => {
  jest.useFakeTimers();
  tipStore.reset();
});

afterEach(async () => {
  await act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

const run = (operation: () => unknown) =>
  act(() => {
    operation();
  });

/** Tips wait invisible until their bubble lays out; do what a device would. */
async function layOut(text: string, size = { width: 180, height: 60 }) {
  let node = screen.getByText(text).parent;
  while (node && node.props.accessibilityRole !== 'alert') node = node.parent;
  if (!node) throw new Error(`No bubble around "${text}"`);
  const bubble = node;
  await act(() => {
    fireEvent(bubble, 'layout', { nativeEvent: { layout: { x: 0, y: 0, ...size } } });
  });
  return bubble;
}

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

describe('<TipHost />', () => {
  it('renders a tip next to its anchor and closes it with the close button', async () => {
    await render(
      <TipHost>
        <Text>App</Text>
      </TipHost>,
    );
    registerAnchor('compose');
    const onHide = jest.fn();
    await run(() => tips.show('compose', { title: 'New message', message: 'Start here', icon: '✎', onHide }));

    expect(screen.getByText('New message')).toBeTruthy();
    expect(screen.getByText('Start here')).toBeTruthy();
    expect(screen.getByText('✎')).toBeTruthy();

    await layOut('New message');
    await run(() => fireEvent.press(screen.getByLabelText('Dismiss')));
    await advance(500);
    expect(screen.queryByText('New message')).toBeNull();
    expect(onHide).toHaveBeenCalledWith(expect.objectContaining({ id: 'compose' }), 'close-button');
  });

  it('positions the bubble with the shared placement algorithm', async () => {
    await render(<TipHost insets={{ top: 0, bottom: 0, left: 0, right: 0 }} />);
    registerAnchor('a');
    await run(() => tips.show('a', { title: 'Hello', showCloseButton: false }));

    const bubble = await layOut('Hello');
    const positioner = bubble.parent;
    const style = StyleSheet.flatten(positioner?.props.style) as { left?: number; top?: number };
    expect(style.left).toBe(100 + 30 - 90);
    expect(style.top).toBe(200 + 40 + 4 + 8);
  });

  it('runs actions and dismisses on press', async () => {
    await render(<TipHost />);
    registerAnchor('a');
    const onPress = jest.fn();
    await run(() => tips.show('a', { title: 'Filters', actions: [{ label: 'Got it', style: 'primary', onPress }] }));
    await layOut('Filters');
    await run(() => fireEvent.press(screen.getByText('Got it')));
    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    await advance(500);
    expect(screen.queryByText('Filters')).toBeNull();
  });

  it('dismisses on a touch outside the tip and lets the touch through', async () => {
    await render(
      <TipHost>
        <Text>App</Text>
      </TipHost>,
    );
    registerAnchor('a');
    await run(() => tips.show('a', { title: 'Outside' }));
    await run(() => fireEvent(screen.getByText('App'), 'touchStart', { nativeEvent: { pageX: 5, pageY: 5 } }));
    await advance(500);
    expect(screen.queryByText('Outside')).toBeNull();
  });

  it('keeps tips waiting until their anchor mounts', async () => {
    await render(<TipHost />);
    await run(() => tips.show('later', { title: 'Waiting' }));
    expect(screen.queryByText('Waiting')).toBeNull();
    await run(() => registerAnchor('later'));
    expect(screen.getByText('Waiting')).toBeTruthy();
  });

  it('renders a host-wide renderer, and a per-tip render over it', async () => {
    function Custom({ options }: TipRenderProps) {
      return <Text>{`Custom ${options.title}`}</Text>;
    }
    await render(<TipHost renderer={Custom} />);
    registerAnchor('one');
    await run(() => tips.show('one', { title: 'tip' }));
    expect(screen.getByText('Custom tip')).toBeTruthy();

    await run(() => tips.update('one', { render: ({ options }) => <Text>{`Own ${options.title}`}</Text> }));
    expect(screen.getByText('Own tip')).toBeTruthy();
  });

  it('shows the built-in tour footer', async () => {
    await render(<TipHost />);
    registerAnchor('one');
    registerAnchor('two');
    const onFinish = jest.fn();
    await run(() => tips.tour([{ anchor: 'one', title: 'First' }, { anchor: 'two', title: 'Second' }], { onFinish }));
    expect(screen.getByText('1 of 2')).toBeTruthy();

    await layOut('First');
    await run(() => fireEvent.press(screen.getByText('Next')));
    await advance(500);
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();

    await layOut('Second');
    await run(() => fireEvent.press(screen.getByText('Done')));
    await advance(500);
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ completed: true, index: 1 }));
    expect(screen.queryByText('Second')).toBeNull();
  });
});
