import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

type NotificationRecord = {
  id: string;
  recipient_id: string;
  notification_type: string;
  title: string;
  body: string | null;
};

type WebhookPayload = {
  type: "INSERT";
  table: string;
  schema: string;
  record: NotificationRecord;
  old_record: null;
};

const PUSH_TYPES = new Set([
  "new_message",
  "connection_request",
  "connection_accepted",
  "mentorship_request",
  "mentorship_accepted",
  "mentorship_declined",
  "mentorship_paused",
  "mentorship_resumed",
  "mentorship_completion_requested",
  "mentorship_completed",
  "mentorship_change_proposed",
]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const suppliedSecret = req.headers.get("x-push-webhook-secret");

  if (
    !expectedSecret ||
    !suppliedSecret ||
    suppliedSecret !== expectedSecret
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const notification = payload.record;

  if (
    payload.type !== "INSERT" ||
    payload.schema !== "public" ||
    payload.table !== "notifications"
  ) {
    return new Response("Ignored", { status: 200 });
  }

  if (!PUSH_TYPES.has(notification.notification_type)) {
    return new Response("Push type ignored", { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !vapidPublicKey ||
    !vapidPrivateKey
  ) {
    console.error("Push function is missing required environment variables.");

    return new Response("Push service not configured", {
      status: 500,
    });
  }

  webpush.setVapidDetails(
    "mailto:admin@fieldsconnect.app",
    vapidPublicKey,
    vapidPrivateKey
  );

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data: subscriptions, error } =
    await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", notification.recipient_id);

  if (error) {
    console.error("Unable to load push subscriptions:", error);

    return new Response("Subscription lookup failed", {
      status: 500,
    });
  }

  if (!subscriptions?.length) {
    return new Response("No registered devices", {
      status: 200,
    });
  }

  const message = JSON.stringify({
    title: notification.title || "FieldsConnect",
    body: notification.body || "You have a new notification.",
    url: "/notifications",
  });

  let sent = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        message
      );

      sent += 1;
    } catch (pushError: unknown) {
      const statusCode =
        typeof pushError === "object" &&
        pushError !== null &&
        "statusCode" in pushError
          ? Number(
              (
                pushError as {
                  statusCode?: unknown;
                }
              ).statusCode
            )
          : null;

      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("id", subscription.id);

        continue;
      }

      console.error("Push delivery failed:", pushError);
    }
  }

  return Response.json({
    delivered: sent,
    attempted: subscriptions.length,
  });
});
