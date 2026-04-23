import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "./supabase";

// Required for web browser auth sessions on some platforms
WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = "google" | "apple";

/**
 * Open a Supabase OAuth flow for the given provider via an in-app browser.
 * Returns { error: null } on success (including user cancellation) and
 * { error: string } when something goes wrong before/after the browser.
 *
 * On success the Supabase client fires onAuthStateChange automatically —
 * no extra navigation is needed; auth-context handles routing.
 */
export async function signInWithProvider(
  provider: SocialProvider,
): Promise<{ error: string | null }> {
  const redirectTo = makeRedirectUri({ scheme: "truthstay", path: "auth/callback" });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true, // we open the browser ourselves below
    },
  });

  if (error || !data.url) {
    return { error: error?.message ?? "Could not start sign-in. Please try again." };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "success") {
    // Supabase returns access/refresh tokens in the URL hash fragment
    const fragment = result.url.split("#")[1] ?? result.url.split("?")[1] ?? "";
    const params = new URLSearchParams(fragment);
    const access_token  = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (sessionErr) return { error: sessionErr.message };
    }
    return { error: null };
  }

  // "cancel" or "dismiss" means the user closed the browser — not an error
  return { error: null };
}