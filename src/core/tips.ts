import type { TipAnchorTarget, TipConfig, TipDismissReason, TipOptions, TipUpdate } from './types';
import { TipStore } from './store';
import { startTour, type TourController, type TourOptions, type TourStep } from './tour';
import { createNativePresenter } from '../native/presenter';

/** The shared store behind the `tips` API, every `<TipHost />` and every `<TipAnchor />`. */
export const tipStore = new TipStore(createNativePresenter());

/**
 * Show tips anchored to views.
 *
 * ```ts
 * tips.show('compose', { title: 'New message', message: 'Start a conversation here.' });
 * tips.show(buttonRef, { title: 'Filters', placement: 'top', presentation: 'native' });
 * tips.tour([
 *   { anchor: 'search', title: 'Search' },
 *   { anchor: 'profile', title: 'Your profile' },
 * ]);
 * ```
 */
export const tips = {
  /** Show a tip next to an anchor id or a ref, and return the tip id. */
  show<P = unknown>(anchor: TipAnchorTarget, options?: TipOptions<P>): string {
    return tipStore.show<P>(anchor, options);
  },

  /** Merge new options into a visible or pending tip. */
  update<P = unknown>(id: string, options: TipUpdate<P>): void {
    tipStore.update<P>(id, options);
  },

  /** Dismiss one tip, or every tip when no id is given. */
  dismiss(id?: string, reason?: TipDismissReason): void {
    tipStore.dismiss(id, reason);
  },

  dismissAll(): void {
    tipStore.dismiss();
  },

  isActive(id: string): boolean {
    return tipStore.isActive(id);
  },

  /** Measure anchors again after something moved them, such as scrolling. */
  reposition(anchorId?: string): void {
    tipStore.reposition(anchorId);
  },

  /** Walk through several anchors with Next, Back and Done. */
  tour(steps: TourStep<any>[], options?: TourOptions): TourController {
    return startTour(tipStore, steps, options);
  },

  /** Never show this tip id again, for example once the user used the feature. */
  invalidate(id: string): void {
    tipStore.invalidate(id);
  },

  /** How many times a tip with `maxDisplayCount` has been shown. */
  displayCount(id: string): number {
    return tipStore.history.displayCount(id);
  },

  /** Forget display counts and invalidations, for one tip or all of them. */
  resetHistory(id?: string): void {
    tipStore.resetHistory(id);
  },

  /** Global configuration, merged under every `<TipHost />`'s props. */
  configure(config: TipConfig): void {
    tipStore.configure(config);
  },
};

export type TipsApi = typeof tips;
