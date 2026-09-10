"use client";

import { useEffect, useState } from "react";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type PushState =
  | "checking"
  | "unsupported"
  | "disabled"
  | "enabled"
  | "blocked";

function urlBase64ToUint8Array(base64String: string) {
  const padding =
    "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    Array.from(rawData).map(
      (character) => character.charCodeAt(0)
    )
  );
}

export function DevicePushNotifications() {
  const [pushState, setPushState] =
    useState<PushState>("checking");

  const [message, setMessage] =
    useState<string | null>(null);

  const [isWorking, setIsWorking] =
    useState(false);

  const vapidPublicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;

    async function checkPushStatus() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) {
          setPushState("unsupported");
        }
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) {
          setPushState("blocked");
        }
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.register(
            "/sw.js"
          );

        const subscription =
          await registration.pushManager.getSubscription();

        if (
          subscription &&
          isSupabaseConfigured()
        ) {
          const subscriptionJson =
            subscription.toJSON();

          const p256dh =
            subscriptionJson.keys?.p256dh;

          const auth =
            subscriptionJson.keys?.auth;

          if (!p256dh || !auth) {
            throw new Error(
              "The existing push subscription is incomplete."
            );
          }

          const supabase =
            getSupabaseBrowserClient();

          const { error } = await supabase.rpc(
            "register_push_subscription",
            {
              subscription_endpoint:
                subscription.endpoint,
              subscription_p256dh: p256dh,
              subscription_auth: auth,
              subscription_user_agent:
                navigator.userAgent,
            }
          );

          if (error) throw error;
        }

        if (!cancelled) {
          setPushState(
            subscription ? "enabled" : "disabled"
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPushState("disabled");
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to check device notification status."
          );
        }
      }
    }

    void checkPushStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enablePushNotifications() {
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (!vapidPublicKey) {
      setMessage(
        "Device notifications are not configured yet."
      );
      return;
    }

    setIsWorking(true);

    try {
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setPushState(
          permission === "denied"
            ? "blocked"
            : "disabled"
        );

        setMessage(
          permission === "denied"
            ? "Notifications are blocked in your browser settings."
            : "Notification permission was not granted."
        );
        return;
      }

      const registration =
        await navigator.serviceWorker.register(
          "/sw.js"
        );

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(
                vapidPublicKey
              ),
          });
      }

      const subscriptionJson =
        subscription.toJSON();

      const p256dh =
        subscriptionJson.keys?.p256dh;

      const auth =
        subscriptionJson.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error(
          "The browser did not provide valid push subscription keys."
        );
      }

      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "register_push_subscription",
        {
          subscription_endpoint:
            subscription.endpoint,
          subscription_p256dh: p256dh,
          subscription_auth: auth,
          subscription_user_agent:
            navigator.userAgent,
        }
      );

      if (error) throw error;

      setPushState("enabled");
      setMessage(
        "Device notifications are enabled."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to enable device notifications."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function disablePushNotifications() {
    setMessage(null);
    setIsWorking(true);

    try {
      const registration =
        await navigator.serviceWorker.getRegistration();

      const subscription =
        registration
          ? await registration.pushManager.getSubscription()
          : null;

      if (!subscription) {
        setPushState("disabled");
        return;
      }

      const endpoint = subscription.endpoint;

      if (isSupabaseConfigured()) {
        const supabase =
          getSupabaseBrowserClient();

        const { error } = await supabase.rpc(
          "unregister_push_subscription",
          {
            subscription_endpoint: endpoint,
          }
        );

        if (error) throw error;
      }

      await subscription.unsubscribe();

      setPushState("disabled");
      setMessage(
        "Device notifications are disabled."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to disable device notifications."
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (pushState === "checking") {
    return null;
  }

  if (pushState === "unsupported") {
    return (
      <div className="rounded-xl border p-4">
        <p className="text-sm font-semibold">
          Device notifications
        </p>
        <p className="mt-1 text-sm text-gray-600">
          This browser does not support web push
          notifications.
        </p>
      </div>
    );
  }

  if (pushState === "blocked") {
    return (
      <div className="rounded-xl border p-4">
        <p className="text-sm font-semibold">
          Device notifications
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Notifications are blocked. Enable them in
          your browser or device settings, then return
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">
            Device notifications
          </p>

          <p className="mt-1 text-sm text-gray-600">
            {pushState === "enabled"
              ? "FieldsConnect can notify this device when important activity happens."
              : "Get FieldsConnect alerts on this device even when you are not viewing the site."}
          </p>
        </div>

        {pushState === "enabled" ? (
          <button
            className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={isWorking}
            onClick={disablePushNotifications}
            type="button"
          >
            {isWorking
              ? "Disabling..."
              : "Disable"}
          </button>
        ) : (
          <button
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isWorking}
            onClick={enablePushNotifications}
            type="button"
          >
            {isWorking
              ? "Enabling..."
              : "Enable device notifications"}
          </button>
        )}
      </div>

      {message && (
        <p className="mt-3 text-sm text-gray-700">
          {message}
        </p>
      )}
    </div>
  );
}
