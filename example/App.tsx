import React from 'react';
import { Platform, Pressable, ScrollView, Settings, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TipAnchor, TipHost, tips, type TipOptions, type TourStep } from 'react-native-anchor-tips';

/**
 * Screenshot scripts, selected with a launch argument:
 * - iOS: `xcrun simctl launch booted org.reactjs.native.example.AnchorTipsExample -demo gallery`
 * - Android: `adb shell am start -n com.anchortipsexample/.MainActivity --es demo gallery`
 *
 * On Android the value arrives as the root `demo` prop, which App copies here
 * before the first render.
 */
let DEMO = Platform.OS === 'ios' ? (Settings.get('demo') as string | undefined) : undefined;

const runtime = globalThis as { RN$Bridgeless?: boolean; __turboModuleProxy?: unknown };
const ARCHITECTURE =
  runtime.RN$Bridgeless === true || runtime.__turboModuleProxy != null ? 'New Architecture' : 'Legacy bridge';

const composeTip: TipOptions = {
  icon: '✎',
  title: 'Start a conversation',
  message: 'Tap here to write a new message to anyone in your team.',
  actions: [{ label: 'Got it', style: 'primary' }],
};

const tourSteps: TourStep[] = [
  { anchor: 'search', title: 'Search everything', message: 'Find messages, people and files.' },
  { anchor: 'compose', title: 'Write a message', message: 'Start a new conversation from here.' },
  { anchor: 'profile', title: 'Your profile', message: 'Status, notifications and settings live here.' },
];

function useDemoScript() {
  React.useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const later = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));
    if (DEMO === 'gallery') {
      later(1200, () => tips.show('compose', composeTip));
      later(1300, () =>
        tips.show('star', {
          variant: 'filled',
          icon: '★',
          title: 'Pin what matters',
          message: 'Starred threads stay on top.',
          placement: 'left',
          showCloseButton: false,
        }),
      );
      later(1400, () =>
        tips.show('profile', { variant: 'inverted', title: 'Your profile', placement: 'top', showCloseButton: false }),
      );
    } else if (DEMO === 'tour') {
      later(1200, () => tips.tour(tourSteps, { startAt: 1, showSkip: true }));
    } else if (DEMO === 'native') {
      later(1200, () => tips.show('compose', { ...composeTip, presentation: 'native' }));
      later(1300, () =>
        tips.show('profile', {
          presentation: 'native',
          variant: 'inverted',
          title: Platform.OS === 'ios' ? 'Drawn by UIKit' : 'Drawn by Android views',
          placement: 'top',
          showCloseButton: false,
        }),
      );
    } else if (DEMO === 'native-tour') {
      later(1200, () => tips.tour(tourSteps, { presentation: 'native' }));
    }
    return () => timers.forEach(clearTimeout);
  }, []);
}

const threads = [
  { from: 'Priya', text: 'Design review moved to 3 pm' },
  { from: 'Marco', text: 'Shipped the new onboarding flow' },
  { from: 'Lena', text: 'Can you check the release notes?' },
];

function Demo() {
  const insets = useSafeAreaInsets();
  useDemoScript();

  const demos: Array<[string, () => void]> = [
    ['Tip with an action', () => tips.show('compose', composeTip)],
    ['Inverted tooltip', () => tips.show('search', { variant: 'inverted', title: 'Search', showCloseButton: false, duration: 2500 })],
    ['Filled tip on the left', () => tips.show('star', { variant: 'filled', icon: '★', title: 'Pin what matters', placement: 'left' })],
    ['Spotlight', () => tips.show('profile', { spotlight: true, title: 'Your profile', message: 'Tap outside to close.' })],
    ['Guided tour', () => tips.tour(tourSteps, { showSkip: true })],
    ['Show once', () => tips.show('search', { id: 'search-once', title: 'Shown only once', maxDisplayCount: 1 })],
    ['Native tip', () => tips.show('compose', { ...composeTip, presentation: 'native' })],
    ['Native tour', () => tips.tour(tourSteps, { presentation: 'native' })],
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>Inbox</Text>
          <Text style={styles.subheading}>{`React Native ${Platform.constants.reactNativeVersion.major}.${Platform.constants.reactNativeVersion.minor} · ${ARCHITECTURE}`}</Text>
        </View>
        <TipAnchor id="search" style={styles.iconButton}>
          <Text style={styles.iconGlyph}>⌕</Text>
        </TipAnchor>
        <TipAnchor id="compose" style={[styles.iconButton, styles.primaryButton]}>
          <Text style={[styles.iconGlyph, styles.primaryGlyph]}>✎</Text>
        </TipAnchor>
      </View>

      <ScrollView contentContainerStyle={styles.list} onScroll={() => tips.reposition()} scrollEventThrottle={32}>
        {threads.map((thread, index) => (
          <View key={thread.from} style={styles.thread}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{thread.from[0]}</Text>
            </View>
            <View style={styles.threadText}>
              <Text style={styles.threadFrom}>{thread.from}</Text>
              <Text style={styles.threadBody}>{thread.text}</Text>
            </View>
            {index === threads.length - 1 ? (
              <TipAnchor id="star">
                <Text style={styles.star}>☆</Text>
              </TipAnchor>
            ) : null}
          </View>
        ))}
        <Text style={styles.section}>Try it</Text>
        {demos.map(([label, run]) => (
          <Pressable key={label} onPress={run} style={styles.button}>
            <Text style={styles.buttonText}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={[styles.tab, styles.tabActive]}>Inbox</Text>
        <Text style={styles.tab}>Activity</Text>
        <TipAnchor id="profile" style={styles.profileTab}>
          <View style={styles.profileDot}>
            <Text style={styles.profileInitial}>M</Text>
          </View>
        </TipAnchor>
      </View>
    </View>
  );
}

export default function App({ demo }: { demo?: string }) {
  if (DEMO === undefined && demo) DEMO = demo;
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <Host />
    </SafeAreaProvider>
  );
}

function Host() {
  const insets = useSafeAreaInsets();
  return (
    <TipHost insets={insets} maxVisible={DEMO === 'gallery' || DEMO === 'native' ? 3 : 1}>
      <Demo />
    </TipHost>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  headerText: { flex: 1 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111827' },
  subheading: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  primaryButton: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  iconGlyph: { fontSize: 20, color: '#111827' },
  primaryGlyph: { color: '#FFFFFF' },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  thread: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#4338CA', fontWeight: '700', fontSize: 16 },
  threadText: { flex: 1 },
  threadFrom: { fontSize: 15, fontWeight: '600', color: '#111827' },
  threadBody: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  star: { fontSize: 22, color: '#D97706', paddingHorizontal: 4 },
  section: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginTop: 12, marginBottom: 8, textTransform: 'uppercase' },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  buttonText: { fontSize: 15, color: '#111827', fontWeight: '500' },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  tab: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  tabActive: { color: '#2563EB', fontWeight: '700' },
  profileTab: { padding: 2 },
  profileDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { color: '#FFFFFF', fontWeight: '700' },
});
