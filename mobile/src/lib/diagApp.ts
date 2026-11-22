import { AppState } from 'react-native';
import { diag, flushDiag } from './diag';

let started = false;
/** Notes the start of this run and every move between the screen and the background. Safe to call more than once. */
export function startDiag() {
  if (started) return;
  started = true;
  diag('boot', { app: AppState.currentState ?? null });
  AppState.addEventListener('change', (state) => {
    diag('app', { state });
    if (state !== 'active') flushDiag();
  });
}

// Runs as soon as the app's JavaScript starts, including when a notification starts it with no screen.
startDiag();
