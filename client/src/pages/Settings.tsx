import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AppSettings, defaultAppSettings, getAppSettings, resetAppSettings, saveAppSettings } from "@/lib/appSettings";
import { Eye, EyeOff, KeyRound, RotateCcw, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { appendActivityLog, clearActivityLog, getActivityLog, type ActivityLogEntry } from "@/lib/activityLog";

const visitTypes = [
  ["installation", "تركيب فلتر"],
  ["maintenance", "صيانة"],
  ["cartridge_change", "تغيير شمعات"],
  ["follow_up", "متابعة"],
  ["other", "أخرى"],
] as const;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-teal-700" checked={checked} onChange={event => onChange(event.target.checked)} /></label>;
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [technicianNameDraft, setTechnicianNameDraft] = useState("");
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(() => getActivityLog());
  const setPin = trpc.filters.notifications.setPin.useMutation({
    onSuccess: () => { setCurrentPin(""); setNewPin(""); setConfirmPin(""); toast.success("تم تغيير الرقم السري بنجاح"); },
    onError: error => toast.error(error.message || "تعذر تغيير الرقم السري."),
  });

  useEffect(() => {
    const onChange = (event: Event) => setSettings((event as CustomEvent<AppSettings>).detail);
    const onLogChange = () => setActivityLog(getActivityLog());
    window.addEventListener("purepoint-activity-log-changed", onLogChange);
    window.addEventListener("purepoint-settings-changed", onChange);
    return () => { window.removeEventListener("purepoint-settings-changed", onChange); window.removeEventListener("purepoint-activity-log-changed", onLogChange); };
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings(current => ({ ...current, [key]: value }));
  }

  function saveAll() {
    const next = saveAppSettings(settings);
    setSettings(next);
    appendActivityLog("تحديث الإعدادات", "تم حفظ إعدادات التطبيق والخيارات المحلية");
    setActivityLog(getActivityLog());
    setSavedAt(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
    toast.success("تم حفظ إعدادات التطبيق محليًا وتطبيقها فورًا");
  }

  function restoreDefaults() {
    if (settings.confirmDestructiveActions && !window.confirm("سيتم إعادة جميع إعدادات التطبيق إلى القيم الافتراضية. هل تريد المتابعة؟")) return;
    setSettings(resetAppSettings());
    setSavedAt(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
    toast.success("تمت إعادة الإعدادات الافتراضية");
  }

  function addTechnician() {
    const name = technicianNameDraft.trim();
    if (!name) { toast.error("اكتب اسم الفني أولًا."); return; }
    if (settings.technicianPayroll[name]) { toast.error("هذا الفني مضاف بالفعل."); return; }
    update("technicianPayroll", { ...settings.technicianPayroll, [name]: { monthlySalary: 0, installationPercent: 0, maintenancePercent: 0 } });
    setTechnicianNameDraft("");
  }

  function updateTechnician(name: string, field: "monthlySalary" | "installationPercent" | "maintenancePercent", value: number) {
    const profile = settings.technicianPayroll[name] ?? { monthlySalary: 0, installationPercent: 0, maintenancePercent: 0 };
    update("technicianPayroll", { ...settings.technicianPayroll, [name]: { ...profile, [field]: Math.max(0, Math.min(field === "monthlySalary" ? 99999999 : 100, value || 0)) } });
  }

  function removeTechnician(name: string) {
    if (settings.confirmDestructiveActions && !window.confirm(`حذف إعدادات الفني ${name} فقط؟ لن تُحذف زياراته أو معاملاته.`)) return;
    const next = { ...settings.technicianPayroll };
    delete next[name];
    update("technicianPayroll", next);
  }

  function savePin(event: React.FormEvent) {
    event.preventDefault();
    const current = currentPin.trim();
    const next = newPin.trim();
    if (next.length < 4) { toast.error("اكتب رقمًا سريًا من 4 أحرف أو أرقام على الأقل."); return; }
    if (next !== confirmPin.trim()) { toast.error("تأكيد الرقم السري غير مطابق."); return; }
    setPin.mutate({ newPin: next, currentPin: current || undefined });
  }

  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="page-heading">الإعدادات</h1><p className="page-subheading">اضبط كل ما يخص نقطة نقاء من مكان واحد. الإعدادات تحفظ على هذا الجهاز وتعمل دون إنترنت.</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800">{savedAt ? `آخر حفظ ${savedAt}` : "إعدادات محلية"}</span><Button onClick={saveAll} className="rounded-xl bg-teal-700 hover:bg-teal-800"><Save className="ml-1 h-4 w-4" />حفظ كل الإعدادات</Button></div></div>

    <section className="soft-card overflow-hidden"><div className="flex items-start gap-3 border-b border-teal-950/6 p-5"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700"><SlidersHorizontal className="h-5 w-5" /></div><div><h2 className="font-extrabold">بيانات الشركة وطريقة العرض</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">هذه البيانات تستخدم كإعدادات عامة للتطبيق والتقارير والتصدير والبيانات الجديدة.</p></div></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label><span className="field-label">اسم الشركة</span><input className="field-input" value={settings.companyName} onChange={event => update("companyName", event.target.value)} /></label><label><span className="field-label">رقم هاتف الشركة</span><input className="field-input" value={settings.companyPhone} onChange={event => update("companyPhone", event.target.value)} placeholder="مثال: 01000000000" /></label><label><span className="field-label">عنوان الشركة</span><input className="field-input" value={settings.companyAddress} onChange={event => update("companyAddress", event.target.value)} /></label><label><span className="field-label">اسم الفني الافتراضي</span><input className="field-input" value={settings.defaultTechnician} onChange={event => update("defaultTechnician", event.target.value)} placeholder="يظهر تلقائيًا في الزيارات الجديدة" /></label><label><span className="field-label">تنسيق التاريخ</span><select className="field-input" value={settings.dateFormat} onChange={event => update("dateFormat", event.target.value as AppSettings["dateFormat"])}><option value="arabic">عربي</option><option value="gregorian">إنجليزي/ميلادي</option></select></label><div className="sm:col-span-2"><Toggle checked={settings.useArabicDigits} onChange={value => update("useArabicDigits", value)} label="استخدام الأرقام العربية في العرض والتقارير" /></div></div></section>

    <section className="soft-card overflow-hidden"><div className="border-b border-teal-950/6 p-5"><h2 className="font-extrabold">العملاء والزيارات والمتابعة</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">تحكم في القيم الافتراضية التي تظهر أثناء تسجيل العميل والزيارة وحساب موعد المتابعة.</p></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label><span className="field-label">مدة المتابعة التلقائية بالأيام</span><input type="number" min={1} max={730} className="field-input" value={settings.followUpDays} onChange={event => update("followUpDays", Math.max(1, Number(event.target.value) || 120))} /></label><label><span className="field-label">طريقة كود العميل</span><select className="field-input" value={settings.customerCodeMode} onChange={event => update("customerCodeMode", event.target.value as AppSettings["customerCodeMode"])}><option value="automatic">تلقائي بالترتيب</option><option value="manual">إدخال يدوي</option></select></label><label><span className="field-label">نوع الزيارة الافتراضي</span><select className="field-input" value={settings.defaultVisitType} onChange={event => update("defaultVisitType", event.target.value as AppSettings["defaultVisitType"])}>{visitTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="field-label">عدد أيام التذكير قبل الموعد</span><input type="number" min={0} max={30} className="field-input" value={settings.reminderLeadDays} onChange={event => update("reminderLeadDays", Math.max(0, Number(event.target.value) || 0))} /></label></div></section>

    <section className="soft-card overflow-hidden"><div className="border-b border-teal-950/6 p-5"><h2 className="font-extrabold">التنبيهات والمواعيد</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">حدد طريقة ظهور التنبيهات ووقت إصدارها، مع بقاء التحكم المتقدم بإذن الجهاز في بطاقة التنبيهات.</p></div><div className="grid gap-3 p-5 sm:grid-cols-2"><Toggle checked={settings.remindersEnabled} onChange={value => update("remindersEnabled", value)} label="تفعيل تنبيهات المواعيد داخل التطبيق" /><Toggle checked={settings.reminderSoundEnabled} onChange={value => update("reminderSoundEnabled", value)} label="تفعيل صوت تنبيه المواعيد" /><Toggle checked={settings.reminderKeepVisibleNextDay} onChange={value => update("reminderKeepVisibleNextDay", value)} label="إبقاء التنبيه ظاهرًا في اليوم التالي" /><label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"><span>وقت التنبيه</span><input type="time" className="field-input max-w-[150px]" value={`${String(settings.reminderHour).padStart(2, "0")}:${String(settings.reminderMinute).padStart(2, "0")}`} onChange={event => { const [hour, minute] = event.target.value.split(":").map(Number); update("reminderHour", hour); update("reminderMinute", minute); }} /></label></div></section>

    <section className="soft-card overflow-hidden"><div className="border-b border-teal-950/6 p-5"><h2 className="font-extrabold">لوحة التحكم والتقارير</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">اختر البطاقات التي تحتاجها يوميًا، وحدد طريقة التعامل مع الجداول والنسخ الاحتياطية.</p></div><div className="grid gap-3 p-5 sm:grid-cols-2"><Toggle checked={settings.dashboardShowUpcoming} onChange={value => update("dashboardShowUpcoming", value)} label="إظهار بطاقة الزيارات القادمة" /><Toggle checked={settings.dashboardShowDue} onChange={value => update("dashboardShowDue", value)} label="إظهار بطاقة المتابعة المستحقة" /><Toggle checked={settings.dashboardShowCash} onChange={value => update("dashboardShowCash", value)} label="إظهار بطاقة الخزينة" /><Toggle checked={settings.dashboardShowInventory} onChange={value => update("dashboardShowInventory", value)} label="إظهار بطاقة المخزن" /><Toggle checked={settings.compactTables} onChange={value => update("compactTables", value)} label="عرض الجداول بوضع مختصر" /><label><span className="field-label">التذكير بالنسخ الاحتياطي كل</span><select className="field-input" value={settings.backupReminderDays} onChange={event => update("backupReminderDays", Number(event.target.value))}><option value={0}>بدون تذكير</option><option value={7}>7 أيام</option><option value={14}>14 يومًا</option><option value={30}>30 يومًا</option></select></label></div></section>

    <section className="soft-card overflow-hidden"><div className="border-b border-teal-950/6 p-5"><h2 className="font-extrabold">العمل دون إنترنت والمزامنة</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">هذه الخيارات تحافظ على سرعة التسجيل وتحدد سلوك المزامنة عند عودة الإنترنت.</p></div><div className="grid gap-3 p-5 sm:grid-cols-2"><Toggle checked={settings.autoSaveLocally} onChange={value => update("autoSaveLocally", value)} label="الحفظ المحلي التلقائي لكل عملية" /><Toggle checked={settings.syncWhenOnline} onChange={value => update("syncWhenOnline", value)} label="المزامنة تلقائيًا عند عودة الإنترنت" /><Toggle checked={settings.confirmDestructiveActions} onChange={value => update("confirmDestructiveActions", value)} label="طلب تأكيد قبل الحذف أو الاستعادة" /></div></section>

    <section className="soft-card overflow-hidden"><div className="border-b border-teal-950/6 p-5"><h2 className="font-extrabold">رواتب وعمولات الفنيين</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">حدد الراتب الشهري الثابت ونسبة عمولة التركيبات والصيانة لكل فني. القيم صفر افتراضيًا، والعمولة المستحقة لا تعني أنها دُفعت نقدًا.</p></div><div className="space-y-4 p-5"><div className="flex flex-col gap-2 sm:flex-row"><input className="field-input flex-1" value={technicianNameDraft} onChange={event => setTechnicianNameDraft(event.target.value)} placeholder="اكتب اسم الفني لإضافته" /><Button type="button" variant="outline" onClick={addTechnician} className="rounded-xl border-teal-700/30 text-teal-800">إضافة فني</Button></div>{Object.keys(settings.technicianPayroll).length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-3">الفني</th><th className="px-3 py-3">الراتب الشهري</th><th className="px-3 py-3">عمولة التركيبات %</th><th className="px-3 py-3">عمولة الصيانة %</th><th className="px-3 py-3">إجراء</th></tr></thead><tbody className="divide-y">{Object.entries(settings.technicianPayroll).map(([name, profile]) => <tr key={name}><td className="px-3 py-3 font-bold">{name}</td><td className="px-3 py-2"><input type="number" min="0" step="0.01" className="field-input w-40" value={(profile.monthlySalary / 100).toString()} onChange={event => updateTechnician(name, "monthlySalary", Math.round(Number(event.target.value || 0) * 100))} /></td><td className="px-3 py-2"><input type="number" min="0" max="100" step="0.01" className="field-input w-32" value={profile.installationPercent} onChange={event => updateTechnician(name, "installationPercent", Number(event.target.value))} /></td><td className="px-3 py-2"><input type="number" min="0" max="100" step="0.01" className="field-input w-32" value={profile.maintenancePercent} onChange={event => updateTechnician(name, "maintenancePercent", Number(event.target.value))} /></td><td className="px-3 py-2"><Button type="button" variant="outline" className="rounded-lg border-rose-200 text-rose-700" onClick={() => removeTechnician(name)}>حذف الإعداد</Button></td></tr>)}</tbody></table></div> : <div className="rounded-xl bg-slate-50 p-4 text-sm text-muted-foreground">لم تتم إضافة فنيين بعد. يمكنك إضافة الأسماء الآن وترك الراتب والنسب بصفر.</div>}</div></section>

    <section className="soft-card overflow-hidden"><div className="flex items-start gap-3 border-b border-teal-950/6 p-5"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-700"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-extrabold">الرقم السري للحماية</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">يُستخدم لحماية تعديل وحذف العملاء والزيارات والخزينة والمخزن والتذكيرات.</p></div></div><form onSubmit={savePin} className="space-y-4 p-5"><div className="grid gap-4 md:grid-cols-3"><label><span className="field-label">الرقم السري الحالي</span><input type={showPins ? "text" : "password"} className="field-input" value={currentPin} onChange={event => setCurrentPin(event.target.value)} placeholder="اتركه فارغًا عند الإعداد لأول مرة" autoComplete="current-password" /></label><label><span className="field-label">الرقم السري الجديد</span><input type={showPins ? "text" : "password"} className="field-input" value={newPin} onChange={event => setNewPin(event.target.value)} placeholder="4 أحرف أو أرقام على الأقل" autoComplete="new-password" minLength={4} required /></label><label><span className="field-label">تأكيد الرقم السري الجديد</span><input type={showPins ? "text" : "password"} className="field-input" value={confirmPin} onChange={event => setConfirmPin(event.target.value)} placeholder="أعد كتابة الرقم السري" autoComplete="new-password" minLength={4} required /></label></div><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => setShowPins(value => !value)} className="rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50">{showPins ? <EyeOff className="ml-1 h-4 w-4" /> : <Eye className="ml-1 h-4 w-4" />}{showPins ? "إخفاء الأرقام" : "إظهار الأرقام"}</Button><Button type="submit" disabled={setPin.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800"><KeyRound className="ml-1 h-4 w-4" />{setPin.isPending ? "جارٍ الحفظ…" : "حفظ الرقم السري"}</Button></div><p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">إذا كان هذا أول إعداد للرقم السري، اترك خانة الرقم الحالي فارغة. لا تشارك الرقم السري مع غير المصرح لهم.</p></form></section>

    <section className="soft-card overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-teal-950/6 p-5"><div><h2 className="font-extrabold">سجل التغييرات</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">يُحفظ آخر نشاط على هذا الجهاز حتى تراجع ما تم تغييره دون اتصال.</p></div><Button type="button" variant="outline" className="rounded-xl border-rose-200 text-rose-700" onClick={() => { if (settings.confirmDestructiveActions && !window.confirm("مسح سجل التغييرات فقط؟")) return; clearActivityLog(); setActivityLog([]); toast.success("تم مسح سجل التغييرات"); }}>مسح السجل</Button></div><div className="space-y-2 p-5">{activityLog.length ? activityLog.slice(0, 8).map(entry => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"><span className="font-bold text-teal-900">{entry.action}: {entry.details}</span><time className="text-muted-foreground" dir="ltr">{new Date(entry.createdAt).toLocaleString("ar-SA")}</time></div>) : <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-muted-foreground">لا توجد تغييرات مسجلة بعد.</p>}</div></section>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="text-xs leading-6 text-rose-900">إعادة الإعدادات لا تحذف العملاء أو الزيارات أو الخزينة أو المخزن؛ تعيد تفضيلات العرض والتشغيل فقط.</p><Button variant="outline" onClick={restoreDefaults} className="rounded-xl border-rose-300 text-rose-800 hover:bg-rose-100"><RotateCcw className="ml-1 h-4 w-4" />إعادة الإعدادات الافتراضية</Button></div>
  </div>;
}
