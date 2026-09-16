import { AppShell } from "@/components/AppShell";
import { NotificationList } from "@/components/NotificationList";
import { getCurrentUser } from "@/services/userService";
import { getNotifications } from "@/services/notificationService";

export default async function NotificationsPage() {
  const currentUser = await getCurrentUser();
  const notifications = await getNotifications(currentUser.id);

  return (
    <AppShell>
      <div className="mb-4 edkut-card p-4">
        <h1 className="font-heading text-lg font-bold text-edkut-blue">notificações</h1>
        <p className="text-sm text-edkut-muted">Tudo que aconteceu por aqui recentemente.</p>
      </div>

      <NotificationList notifications={notifications} />
    </AppShell>
  );
}
