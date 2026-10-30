import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

const pendingRestores = new Map<string, Promise<boolean>>();

function preferenceKey(userId: string) {
  return `fieldsconnect:device-push-opt-in:v1:${userId}`;
}

function subscriptionKey(userId: string) {
  return `fieldsconnect:device-push-key:v1:${userId}`;
}

export function setDevicePushOptIn(
  userId: string,
  enabled: boolean,
  publicKey?: string
) {
  window.localStorage.setItem(
    preferenceKey(userId),
    enabled ? "true" : "false"
  );

  if (enabled && publicKey) {
    window.localStorage.setItem(subscriptionKey(userId), publicKey);
  } else if (!enabled) {
    window.localStorage.removeItem(subscriptionKey(userId));
  }
}

export async function waitForDevicePushRestore(userId: string) {
  try {
    await pendingRestores.get(userId);
  } catch {
    // Logout must still attempt to remove the server subscription.
  }
}

export function restoreDevicePushForSignedInUser(
  userId: string
): Promise<boolean> {
  const existing = pendingRestores.get(userId);
  if (existing) return existing;

  const work = (async () => {
    if (
      typeof window === "undefined" ||
      !isSupabaseConfigured() ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return false;
    }

    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id !== userId) return false;

    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return false;

    const saved = window.localStorage.getItem(preferenceKey(userId));
    if (saved === "false") return false;

    if (
      saved === "true" &&
      window.localStorage.getItem(subscriptionKey(userId)) !==
        subscription.toJSON().keys?.p256dh
    ) {
      return false;
    }

    if (saved !== "true") {
      // Adopt only a legacy subscription already owned by this account.
      const { data: owned, error } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("endpoint", subscription.endpoint)
        .maybeSingle();

      if (error) throw error;
      if (!owned) return false;

      setDevicePushOptIn(userId, true, subscription.toJSON().keys?.p256dh);
    }

    const keys = subscription.toJSON().keys;
    if (!keys?.p256dh || !keys?.auth) return false;

    const { data: { user: confirmedUser } } =
      await supabase.auth.getUser();

    if (
      confirmedUser?.id !== userId ||
      window.localStorage.getItem(preferenceKey(userId)) !== "true"
    ) {
      return false;
    }

    const { error } = await supabase.rpc(
      "register_push_subscription",
      {
        subscription_endpoint: subscription.endpoint,
        subscription_p256dh: keys.p256dh,
        subscription_auth: keys.auth,
        subscription_user_agent: navigator.userAgent,
      }
    );

    if (error) throw error;
    return true;
  })();

  const tracked = work.finally(() => {
    pendingRestores.delete(userId);
  });

  pendingRestores.set(userId, tracked);
  return tracked;
}
