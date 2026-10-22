import type { TipAction, TipAnchorTarget, TipDismissReason, TipOptions } from './types';
import type { TipStore } from './store';

export interface TourStep<P = unknown> extends Omit<TipOptions<P>, 'id' | 'stepLabel'> {
  anchor: TipAnchorTarget;
}

export interface TourLabels {
  next: string;
  back: string;
  done: string;
  skip: string;
}

export interface TourFinish {
  /** `true` when the user reached the end with Done. */
  completed: boolean;
  /** The step that was showing. */
  index: number;
  /** Why the last tip closed, when the user left the tour. */
  reason?: TipDismissReason;
}

export interface TourOptions
  extends Omit<TipOptions, 'id' | 'stepLabel' | 'actions' | 'onShow' | 'onHide' | 'onPress' | 'render' | 'props'> {
  /** Prefix for the step tip ids. Default: `tour-<n>`. */
  id?: string;
  labels?: Partial<TourLabels>;
  /** Default: `true`. */
  showBack?: boolean;
  /** Default: `false`. */
  showSkip?: boolean;
  /** Default: `true`. */
  showStepLabel?: boolean;
  /** Default: `"2 of 5"`. */
  formatStepLabel?: (index: number, count: number) => string;
  /** Default: `0`. */
  startAt?: number;
  onStepChange?: (index: number) => void;
  onFinish?: (result: TourFinish) => void;
}

export interface TourController {
  readonly id: string;
  /** Index of the current step, or `-1` before the first step. */
  readonly index: number;
  readonly active: boolean;
  next(): void;
  previous(): void;
  goTo(index: number): void;
  /** End the tour early. */
  stop(): void;
}

const DEFAULT_LABELS: TourLabels = { next: 'Next', back: 'Back', done: 'Done', skip: 'Skip' };

let nextTourId = 1;

/**
 * Show tips one after another. Each step is a regular tip with the id
 * `<tour id>:<index>`, a spotlight on its anchor, and navigation actions.
 * Closing a step any other way (close button, backdrop) ends the tour.
 */
export function startTour(store: TipStore, steps: TourStep<any>[], options: TourOptions = {}): TourController {
  const {
    id = `tour-${nextTourId++}`,
    labels: labelOverrides,
    showBack = true,
    showSkip = false,
    showStepLabel = true,
    formatStepLabel = (index: number, count: number) => `${index + 1} of ${count}`,
    startAt = 0,
    onStepChange,
    onFinish,
    ...shared
  } = options;
  const labels: TourLabels = { ...DEFAULT_LABELS, ...labelOverrides };
  const stepId = (index: number) => `${id}:${index}`;

  let index = -1;
  let active = steps.length > 0;

  const finish = (completed: boolean, reason?: TipDismissReason) => {
    if (!active) return;
    active = false;
    const last = index;
    store.dismiss(stepId(last), completed ? 'action' : reason);
    if (onFinish) onFinish({ completed, index: last, reason });
  };

  const show = (target: number) => {
    const { anchor, actions: stepActions, onHide, ...stepOptions } = steps[target];
    const isLast = target === steps.length - 1;
    const navigation: TipAction[] = [];
    if (showSkip && !isLast) {
      navigation.push({ id: 'tour-skip', label: labels.skip, style: 'cancel', dismissOnPress: false, onPress: () => finish(false, 'action') });
    }
    if (showBack && target > 0) {
      navigation.push({ id: 'tour-back', label: labels.back, style: 'cancel', dismissOnPress: false, onPress: () => goTo(target - 1) });
    }
    navigation.push({
      id: isLast ? 'tour-done' : 'tour-next',
      label: isLast ? labels.done : labels.next,
      style: 'primary',
      dismissOnPress: false,
      onPress: () => (isLast ? finish(true) : goTo(target + 1)),
    });

    store.show(anchor, {
      spotlight: true,
      dismissOnOutsidePress: false,
      dismissOnBackdropPress: false,
      ...shared,
      ...stepOptions,
      id: stepId(target),
      stepLabel: showStepLabel ? formatStepLabel(target, steps.length) : undefined,
      actions: [...(stepActions ?? []), ...navigation],
      onHide: (handle, reason) => {
        if (onHide) onHide(handle, reason);
        // Steps the tour moved away from close on their own.
        if (active && index === target) finish(false, reason);
      },
    });
  };

  const goTo = (target: number) => {
    if (!active || target < 0 || target >= steps.length || target === index) return;
    const previous = index;
    index = target;
    if (previous >= 0) store.dismiss(stepId(previous), 'action');
    show(target);
    if (onStepChange) onStepChange(target);
  };

  const controller: TourController = {
    id,
    get index() {
      return index;
    },
    get active() {
      return active;
    },
    next: () => (index === steps.length - 1 ? finish(true) : goTo(index + 1)),
    previous: () => goTo(index - 1),
    goTo,
    stop: () => finish(false, 'dismissed'),
  };

  if (active) goTo(Math.min(Math.max(0, startAt), steps.length - 1));
  return controller;
}
