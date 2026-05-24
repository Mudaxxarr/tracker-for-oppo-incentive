import { listAllOwnerAlerts, countAllUnreadAlerts } from "@/lib/db/queries/alerts";
import { AlertsClient } from "./alerts-client";

export default async function AlertsPage() {
  const [alerts, unreadCount] = await Promise.all([
    listAllOwnerAlerts(),
    countAllUnreadAlerts(),
  ]);

  return <AlertsClient alerts={alerts} unreadCount={unreadCount} />;
}
