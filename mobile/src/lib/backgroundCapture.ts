import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AppRegistry } from 'react-native';
import { requestCapture, type RunSource } from './captureEngine';
import { diag } from './diag';
import './diagApp';
import { flushQueue } from './expense';
import { outbox } from './outboxStore';
import { supabase } from './supabase';

// Capture while the app is closed. Both entry points are defined at module top level, because Android starts the JS
// with no screens and this file is loaded from the app entry (index.js) before anything renders.

const TASK = 'badyet-capture';

/** The background task must always end, so Android does not keep the app in a half-awake state: give the work this long, then let go. */
const CLOSED_RUN_LIMIT_MS = 45_000;

async function runClosed(source: RunSource): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  diag('bg-start', { src: source });
  try {
    await Promise.race([
      runClosedWork(source),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CLOSED_RUN_LIMIT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    diag('bg-end', { src: source });
  }
}

async function runClosedWork(source: RunSource): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return; // signed out: the listener queue stays put until you sign in
    // A run started by a notification (or the boot receiver) checks Gmail right away; the 15 minute task keeps the normal pause.
    await requestCapture({ forceGmail: source === 'notification', source, send: () => flushQueue(outbox, supabase).then(() => undefined) });
  } catch {
    // Never throw out of a background run; the queue is untouched and the next run retries.
  }
}

TaskManager.defineTask(TASK, async () => {
  await runClosed('background');
  return BackgroundTask.BackgroundTaskResult.Success;
});

// Started by the native listener service when a notification arrives and the app has no JS running.
AppRegistry.registerHeadlessTask('CaptureHeadless', () => async () => {
  await runClosed('notification');
});

/** Asks Android to run capture about every 15 minutes (its minimum). Safe to call on every launch. */
export async function registerBackgroundCapture(): Promise<void> {
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
  } catch {
    // Not available (for example in a preview build without the native part): capture still runs when the app opens.
  }
}
