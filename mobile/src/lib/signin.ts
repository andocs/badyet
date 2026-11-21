import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { parseAuthUrl } from './authUrl';
import { supabase } from './supabase';

export const redirectTo = makeRedirectUri({ scheme: 'badyet', path: 'auth/callback' });

export async function createSessionFromUrl(url: string) {
  const p = parseAuthUrl(url);
  if (p.error_description || p.error) throw new Error(p.error_description ?? p.error);
  if (p.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(p.code);
    if (error) throw error;
  } else if (p.access_token && p.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: p.access_token,
      refresh_token: p.refresh_token,
    });
    if (error) throw error;
  }
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type === 'success') await createSessionFromUrl(res.url);
}
