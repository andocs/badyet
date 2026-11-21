import { setAllowedPackages } from '@modules/notification-listener';
import { allowedPackages } from '@/lib/capture/sources';

/** Tells the Android listener which apps to queue notifications from. Changing it needs no new build. */
export function applyAllowlist(configs: Parameters<typeof allowedPackages>[0]) {
  setAllowedPackages(allowedPackages(configs));
}
