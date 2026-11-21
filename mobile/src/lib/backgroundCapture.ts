import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AppRegistry } from 'react-native';
import { requestCapture, type RunSource } from './captureEngine';
import { flushQueue } from './expense';
import { outbox } from './outboxStore';
import { supabase } from './supabase';

// Capture while the app is closed. Both entry points are defined at module top level, because Android starts the JS
// with no screens and this file is loaded from the app entry (index.js) before anything renders.

const TASK = 'badyet-capture';

async function runClosed(source: RunSource): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return; // signed out: the listener queue stays put until you sign in
    await requestCapture({ forceGmail: false, source, send: () => flushQueue(outbox, supabase).then(() => undefined) });
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
