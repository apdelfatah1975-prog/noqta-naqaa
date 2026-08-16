import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/filterUi";
import { AppSettings, getAppSettings } from "@/lib/appSettings";
import { BellRing } from "lucide-react";
import { mergeDashboardReminderAlerts } from "@shared/filterBusiness";
import React from "react";
import { useLocation } from "wouter";

export function ReminderAlertBanner() {
  const { data: dueReminders } = trpc.filters.reminders.due.useQuery();
  const { data: upcomingAlerts } = trpc.filters.reminders.alerts.useQuery();
  const [, setLocation] = useLocation();
  const [appSettings, setAppSettings] = React.useState<AppSettings>(() => getAppSettings());
  React.useEffect(() => {
    const onSettingsChange = (event: Event) => setAppSettings((event as CustomEvent<AppSettings>).detail);
    window.addEventListener("purepoint-settings-changed", onSettingsChange);
    return () => window.removeEventListener("purepoint-settings-changed", onSettingsChange);
  }, []);
  const alerts = mergeDashboardReminderAlerts(dueReminders ?? [], upcomingAlerts ?? []);

  if (!appSettings.remindersEnabled || !alerts.length) return null;

  const firstAlert = alerts[0];
  const dueCount = alerts.filter(alert => alert.isDue).length;
  const upcomingCount = alerts.length - dueCount;
  return (
    <section role="status" className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white"><BellRing className="h-5 w-5" /></div>
        <div>
          <p className="font-extrabold">لديك {alerts.length} {alerts.length === 1 ? "تنبيه" : "تنبيهات"} للمتابعة</p>
          <p className="mt-1 text-sm text-amber-800">{dueCount > 0 ? `${dueCount} مستحق الآن` : "لا توجد متابعة مستحقة الآن"}{upcomingCount > 0 ? `، و${upcomingCount} قريب` : ""}. أقربها للعميل {firstAlert.reminder.customer?.name || "—"}، وموعده {formatDateTime(firstAlert.reminder.reminderDate)}.</p>
        </div>
      </div>
      <Button onClick={() => setLocation("/reminders")} className="rounded-xl bg-amber-600 hover:bg-amber-700">عرض التنبيهات</Button>
    </section>
  );
}
