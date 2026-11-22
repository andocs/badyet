import { withLimit } from './http';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/** The Web client id from Google Cloud (a public identifier, not a secret). Without it Gmail cannot be connected. */
export const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

type Lib = typeof import('@react-native-google-signin/google-signin');

let lib: Lib | null | undefined;
let configured = false;

/**
 * Loads the Google sign-in library only when asked. An app version built before the library was added does not contain its
 * native part, and importing it there would crash the whole app; this returns null instead and the screen says so.
 */
function google(): Lib | null {
  if (lib !== undefined) return lib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require('@react-native-google-signin/google-signin') as Lib;
    // Touching the native side fails here, not later, if the build does not have it.
    void lib.GoogleSignin.hasPreviousSignIn();
  } catch {
    lib = null;
  }
  return lib;
}

function ready(): Lib | null {
  const g = google();
  if (g && !configured) {
    g.GoogleSignin.configure({ webClientId, scopes: [GMAIL_SCOPE] });
    configured = true;
  }
  return g;
}

export type GmailSetup = 'no-library' | 'no-client-id' | 'ready';
export function gmailSetup(): GmailSetup {
  if (!google()) return 'no-library';
  return webClientId ? 'ready' : 'no-client-id';
}

export type Connect = { ok: true; email: string } | { error: string };

export async function connectGmail(): Promise<Connect> {
  const g = ready();
  if (!g) return { error: 'This version of the app cannot connect Gmail yet. Install the newest app version.' };
  try {
    await g.GoogleSignin.hasPlayServices();
    const r = await g.GoogleSignin.signIn();
    if (r.type !== 'success') return { error: 'Sign-in was cancelled.' };
    return { ok: true, email: r.data.user.email };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === g.statusCodes.IN_PROGRESS) return { error: 'Sign-in is already open.' };
    if (code === g.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { error: 'Google Play services is not available on this phone.' };
    return { error: e instanceof Error ? e.message : 'Could not sign in to Google.' };
  }
}

/** The connected Google account's email, or null when not connected (or the weekly re-sign-in is due). */
export async function gmailAccount(): Promise<string | null> {
  const g = ready();
  if (!g) return null;
  try {
    const r = await g.GoogleSignin.signInSilently();
    return r.type === 'success' ? r.data.user.email : null;
  } catch {
    return null;
  }
}

/** A fresh Gmail access token, or null when Gmail is not connected. Google refreshes it quietly. */
export async function gmailToken(): Promise<string | null> {
  const g = ready();
  if (!g || !webClientId) return null;
  // Google's silent sign-in is a native call with no limit of its own; run in the background it can wait for ever.
  const got = await withLimit(
    (async () => {
      try {
        const r = await g.GoogleSignin.signInSilently();
        if (r.type !== 'success') return null;
        return (await g.GoogleSignin.getTokens()).accessToken;
      } catch {
        return null;
      }
    })(),
    10_000,
    'gmail-token',
  );
  return got ?? null;
}

/** Forget a rejected token so the next request gets a new one. */
export async function dropGmailToken(token: string): Promise<void> {
  try {
    await ready()?.GoogleSignin.clearCachedAccessToken(token);
  } catch {}
}

export async function disconnectGmail(): Promise<void> {
  try {
    await ready()?.GoogleSignin.signOut();
  } catch {}
}
