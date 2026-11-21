import { Redirect } from 'expo-router';

// The OAuth redirect lands here when Android opens the app via badyet://auth/callback.
// The session itself is created in lib/signin.ts; this route only avoids a not-found screen.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
