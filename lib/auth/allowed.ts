// Single-user app: only the address in ALLOWED_EMAIL may log in.
// Fails closed: if ALLOWED_EMAIL is unset or empty, nobody is allowed.
export function isAllowedEmail(email: string | null | undefined, allowed: string | null | undefined): boolean {
  const a = (allowed ?? "").trim().toLowerCase();
  const e = (email ?? "").trim().toLowerCase();
  return a.length > 0 && e.length > 0 && a === e;
}
