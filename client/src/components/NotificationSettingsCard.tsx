import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/filterUi";
import { getDeviceNotificationPermission, isNotificationVibrationEnabled, isReminderSoundEnabled, playReminderTone, requestDeviceNotificationPermission, setNotificationVibrationEnabled, setReminderSoundEnabled, vibrateNotification } from "@/lib/deviceNotifications";
import { trpc } from "@/lib/trpc";
import { BellRing, CheckCircle2, Clock3, Settings2, Volume2, VolumeX } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

export function NotificationSettingsCard() {
  const { data: settings, isLoading } = trpc.filters.notifications.settings.useQuery();
  const { data: nextAlert } = trpc.filters.notifications.nextAlert.useQuery();
  const [time, setTime] = useState("09:00");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [soundEnabled, setSoundEnabled] = useState(() => isReminderSoundEnabled());
  const [vibrationEnabled, setVibrationEnabled] = useState(() => isNotificationVibrationEnabled());
  const [settingsPin, setSettingsPin] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWhatsAppPhone, setCompanyWhatsAppPhone] = useState("");
  const utils = trpc.useUtils();
  const saveSettings = trpc.filters.notifications.saveSettings.useMutation({
    onSuccess: () => { utils.filters.notifications.settings.invalidate(); utils.filters.notifications.nextAlert.invalidate(); toast.success("تم حفظ إعدادات واتساب والتنبيه"); },
    onError: error => toast.error(error.message || "تعذر حفظ إعدادات التنبيه."),
  });
  const enableScheduledAlerts = trpc.filters.notifications.enableScheduledAlerts.useMutation({
    onSuccess: () => { utils.filters.notifications.settings.invalidate(); toast.success("تم تفعيل التنبيه التلقائي للمواعيد القادمة"); },
    onError: error => toast.error(error.message || "تعذر تفعيل التنبيهات التلقائية."),
  });

  useEffect(() => {
    if (settings) {
      setTime(`${String(settings.alertHour).padStart(2, "0")}:${String(settings.alertMinute).padStart(2, "0")}`);
      setCompanyName(settings.companyName ?? "");
      setCompanyWhatsAppPhone(settings.companyWhatsAppPhone ?? "");
    }
  }, [settings]);
  useEffect(() => {
    setPermission(getDeviceNotificationPermission());
  }, []);
  function payload() {
    const [hour, minute] = time.split(":").map(Number);
    return { leadDays: 1, alertHour: Number.isFinite(hour) ? hour : 9, alertMinute: Number.isFinite(minute) ? minute : 0, timezoneOffsetMinutes: -new Date().getTimezoneOffset(), companyName: companyName.trim() || null, companyWhatsAppPhone: companyWhatsAppPhone.trim() || null };
  }
  function save() { saveSettings.mutate({ ...payload(), pin: settingsPin.trim() || undefined }); }
  function toggleSound() {
    const nextValue = !soundEnabled;
    setSoundEnabled(nextValue);
    setReminderSoundEnabled(nextValue);
    toast.success(nextValue ? "تم تفعيل الصوت مع تنبيه الموعد" : "تم إيقاف صوت تنبيه الموعد");
  }
  function toggleVibration() {
    const nextValue = !vibrationEnabled;
    setVibrationEnabled(nextValue);
    setNotificationVibrationEnabled(nextValue);
    toast.success(nextValue ? "تم تفعيل اهتزاز التنبيه" : "تم إيقاف اهتزاز التنبيه");
  }
  function testVibration() {
    if (!vibrationEnabled) {
      toast.error("فعّل اهتزاز التنبيه أولًا.");
      return;
    }
    toast(vibrateNotification() ? "تم اختبار الاهتزاز" : "الاهتزاز غير مدعوم أو محجوب في هذا الجهاز.");
  }
  function testSound() {
    if (!soundEnabled) {
      toast.error("فعّل صوت التنبيه أولًا.");
      return;
    }
    toast(playReminderTone() ? "تم تشغيل نغمة التنبيه" : "اضغط على الصفحة أولًا للسماح بتشغيل الصوت من المتصفح.");
  }
  async function enable() {
    const nextPermission = await requestDeviceNotificationPermission();
    setPermission(nextPermission);
    if (nextPermission === "unsupported") { toast.error("الإشعارات غير مدعومة في هذا المتصفح."); return; }
    if (nextPermission !== "granted") { toast.error("يلزم السماح بالإشعارات ليظهر التنبيه على الجهاز."); return; }
    enableScheduledAlerts.mutate({ ...payload(), pin: settingsPin.trim() || undefined });
  }

  return <section className="soft-card overflow-hidden">
    <div className="flex flex-col gap-4 border-b border-teal-950/6 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-700"><BellRing className="h-5 w-5" /></div><div><h2 className="font-extrabold">التنبيه التلقائي</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">يبدأ قبل الموعد بيوم، ويظل ظاهرًا حتى تسجيل الزيارة أو إتمام المتابعة، مع تنبيه يومي متجدد للمواعيد المعلقة.</p></div></div>
      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${permission === "granted" ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"}`}>{permission === "granted" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}{permission === "granted" ? "إشعارات الجهاز مفعلة" : permission === "unsupported" ? "غير مدعوم في المتصفح" : "إذن الإشعارات مطلوب"}</span>
    </div>
    <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between"><div className="space-y-2"><label className="block max-w-xs"><span className="field-label"><Clock3 className="ml-1 inline h-4 w-4" />وقت التنبيه</span><input type="time" className="field-input" value={time} onChange={event => setTime(event.target.value)} disabled={isLoading} /></label><p className="rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold leading-5 text-teal-900">{nextAlert ? `وقت الإشعار القادم: ${formatDateTime(nextAlert.alertDate)} للعميل ${nextAlert.customer?.name || "—"}` : `سيصل التنبيه قبل الموعد بيوم عند الساعة ${time} عند وجود موعد متابعة قادم.`}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={testSound} className="rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50">تجربة الصوت</Button><Button variant="outline" onClick={toggleVibration} className="rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50">{vibrationEnabled ? "اهتزاز التنبيه مفعل" : "تفعيل اهتزاز التنبيه"}</Button><Button variant="outline" onClick={testVibration} className="rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50">تجربة الاهتزاز</Button><Button variant="outline" onClick={toggleSound} className="rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50">{soundEnabled ? <Volume2 className="ml-1 h-4 w-4" /> : <VolumeX className="ml-1 h-4 w-4" />}{soundEnabled ? "صوت التنبيه مفعل" : "تفعيل صوت التنبيه"}</Button><Button variant="outline" onClick={save} disabled={saveSettings.isPending || isLoading} className="rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50" data-testid="save-whatsapp-settings">{saveSettings.isPending ? "جارٍ الحفظ…" : "حفظ إعدادات واتساب والتنبيه"}</Button><Button onClick={enable} disabled={enableScheduledAlerts.isPending || isLoading} className="rounded-xl bg-teal-700 hover:bg-teal-800">{enableScheduledAlerts.isPending ? "جارٍ التفعيل…" : "تفعيل تنبيه الجهاز"}</Button></div><p className="text-xs leading-5 text-muted-foreground">قد يمنع المتصفح التشغيل التلقائي؛ اضغط «تجربة الصوت» أو «تجربة الاهتزاز» مرة واحدة للسماح بالتنبيهات.</p>    </div>
    <div className="border-t border-teal-950/6 bg-slate-50/70 p-5"><label className="mb-4 block max-w-sm"><span className="field-label">اسم الشركة</span><input type="text" className="field-input" value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder="مثال: نقطة نقاء لفلاتر المياه" autoComplete="organization" disabled={isLoading || saveSettings.isPending} /><span className="mt-1 block text-xs leading-5 text-muted-foreground">يظهر الاسم في ملفات PDF ورسائل واتساب ويمكن تغييره في أي وقت.</span></label><label className="mb-4 block max-w-sm"><span className="field-label">رقم واتساب الشركة</span><input type="tel" dir="ltr" className="field-input text-left" value={companyWhatsAppPhone} onChange={event => setCompanyWhatsAppPhone(event.target.value)} placeholder="مثال: 201001234567" autoComplete="tel" disabled={isLoading || saveSettings.isPending} /><span className="mt-1 block text-xs leading-5 text-muted-foreground">يُحفظ مركزيًا ويظل قابلًا للتعديل في أي وقت، وتستخدمه رسائل واتساب في النسخة المجانية والمدفوعة وأوامر الشغل.</span></label><label className="block max-w-sm"><span className="field-label">رقم سري لتعديل وقت التنبيه عند الحاجة</span><input type="password" className="field-input" value={settingsPin} onChange={event => setSettingsPin(event.target.value)} placeholder="يُطلب فقط إذا كان الرقم السري مضبوطًا" autoComplete="current-password" /></label></div>
  </section>;
}
