import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Native overlay renderer. Each config is a plain object produced by
 * `serializeNativeTip`; colors are already processed with `processColor`.
 *
 * Events are delivered through `AnchorTipsEvent` on the device event emitter.
 */
export interface Spec extends TurboModule {
  show(id: string, config: Object): void;
  update(id: string, config: Object): void;
  dismiss(id: string): void;
  dismissAll(): void;

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.get<Spec>('AnchorTips');
