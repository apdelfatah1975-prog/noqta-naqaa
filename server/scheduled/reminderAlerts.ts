import type { Request, Response } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { customers, notificationSettings, reminders } from "../../drizzle/schema";
import { isAlertReady } from "../../shared/filterBusiness";
import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import { sdk } from "../_core/sdk";

export async function reminderAlertsHandler(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    taskUid = user.taskUid;
    if (!user.isCron || !taskUid) return res.status(403).json({ error: "cron-only" });

    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة.");
    const settings = (await db.select().from(notificationSettings).where(eq(notificationSettings.scheduleCronTaskUid, taskUid)).limit(1))[0];
    if (!settings) return res.json({ ok: true, skipped: "orphan" });

    const pending = await db.select().from(reminders).where(and(
      eq(reminders.ownerId, settings.ownerId),
      eq(reminders.status, "pending"),
      isNull(reminders.alertedAt),
    ));
    const ready = pending.filter(reminder => isAlertReady(reminder.reminderDate, settings));
    if (!ready.length) return res.json({ ok: true, sent: 0 });

    const customerIds = Array.from(new Set(ready.map(reminder => reminder.customerId)));
    const customerRows = await db.select().from(customers).where(and(eq(customers.ownerId, settings.ownerId), inArray(customers.id, customerIds)));
    const customerById = new Map(customerRows.map(customer => [customer.id, customer]));
    const names = ready.slice(0, 3).map(reminder => customerById.get(reminder.customerId)?.name ?? "عميل").join("، ");
    const accepted = await notifyOwner({
      title: `لديك ${ready.length} تذكير متابعة`,
      content: `تنبيه متابعة فلاتر المياه: ${names}${ready.length > 3 ? " وغيرهم" : ""}.`,
    });
    if (!accepted) throw new Error("تعذر إرسال إشعار المواعيد.");
    await db.update(reminders).set({ alertedAt: new Date() }).where(inArray(reminders.id, ready.map(reminder => reminder.id)));
    return res.json({ ok: true, sent: ready.length });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      context: { url: req.originalUrl, taskUid: taskUid ?? null },
      timestamp: new Date().toISOString(),
    });
  }
}
