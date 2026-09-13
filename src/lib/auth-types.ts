export type OAuthProvider = "google" | "github";
export interface AccountUser {
  id: string;
  name: string;
  email: string;
  bio: string;
  createdAt: string;
}
export interface AccountState {
  user: AccountUser | null;
  providers: OAuthProvider[];
}
/** Only return to a relative application URL, never a provider-supplied external URL. */
export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value))
    return "/";
  return value.startsWith("/api/") || value.startsWith("/login") ? "/" : value;
}
