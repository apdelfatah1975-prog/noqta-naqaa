import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/filterUi";
import { getDeviceNotificationPermission, requestDeviceNotificationPermission, showDeviceReminderNotification } from "@/lib/deviceNotifications";
import { trpc } from "@/lib/trpc";
import { BellRing, CheckCircle2, Clock3, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function NotificationSettingsCard() {
  const { data: settings, isLoading } = trpc.filters.notifications.settings.useQuery();
  const { data: nextAlert } = trpc.filters.notifications.nextAlert.useQuery();
  const [time, setTime] = useState("09:00");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const utils = trpc.useUtils();
  const saveSettings = trpc.filters.notifications.saveSettings.useMutation({
    onSuccess: () => { utils.filters.notifications.settings.invalidate(); utils.filters.notifications.nextAlert.invalidate(); toast.success("تم حفظ وقت التنبيه"); },
    onError: error => toast.error(error.message || "تعذر حفظ إعدادات التنبيه."),
  });
  const enableScheduledAlerts = trpc.filters.notifications.enableScheduledAlerts.useMutation({
    onSuccess: () => { utils.filters.notifications.settings.invalidate(); toast.success("تم تفعيل التنبيه التلقائي للمواعيد القادمة"); },
    onError: error => toast.error(error.message || "تعذر تفعيل التنبيهات التلقائية."),
  });

  useEffect(() => {
    if (settings) setTime(`${String(settings.alertHour).padStart(2, "0")}:${String(settings.alertMinute).padStart(2, "0")}`);
  }, [settings]);
  useEffect(() => {
    setPermission(getDeviceNotificationPermission());
  }, []);
  function payload() {
    const [hour, minute] = time.split(":").map(Number);
    return { leadDays: 1, alertHour: Number.isFinite(hour) ? hour : 9, alertMinute: Number.isFinite(minute) ? minute : 0, timezoneOffsetMinutes: -new Date().getTimezoneOffset() };
  }
  function save() { saveSettings.mutate(payload()); }
  async function enable() {
    const nextPermission = await requestDeviceNotificationPermission();
    setPermission(nextPermission);
    if (nextPermission === "unsupported") { toast.error("الإشعارات غير مدعومة في هذا المتصفح."); return; }
    if (nextPermission !== "granted") { toast.error("يلزم السماح بالإشعارات ليظهر التنبيه على الجهاز."); return; }
    enableScheduledAlerts.mutate(payload());
  }

  return <section className="soft-card overflow-hidden">
    <div className="flex flex-col gap-4 border-b border-teal-950/6 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-700"><BellRing className="h-5 w-5" /></div><div><h2 className="font-extrabold">التنبيه التلقائي</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">ينبّهك قبل موعد المتابعة بيوم واحد، ويُظهر التذكير داخل التطبيق دائمًا.</p></div></div>
      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${permission === "granted" ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"}`}>{permission === "granted" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}{permission === "granted" ? "إشعارات الجهاز مفعلة" : permission === "unsupported" ? "غير مدعوم في المتصفح" : "إذن الإشعارات مطلوب"}</span>
    </div>
    <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between"><div className="space-y-2"><label className="block max-w-xs"><span className="field-label"><Clock3 className="ml-1 inline h-4 w-4" />وقت التنبيه</span><input type="time" className="field-input" value={time} onChange={event => setTime(event.target.value)} disabled={isLoading} /></label><p className="rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold leading-5 text-teal-900">{nextAlert ? `وقت الإشعار القادم: ${formatDateTime(nextAlert.alertDate)} للعميل ${nextAlert.customer?.name || "—"}` : `سيصل التنبيه قبل الموعد بيوم عند الساعة ${time} عند وجود موعد متابعة قادم.`}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={save} disabled={saveSettings.isPending || isLoading} className="rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50">{saveSettings.isPending ? "جارٍ الحفظ…" : "حفظ الوقت"}</Button><Button onClick={enable} disabled={enableScheduledAlerts.isPending || isLoading} className="rounded-xl bg-teal-700 hover:bg-teal-800">{enableScheduledAlerts.isPending ? "جارٍ التفعيل…" : "تفعيل تنبيه الجهاز"}</Button></div></div>
  </section>;
}
