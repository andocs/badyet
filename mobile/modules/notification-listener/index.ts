import { requireNativeModule } from 'expo-modules-core';

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
  addListener(
    event: 'onNotification',
    cb: (n: CapturedNotification) => void,
  ): { remove(): void };
};

const native = requireNativeModule<Native>('NotificationListener');

export const isAccessGranted = () => native.isAccessGranted();
export const openAccessSettings = () => native.openAccessSettings();
export const onNotification = (cb: (n: CapturedNotification) => void) =>
  native.addListener('onNotification', cb);
