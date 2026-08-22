const pendingWorkOrderStatuses = new Set(["assigned", "en_route", "arrived", "in_progress"]);

export function countPendingReminders(reminders: Array<unknown> | null | undefined): number {
  return reminders?.length ?? 0;
}

export function countPendingWorkOrders(orders: Array<{ status: string }> | null | undefined): number {
  if (!Array.isArray(orders)) return 0;
  return orders.filter(order => pendingWorkOrderStatuses.has(order.status)).length;
}
