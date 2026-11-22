import { requireNativeModule } from 'expo-modules-core';

/** One captured notification, exactly as Android posted it. Parsed on the phone, then discarded. */
export type CapturedNotification = {
  package: string;
  title: string | null;
  text: string | null;
  bigText: string | null;
  postTime: number;
};

type Native = {
  isAccessGranted(): boolean;
  openAccessSettings(): void;
  setAllowedPackages(packages: string[]): void;
  drain(): string;
  seenPackages(): string[];
  installedApps?(): { package: string; label: string }[];
  addListener(event: 'onQueued', cb: () => void): { remove(): void };
};

const native = requireNativeModule<Native>('NotificationListener');

export const isAccessGranted = () => native.isAccessGranted();
export const openAccessSettings = () => native.openAccessSettings();
/** Only notifications from these apps are queued. Change it over the air; no rebuild needed. */
export const setAllowedPackages = (packages: string[]) => native.setAllowedPackages(packages);
/** Everything queued since the last drain, then clears the queue. */
export const drainQueue = (): CapturedNotification[] => JSON.parse(native.drain());
/** Names of apps that have posted notifications (no text), to help pick the allowlist. */
export const seenPackages = () => native.seenPackages();
/** Launchable apps on this phone with their names. Empty when the installed build does not have it yet. */
export const installedApps = (): { package: string; label: string }[] => {
  try {
    return native.installedApps?.() ?? [];
  } catch {
    return [];
  }
};
/** Fires when the service queued something while the app is open. Call drainQueue() in response. */
export const onQueued = (cb: () => void) => native.addListener('onQueued', cb);
