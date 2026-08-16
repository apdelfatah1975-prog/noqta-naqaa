import { Badge } from "@/components/ui/badge";
import { PinVerificationDialog } from "@/components/PinVerificationDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { customerMapUrl, formatDateTime } from "@/lib/filterUi";
import { customerExcelHeaders, customerRowsForExcel, downloadRowsAsExcel, withArabicHeaders } from "@/lib/excelExport";
import { printArabicPdf } from "@/lib/pdfExport";
import { cacheOfflineCustomers, getOfflineCustomers, getOfflineSession, queueOfflineCustomer } from "@/lib/offlineSync";
import { Download, Loader2, MapPinned, MessageCircle, Pencil, Phone, Plus, Search, UsersRound } from "lucide-react";
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type VisitType = "installation" | "maintenance" | "cartridge_change" | "follow_up" | "other";
type CustomerForm = { id?: number; manualCode: string; name: string; phone: string; address: string; location: string; notes: string; firstVisitType: VisitType; firstVisitDate: string; firstTechnicianName: string; firstVisitNotes: string; firstCollectedAmount: string };
function toDateTimeLocal() { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
function parseLocation(value: string) { const trimmed = value.trim(); const match = trimmed.match(/(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)/); return { latitude: match?.[1] ?? null, longitude: match?.[2] ?? null }; }
const emptyCustomer: CustomerForm = { manualCode: "", name: "", phone: "", address: "", location: "", notes: "", firstVisitType: "installation", firstVisitDate: toDateTimeLocal(), firstTechnicianName: "", firstVisitNotes: "", firstCollectedAmount: "" };

export default function Customers() {
  const [search, setSearch] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState<"all" | "overdue" | "today" | "upcoming" | "none">("all");
  const [sortBy, setSortBy] = useState<"created_desc" | "next_asc" | "next_desc" | "status">("created_desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyCustomer);
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const input = useMemo(() => ({ search: search || undefined, followUpStatus, sortBy }), [search, followUpStatus, sortBy]);
  const { data: customers, isLoading, isError } = trpc.filters.customers.list.useQuery(input);
  const [offlineCustomers, setOfflineCustomers] = useState(() => getOfflineCustomers());
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();
  const createCustomer = trpc.filters.customers.create.useMutation({ onSuccess: () => { utils.filters.customers.list.invalidate(); utils.filters.dashboard.invalidate(); toast.success("تمت إضافة العميل بنجاح"); setDialogOpen(false); }, onError: error => toast.error(error.message || "تعذر إضافة العميل. يرجى المحاولة مرة أخرى.") });
  const deleteCustomer = trpc.filters.customers.delete.useMutation({ onSuccess: () => { utils.filters.customers.list.invalidate(); utils.filters.dashboard.invalidate(); setDeleteId(null); toast.success("تم حذف العميل وسجلاته المرتبطة"); }, onError: error => toast.error(error.message || "تعذر حذف العميل.") });

  const updateCustomer = trpc.filters.customers.update.useMutation({ onSuccess: () => { utils.filters.customers.list.invalidate(); utils.filters.customers.get.invalidate(); utils.filters.dashboard.invalidate(); utils.filters.reminders.due.invalidate(); toast.success("تم تعديل بيانات العميل"); setDialogOpen(false); }, onError: error => toast.error(error.message || "تعذر تعديل بيانات العميل. يرجى المحاولة مرة أخرى.") });
  const saving = createCustomer.isPending || updateCustomer.isPending;
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const displayedCustomers = customers ?? ((isOffline || isError) ? offlineCustomers.map(customer => ({
    ...customer,
    address: customer.address ?? null,
    latitude: customer.latitude ?? null,
    longitude: customer.longitude ?? null,
    notes: customer.notes ?? null,
    manualCode: customer.manualCode ?? null,
    customerCode: customer.manualCode || "",
    followUp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerId: getOfflineSession()?.id ?? 0,
    clientOperationId: null,
    lastVisitDate: new Date(0),
    collectedAmount: 0,
    collectedCurrency: "SAR" as const,
  })) : undefined);

  useEffect(() => { if (customers) { cacheOfflineCustomers(customers); setOfflineCustomers(getOfflineCustomers()); } }, [customers]);
  useEffect(() => {
    const queryRequestsNew = new URLSearchParams(window.location.search).get("new") === "1";
    if (queryRequestsNew || location.includes("new=1")) {
      setForm(emptyCustomer);
      setDialogOpen(true);
      window.history.replaceState({}, "", "/customers");
    }
  }, [location]);

  if (isError && !displayedCustomers) return <div className="soft-card p-8 text-center"><p className="font-bold text-teal-950">تعذر تحميل قائمة العملاء من الخادم.</p><p className="mt-2 text-sm text-muted-foreground">لا توجد نسخة محلية محفوظة على هذا الجهاز بعد. افتح التطبيق مرة واحدة مع الإنترنت لمزامنة البيانات ثم يمكنك استخدامه دون اتصال.</p><Button onClick={() => window.location.reload()} variant="outline" className="mt-4 rounded-xl">إعادة المحاولة</Button></div>;

  function openNew() { setForm(emptyCustomer); setDialogOpen(true); }
  function openEdit(customer: NonNullable<typeof customers>[number]) { const serviceDate = customer.followUp?.lastServiceVisitDate ? new Date(customer.followUp.lastServiceVisitDate) : new Date(); serviceDate.setMinutes(serviceDate.getMinutes() - serviceDate.getTimezoneOffset()); const location = customer.latitude && customer.longitude ? `${customer.latitude}, ${customer.longitude}` : ""; setForm({ ...emptyCustomer, id: customer.id, manualCode: customer.manualCode || "", name: customer.name, phone: customer.phone, address: customer.address || "", location, notes: customer.notes || "", firstVisitDate: serviceDate.toISOString().slice(0, 16) }); setDialogOpen(true); }
  function submit(event: FormEvent) {
    event.preventDefault();
    const location = parseLocation(form.location);
    const payload = { manualCode: form.manualCode.trim() || null, name: form.name, phone: form.phone, address: form.address || null, latitude: location.latitude, longitude: location.longitude, notes: form.notes || null, ...(form.id ? {} : { firstVisitType: form.firstVisitType, firstVisitDate: new Date(form.firstVisitDate), firstTechnicianName: form.firstTechnicianName || null, firstVisitNotes: form.firstVisitNotes || null, firstCollectedAmount: Math.round(Number(form.firstCollectedAmount || 0) * 100), firstCollectedCurrency: "SAR" as const }) };
    if (form.id) {
      if (isOffline) return toast.error("تعديل البيانات يحتاج اتصالًا بالإنترنت حاليًا.");
      setPendingUpdate({ id: form.id, manualCode: form.manualCode.trim() || null, name: form.name, phone: form.phone, address: form.address || null, latitude: location.latitude, longitude: location.longitude, notes: form.notes || null, serviceDate: new Date(form.firstVisitDate), ...(form.firstCollectedAmount.trim() ? { collectedAmount: Math.round(Number(form.firstCollectedAmount) * 100) } : {}) });
      setPinOpen(true);
      return;
    }
    if (isOffline) {
      const offlineUser = getOfflineSession();
      if (!offlineUser) return toast.error("افتح التطبيق مرة واحدة مع الإنترنت أولًا لتفعيل العمل دون اتصال.");
      queueOfflineCustomer(offlineUser.id, { ...payload, firstVisitDate: new Date(form.firstVisitDate).toISOString() });
      setOfflineCustomers(getOfflineCustomers());
      toast.success("تم حفظ العميل على الجهاز وسيتزامن تلقائيًا عند عودة الإنترنت.");
      setForm(emptyCustomer);
      setDialogOpen(false);
      return;
    }
    createCustomer.mutate(payload);
  }
  function exportCustomers() { if (!customers?.length) { toast.info("لا توجد بيانات مطابقة للتصدير"); return; } downloadRowsAsExcel(`عملاء-نقطة-نقاء-${new Date().toISOString().slice(0, 10)}.xlsx`, "العملاء", withArabicHeaders(customerRowsForExcel(customers), customerExcelHeaders)); toast.success("تم تجهيز ملف العملاء للتنزيل"); }
  function exportCustomersPdf() { if (!customers?.length) { toast.info("لا توجد بيانات مطابقة للتصدير"); return; } const rows = customerRowsForExcel(customers); const opened = printArabicPdf("تقرير العملاء", rows, Object.entries(customerExcelHeaders).map(([key, label]) => ({ key, label }))); if (opened) toast.success("تم فتح تقرير PDF للطباعة أو الحفظ"); else toast.error("تعذر فتح نافذة PDF. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى"); }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="page-heading">إدارة العملاء</h1><p className="page-subheading">احتفظ ببيانات العملاء ومواقعهم وسجل خدماتهم بصورة مرتبة.</p></div><div className="flex flex-wrap gap-2"><Button onClick={exportCustomers} variant="outline" className="h-11 rounded-xl"><Download className="ml-2 h-4 w-4" />تصدير Excel</Button><Button onClick={exportCustomersPdf} variant="outline" className="h-11 rounded-xl"><Download className="ml-2 h-4 w-4" />تصدير PDF</Button><Button onClick={openNew} className="h-11 rounded-xl bg-teal-700 px-5 font-bold hover:bg-teal-800"><Plus className="ml-2 h-5 w-5" />إضافة عميل</Button></div></div>
      <div className="soft-card overflow-hidden"><div className="border-b border-teal-950/6 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className="field-input pr-10" value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث باسم العميل أو هاتفه أو كوده" aria-label="البحث في العملاء" /></div><div className="flex flex-wrap items-center gap-2" aria-label="الفلاتر السريعة"><span className="text-xs font-bold text-teal-900">عرض:</span>{[ ["all", "الكل"], ["overdue", "متأخر"], ["today", "اليوم"], ["upcoming", "قادم"], ["none", "بدون موعد"] ].map(([value, label]) => <button key={value} type="button" onClick={() => setFollowUpStatus(value as typeof followUpStatus)} className={`rounded-full px-3 py-2 text-xs font-bold transition ${followUpStatus === value ? "bg-teal-700 text-white" : "bg-teal-50 text-teal-800 hover:bg-teal-100"}`}>{label}</button>)}</div><label className="flex items-center gap-2 text-xs font-bold text-teal-900"><span className="whitespace-nowrap">ترتيب</span><select className="field-input min-w-40" value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)} aria-label="ترتيب العملاء"><option value="created_desc">الأحدث إضافة</option><option value="next_asc">أقرب متابعة</option><option value="status">الأولوية</option></select></label><Button type="button" variant="outline" className="rounded-xl" onClick={() => { setSearch(""); setFollowUpStatus("all"); setSortBy("created_desc"); }}>مسح</Button></div><p className="mt-3 text-xs text-muted-foreground">ابحث بسرعة، ثم اختر الحالة التي تريد متابعتها اليوم.</p></div>
        {isError && displayedCustomers ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">تعذر الوصول إلى الخادم حاليًا؛ تُعرض آخر قائمة عملاء محفوظة على هذا الجهاز، وستتزامن التغييرات عند عودة الاتصال.</div> : null}<div className="overflow-x-auto"><table className="w-full min-w-[940px] text-right"><thead className="bg-teal-50/70 text-xs text-teal-950/65"><tr><th className="px-5 py-4 font-bold">العميل</th><th className="px-5 py-4 font-bold">الهاتف</th><th className="px-5 py-4 font-bold">المتابعة القادمة</th><th className="px-5 py-4 font-bold">آخر زيارة</th><th className="px-5 py-4 font-bold">آخر تحصيل</th><th className="px-5 py-4 font-bold">العنوان</th><th className="px-5 py-4 font-bold">إجراءات</th></tr></thead><tbody className="divide-y divide-teal-950/6">{isLoading && !displayedCustomers ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : displayedCustomers?.length ? displayedCustomers.map(customer => { const mapUrl = customerMapUrl(customer); const followUp = customer.followUp; return <tr key={customer.id} className="hover:bg-teal-50/45"><td className="px-5 py-4"><button onClick={() => setLocation(`/customers/${customer.id}`)} className="font-extrabold text-teal-900 hover:text-teal-600">{customer.name}</button><p className="mt-1 text-xs font-bold tracking-wide text-teal-700" dir="ltr">{customer.customerCode}</p></td><td className="px-5 py-4" dir="ltr">{customer.phone}</td><td className="px-5 py-4 text-sm">{followUp ? <><p className="font-bold text-teal-950">{formatDateTime(followUp.nextVisitDate)}</p><p className={`mt-1 text-xs font-bold ${followUp.daysRemaining < 0 ? "text-rose-700" : "text-teal-700"}`}>{followUp.daysRemaining < 0 ? `متأخر ${Math.abs(followUp.daysRemaining)} يوم` : followUp.daysRemaining === 0 ? "موعده اليوم" : `متبقي ${followUp.daysRemaining} يوم`}</p>{followUp.daysRemaining < 0 ? <Badge variant="destructive" className="mt-2 bg-rose-100 text-rose-800 hover:bg-rose-100" aria-label="العميل متأخر عن موعد المتابعة">متأخر</Badge> : followUp.daysRemaining === 0 ? <Badge className="mt-2 border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100" aria-label="موعد متابعة العميل اليوم">موعد اليوم</Badge> : null}</> : <span className="text-muted-foreground">لا يوجد موعد</span>}</td><td className="px-5 py-4 text-sm">{customer.lastVisitDate && customer.lastVisitDate.getTime() > 0 ? formatDateTime(customer.lastVisitDate) : "—"}</td><td className="px-5 py-4 text-sm font-bold text-teal-800">{customer.collectedAmount && customer.collectedAmount > 0 ? `${(customer.collectedAmount / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س` : "—"}</td><td className="max-w-64 truncate px-5 py-4 text-sm text-muted-foreground">{customer.address || "—"}</td><td className="px-5 py-4"><div className="flex gap-2"><a href={`tel:${customer.phone}`} className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100" title="اتصال"><Phone className="h-4 w-4" /></a><a href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100" title="فتح واتساب"><MessageCircle className="h-4 w-4" /></a>{mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100" title="فتح الموقع"><MapPinned className="h-4 w-4" /></a> : null}<button onClick={() => openEdit(customer)} className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100" title="تعديل"><Pencil className="h-4 w-4" /></button><button onClick={() => setDeleteId(customer.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100" title="حذف">حذف</button></div></td></tr>; }) : <tr><td colSpan={7} className="p-12 text-center"><UsersRound className="mx-auto h-7 w-7 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">لا توجد بيانات عملاء مطابقة.</p></td></tr>}</tbody></table></div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir="rtl"><DialogHeader><DialogTitle>{form.id ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle><DialogDescription>أدخل بيانات العميل والخدمة الأولى، ثم احفظها لتحديث الزيارات والتذكيرات والخزينة تلقائيًا.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4 py-2 sm:grid-cols-2"><div className="rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3 sm:col-span-2"><span className="field-label">كود العميل</span><p className="mt-1 text-lg font-extrabold tracking-wide text-teal-900" dir="ltr">{form.id ? (customers?.find(customer => customer.id === form.id)?.customerCode || "—") : "سيُنشأ تلقائيًا بعد الحفظ"}</p><p className="mt-1 text-xs text-teal-700">يمكنك إدخال الكود يدويًا، وإذا تركته فارغًا يُنشئه النظام تلقائيًا بالتسلسل.</p></div><div className="flex items-end gap-2"><div className="min-w-0 flex-1"><Field label="كود العميل (اختياري)" value={form.manualCode} onChange={value => setForm({ ...form, manualCode: value })} dir="ltr" placeholder="مثال: ١٠٠ أو 100" /></div><button type="button" className="mb-0 h-10 shrink-0 rounded-xl border border-teal-200 bg-white px-3 text-xs font-bold text-teal-800 transition hover:bg-teal-50" onClick={() => setForm({ ...form, manualCode: "" })}>تلقائي</button></div><Field label="اسم العميل" value={form.name} onChange={value => setForm({ ...form, name: value })} required /><Field label="رقم الهاتف" value={form.phone} onChange={value => setForm({ ...form, phone: value })} dir="ltr" required /><div className="sm:col-span-2"><Field label="العنوان" value={form.address} onChange={value => setForm({ ...form, address: value })} /></div><div className="sm:col-span-2 mt-2 rounded-2xl border border-teal-100 bg-teal-50/60 p-4"><p className="mb-3 text-sm font-extrabold text-teal-900">بيانات أول خدمة والتحصيل</p><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">نوع أمر الخدمة</span><select className="field-input" value={form.firstVisitType} disabled={Boolean(form.id)} onChange={event => setForm({ ...form, firstVisitType: event.target.value as VisitType })}><option value="installation">تركيب فلتر</option><option value="maintenance">صيانة</option><option value="cartridge_change">تغيير شمعات</option><option value="follow_up">متابعة</option><option value="other">أخرى</option></select></label><Field label="اسم الفني" value={form.firstTechnicianName} onChange={value => setForm({ ...form, firstTechnicianName: value })} placeholder="مثال: أحمد" /><label><span className="field-label">تاريخ ووقت الخدمة</span><input type="datetime-local" className="field-input" value={form.firstVisitDate} onChange={event => setForm({ ...form, firstVisitDate: event.target.value })} /></label><label><span className="field-label">المبلغ المحصل (بالريال السعودي)</span><input type="number" min="0" step="0.01" className="field-input" value={form.firstCollectedAmount} onChange={event => setForm({ ...form, firstCollectedAmount: event.target.value })} placeholder="مثال: 250" /></label></div><p className="mt-3 text-xs text-teal-800">سيُنشئ النظام الزيارة وسجل التحصيل في الخزينة تلقائيًا، وسيضيف تذكيرًا بعد 120 يومًا للتركيب أو الصيانة. عند التعديل، يُحدّث تاريخ آخر خدمة وموعد المتابعة المرتبط بها.</p></div><div className="sm:col-span-2"><Field label="الموقع" value={form.location} onChange={value => setForm({ ...form, location: value })} dir="ltr" placeholder="رابط الخريطة أو الإحداثيات: 24.7136, 46.6753" /><p className="mt-1 text-xs text-muted-foreground">أدخل رابط الموقع أو خط العرض والطول في خانة واحدة.</p></div><div className="sm:col-span-2"><label className="field-label">ملاحظات</label><textarea className="field-textarea" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="أي ملاحظات مفيدة للفني" /></div><div className="flex justify-end gap-3 pt-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">إلغاء</Button><Button disabled={saving} type="submit" className="rounded-xl bg-teal-700 hover:bg-teal-800">{saving ? "جارٍ الحفظ…" : "حفظ البيانات"}</Button></div></form></DialogContent>      </Dialog>
      <PinVerificationDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }} busy={deleteCustomer.isPending} title="تأكيد حذف العميل" description="سيتم حذف العميل وجميع الزيارات والتذكيرات والعمليات المرتبطة به نهائيًا." onConfirm={pin => { if (deleteId !== null) deleteCustomer.mutate({ id: deleteId, pin }); }} />
      <PinVerificationDialog open={pinOpen} onOpenChange={open => { if (!open) { setPinOpen(false); setPendingUpdate(null); } }} busy={updateCustomer.isPending} title="تأكيد تعديل بيانات العميل" onConfirm={pin => { if (pendingUpdate) updateCustomer.mutate({ ...pendingUpdate, pin }); }} />
    </div>
  );
}

function Field({ label, value, onChange, required, dir, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; dir?: "ltr" | "rtl"; placeholder?: string }) { return <label><span className="field-label">{label}</span><input className="field-input" value={value} dir={dir} placeholder={placeholder} required={required} onChange={event => onChange(event.target.value)} /></label>; }
