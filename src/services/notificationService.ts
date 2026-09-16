import { AppNotification } from "@/types";
import { getNotificationsForUser } from "@/mocks/notifications";
import { simulateDelay } from "./simulateDelay";

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  return simulateDelay(getNotificationsForUser(userId));
}

export async function markAllAsRead(userId: string): Promise<{ userId: string }> {
  return simulateDelay({ userId }, 100);
}
