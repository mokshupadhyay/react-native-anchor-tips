import React from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TipAnchor, TipHost, tips, tipStore, type TipRenderProps } from '../index';

beforeEach(() => {
  jest.useFakeTimers();
  tipStore.reset();
  tipStore.anchors.register('compose', {
    measure: (callback) => callback({ rect: { x: 40, y: 120, width: 80, height: 40 }, tag: null }),
  });
});

afterEach(async () => {
  await act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

const run = (operation: () => unknown) =>
  act(() => {
    operation();
  });

/** Tips stay inert until their bubble has a size; lay it out as a device would. */
async function layOut(text: string, size = { width: 180, height: 60 }) {
  let node = screen.getByText(text).parent;
  while (node && node.props.accessibilityRole !== 'alert') node = node.parent;
  if (!node) throw new Error(`No bubble around "${text}"`);
  const bubble = node;
  await act(() => {
    fireEvent(bubble, 'layout', { nativeEvent: { layout: { x: 0, y: 0, ...size } } });
  });
}

const App = () => (
  <TipHost>
    <View testID="screen">
      <Text>Inbox</Text>
    </View>
  </TipHost>
);

describe('<TipHost />', () => {
  it('renders a themed tip next to its anchor', async () => {
    await render(<App />);
    await run(() => tips.show('compose', { title: 'New message', message: 'Start a conversation', icon: '✎' }));
    expect(screen.getByText('New message')).toBeTruthy();
    expect(screen.getByText('Start a conversation')).toBeTruthy();
    expect(screen.getByText('✎')).toBeTruthy();
  });

  it('runs an action and dismisses the tip', async () => {
    await render(<App />);
    const onPress = jest.fn();
    const onHide = jest.fn();
    await run(() => tips.show('compose', { title: 'Hi', actions: [{ label: 'Got it', onPress }], onHide }));
    await layOut('Hi');

    await run(() => fireEvent.press(screen.getByText('Got it')));
    await advance(500);
    expect(onPress).toHaveBeenCalled();
    expect(onHide).toHaveBeenCalledWith(expect.objectContaining({ id: 'compose' }), 'action');
    expect(screen.queryByText('Hi')).toBeNull();
  });

  it('closes with the close button', async () => {
    await render(<App />);
    await run(() => tips.show('compose', { title: 'Hi' }));
    await layOut('Hi');
    await run(() => fireEvent.press(screen.getByLabelText('Dismiss')));
    await advance(500);
    expect(screen.queryByText('Hi')).toBeNull();
  });

  it('dismisses on a touch outside the tip', async () => {
    await render(<App />);
    const onHide = jest.fn();
    await run(() => tips.show('compose', { title: 'Hi', onHide }));
    await run(() => fireEvent(screen.getByTestId('screen'), 'touchStart', { nativeEvent: { pageX: 300, pageY: 700 } }));
    await advance(500);
    expect(onHide).toHaveBeenCalledWith(expect.anything(), 'outside-press');
  });

  it('hides after its duration', async () => {
    await render(<App />);
    await run(() => tips.show('compose', { title: 'Brief', duration: 1000 }));
    expect(screen.getByText('Brief')).toBeTruthy();
    await advance(1000);
    await advance(500);
    expect(screen.queryByText('Brief')).toBeNull();
  });

  it('shows tour steps with a step label and navigation', async () => {
    tipStore.anchors.register('search', {
      measure: (callback) => callback({ rect: { x: 200, y: 300, width: 60, height: 40 }, tag: null }),
    });
    await render(<App />);
    await run(() =>
      tips.tour([
        { anchor: 'compose', title: 'Write' },
        { anchor: 'search', title: 'Find' },
      ]),
    );
    expect(screen.getByText('Write')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    await layOut('Write');

    await run(() => fireEvent.press(screen.getByText('Next')));
    await advance(500);
    expect(screen.queryByText('Write')).toBeNull();
    expect(screen.getByText('Find')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('uses a custom renderer', async () => {
    const Custom = ({ options, dismiss }: TipRenderProps) => (
      <Text onPress={() => dismiss('action')}>Custom: {options.title}</Text>
    );
    await render(
      <TipHost renderer={Custom}>
        <View />
      </TipHost>,
    );
    await run(() => tips.show('compose', { title: 'Hello' }));
    expect(screen.getByText('Custom: Hello')).toBeTruthy();
  });
});

describe('<TipAnchor />', () => {
  it('registers its id while mounted', async () => {
    const view = await render(
      <TipAnchor id="profile">
        <Text>Profile</Text>
      </TipAnchor>,
    );
    expect(tipStore.anchors.has('profile')).toBe(true);
    await view.unmount();
    expect(tipStore.anchors.has('profile')).toBe(false);
  });
});
