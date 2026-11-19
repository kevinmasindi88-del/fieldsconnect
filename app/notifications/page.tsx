import { DevicePushNotifications } from "@/components/notifications/DevicePushNotifications";
import { NotificationsWorkflow } from "@/components/notifications/NotificationsWorkflow";

export default function NotificationsPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-4xl px-3 pt-4 sm:px-8 sm:pt-8">
        <DevicePushNotifications />
      </div>

      <NotificationsWorkflow />
    </>
  );
}
