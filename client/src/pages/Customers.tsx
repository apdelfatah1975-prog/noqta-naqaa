import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { customerMapUrl, formatDateTime } from "@/lib/filterUi";
import { customerExcelHeaders, customerRowsForExcel, downloadRowsAsExcel, withArabicHeaders } from "@/lib/excelExport";
import { printArabicPdf } from "@/lib/pdfExport";
import { cacheOfflineCustomers, getOfflineCustomers, getOfflineSession, queueOfflineCustomer } from "@/lib/offlineSync";
import { Download, Loader2, MapPinned, Pencil, Phone, Plus, Search, UsersRound } from "lucide-react";
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type VisitType = "installation" | "maintenance" | "cartridge_change" | "follow_up" | "other";
type Currency = "SAR" | "EGP";
type CustomerForm = { id?: number; manualCode: string; name: string; phone: string; address: string; latitude: string; longitude: string; notes: string; firstVisitType: VisitType; firstVisitDate: string; firstTechnicianName: string; firstVisitNotes: string; firstCollectedAmount: string; firstCollectedCurrency: Currency };
function toDateTimeLocal() { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
const emptyCustomer: CustomerForm = { manualCode: "", name: "", phone: "", address: "", latitude: "", longitude: "", notes: "", firstVisitType: "installation", firstVisitDate: toDateTimeLocal(), firstTechnicianName: "", firstVisitNotes: "", firstCollectedAmount: "", firstCollectedCurrency: "SAR" };

export default function Customers() {
  const [search, setSearch] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState<"all" | "overdue" | "today" | "upcoming" | "none">("all");
  const [followUpDate, setFollowUpDate] = useState("");
  const [sortBy, setSortBy] = useState<"created_desc" | "next_asc" | "next_desc" | "status">("created_desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyCustomer);
  const input = useMemo(() => ({
    search: search || undefined,
    followUpStatus,
    followUpDate: followUpDate || undefined,
    sortBy,
  }), [search, followUpStatus, followUpDate, sortBy]);
  const { data: customers, isLoading, isError } = trpc.filters.customers.list.useQuery(input);
  const [offlineCustomers, setOfflineCustomers] = useState(() => getOfflineCustomers());
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const createCustomer = trpc.filters.customers.create.useMutation({ onSuccess: () => { utils.filters.customers.list.invalidate(); utils.filters.dashboard.invalidate(); toast.success("تمت إضافة العميل بنجاح"); setDialogOpen(false); }, onError: error => toast.error(error.message || "تعذر إضافة العميل. يرجى المحاولة مرة أخرى.") });
  const updateCustomer = trpc.filters.customers.update.useMutation({ onSuccess: () => { utils.filters.customers.list.invalidate(); utils.filters.customers.get.invalidate(); utils.filters.dashboard.invalidate(); utils.filters.reminders.due.invalidate(); toast.success("تم تعديل بيانات العميل"); setDialogOpen(false); }, onError: error => toast.error(error.message || "تعذر تعديل بيانات العميل. يرجى المحاولة مرة أخرى.") });
  const saving = createCustomer.isPending || updateCustomer.isPending;
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const displayedCustomers = customers ?? (isOffline ? offlineCustomers.map(customer => ({
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
  })) : undefined);

  useEffect(() => { if (customers) { cacheOfflineCustomers(customers); setOfflineCustomers(getOfflineCustomers()); } }, [customers]);

  if (isError && !isOffline) return <div className="soft-card p-8 text-center"><p className="font-bold text-teal-950">تعذر تحميل قائمة العملاء.</p><p className="mt-2 text-sm text-muted-foreground">تحقق من الاتصال ثم أعد المحاولة.</p><Button onClick={() => window.location.reload()} variant="outline" className="mt-4 rounded-xl">إعادة المحاولة</Button></div>;

  function openNew() { setForm(emptyCustomer); setDialogOpen(true); }
  function openEdit(customer: NonNullable<typeof customers>[number]) { setForm({ ...emptyCustomer, id: customer.id, manualCode: customer.manualCode || "", name: customer.name, phone: customer.phone, address: customer.address || "", latitude: customer.latitude || "", longitude: customer.longitude || "", notes: customer.notes || "" }); setDialogOpen(true); }
  function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { manualCode: form.manualCode.trim() || null, name: form.name, phone: form.phone, address: form.address || null, latitude: form.latitude || null, longitude: form.longitude || null, notes: form.notes || null, ...(form.id ? {} : { firstVisitType: form.firstVisitType, firstVisitDate: new Date(form.firstVisitDate), firstTechnicianName: form.firstTechnicianName || null, firstVisitNotes: form.firstVisitNotes || null, firstCollectedAmount: Math.round(Number(form.firstCollectedAmount || 0) * 100), firstCollectedCurrency: form.firstCollectedCurrency }) };
    if (form.id) {
      if (isOffline) return toast.error("تعديل البيانات يحتاج اتصالًا بالإنترنت حاليًا.");
      updateCustomer.mutate({ id: form.id, manualCode: form.manualCode.trim() || null, name: form.name, phone: form.phone, address: form.address || null, latitude: form.latitude || null, longitude: form.longitude || null, notes: form.notes || null });
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
      <div className="soft-card overflow-hidden"><div className="border-b border-teal-950/6 p-4"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_180px_210px_auto]"><div className="relative"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className="field-input pr-10" value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث بالاسم أو الهاتف أو كود العميل" /></div><select className="field-input" value={followUpStatus} onChange={event => setFollowUpStatus(event.target.value as typeof followUpStatus)} aria-label="حالة المتابعة"><option value="all">كل حالات المتابعة</option><option value="overdue">متأخرون</option><option value="today">موعد اليوم</option><option value="upcoming">مواعيد قادمة</option><option value="none">بدون موعد</option></select><input className="field-input" type="date" value={followUpDate} onChange={event => setFollowUpDate(event.target.value)} aria-label="تاريخ المتابعة" /><select className="field-input" value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)} aria-label="ترتيب العملاء"><option value="created_desc">الأحدث إضافة</option><option value="next_asc">أقرب موعد متابعة</option><option value="next_desc">أبعد موعد متابعة</option><option value="status">الأولوية: متأخر ثم اليوم</option></select><Button type="button" variant="outline" className="rounded-xl" onClick={() => { setSearch(""); setFollowUpStatus("all"); setFollowUpDate(""); setSortBy("created_desc"); }}>مسح</Button></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-right"><thead className="bg-teal-50/70 text-xs text-teal-950/65"><tr><th className="px-5 py-4 font-bold">العميل</th><th className="px-5 py-4 font-bold">الهاتف</th><th className="px-5 py-4 font-bold">المتابعة القادمة</th><th className="px-5 py-4 font-bold">العنوان</th><th className="px-5 py-4 font-bold">إجراءات</th></tr></thead><tbody className="divide-y divide-teal-950/6">{isLoading ? <tr><td colSpan={5} className="p-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : displayedCustomers?.length ? displayedCustomers.map(customer => { const mapUrl = customerMapUrl(customer); const followUp = customer.followUp; return <tr key={customer.id} className="hover:bg-teal-50/45"><td className="px-5 py-4"><button onClick={() => setLocation(`/customers/${customer.id}`)} className="font-extrabold text-teal-900 hover:text-teal-600">{customer.name}</button><p className="mt-1 text-xs font-bold tracking-wide text-teal-700" dir="ltr">{customer.customerCode}</p></td><td className="px-5 py-4" dir="ltr">{customer.phone}</td><td className="px-5 py-4 text-sm">{followUp ? <><p className="font-bold text-teal-950">{formatDateTime(followUp.nextVisitDate)}</p><p className={`mt-1 text-xs font-bold ${followUp.daysRemaining < 0 ? "text-rose-700" : "text-teal-700"}`}>{followUp.daysRemaining < 0 ? `متأخر ${Math.abs(followUp.daysRemaining)} يوم` : followUp.daysRemaining === 0 ? "موعده اليوم" : `متبقي ${followUp.daysRemaining} يوم`}</p>{followUp.daysRemaining < 0 ? <Badge variant="destructive" className="mt-2 bg-rose-100 text-rose-800 hover:bg-rose-100" aria-label="العميل متأخر عن موعد المتابعة">متأخر</Badge> : followUp.daysRemaining === 0 ? <Badge className="mt-2 border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100" aria-label="موعد متابعة العميل اليوم">موعد اليوم</Badge> : null}</> : <span className="text-muted-foreground">لا يوجد موعد</span>}</td><td className="max-w-64 truncate px-5 py-4 text-sm text-muted-foreground">{customer.address || "—"}</td><td className="px-5 py-4"><div className="flex gap-2"><a href={`tel:${customer.phone}`} className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100" title="اتصال"><Phone className="h-4 w-4" /></a>{mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100" title="فتح الموقع"><MapPinned className="h-4 w-4" /></a> : null}<button onClick={() => openEdit(customer)} className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100" title="تعديل"><Pencil className="h-4 w-4" /></button></div></td></tr>; }) : <tr><td colSpan={5} className="p-12 text-center"><UsersRound className="mx-auto h-7 w-7 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">لا توجد بيانات عملاء مطابقة.</p></td></tr>}</tbody></table></div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir="rtl"><DialogHeader><DialogTitle>{form.id ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle></DialogHeader><form onSubmit={submit} className="grid gap-4 py-2 sm:grid-cols-2"><div className="rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3 sm:col-span-2"><span className="field-label">كود العميل</span><p className="mt-1 text-lg font-extrabold tracking-wide text-teal-900" dir="ltr">{form.id ? (customers?.find(customer => customer.id === form.id)?.customerCode || "—") : "سيُنشأ تلقائيًا بعد الحفظ"}</p><p className="mt-1 text-xs text-teal-700">يمكنك إدخال الكود يدويًا، وإذا تركته فارغًا يُنشئه النظام تلقائيًا بالتسلسل.</p></div><Field label="كود العميل (اختياري)" value={form.manualCode} onChange={value => setForm({ ...form, manualCode: value })} dir="ltr" placeholder="مثال: ١٠٠ أو 100" /><Field label="اسم العميل" value={form.name} onChange={value => setForm({ ...form, name: value })} required /><Field label="رقم الهاتف" value={form.phone} onChange={value => setForm({ ...form, phone: value })} dir="ltr" required /><div className="sm:col-span-2"><Field label="العنوان" value={form.address} onChange={value => setForm({ ...form, address: value })} /></div><div className="sm:col-span-2 mt-2 rounded-2xl border border-teal-100 bg-teal-50/60 p-4"><p className="mb-3 text-sm font-extrabold text-teal-900">بيانات أول خدمة والتحصيل</p><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">نوع الخدمة الأولى</span><select className="field-input" value={form.firstVisitType} disabled={Boolean(form.id)} onChange={event => setForm({ ...form, firstVisitType: event.target.value as VisitType })}><option value="installation">تركيب فلتر</option><option value="maintenance">صيانة</option><option value="cartridge_change">تغيير شمعات</option><option value="follow_up">متابعة</option><option value="other">أخرى</option></select></label><Field label="اسم الفني" value={form.firstTechnicianName} onChange={value => setForm({ ...form, firstTechnicianName: value })} placeholder="مثال: أحمد" /><label><span className="field-label">تاريخ ووقت الخدمة</span><input type="datetime-local" className="field-input" disabled={Boolean(form.id)} value={form.firstVisitDate} onChange={event => setForm({ ...form, firstVisitDate: event.target.value })} /></label><label><span className="field-label">المبلغ المحصل</span><input type="number" min="0" step="0.01" className="field-input" disabled={Boolean(form.id)} value={form.firstCollectedAmount} onChange={event => setForm({ ...form, firstCollectedAmount: event.target.value })} placeholder="مثال: 250" /></label><label><span className="field-label">عملة التحصيل</span><select className="field-input" disabled={Boolean(form.id)} value={form.firstCollectedCurrency} onChange={event => setForm({ ...form, firstCollectedCurrency: event.target.value as Currency })}><option value="SAR">ريال سعودي (ر.س)</option><option value="EGP">جنيه مصري (ج.م)</option></select></label></div><p className="mt-3 text-xs text-teal-800">سيُنشئ النظام الزيارة وسجل التحصيل في الخزينة تلقائيًا، وسيضيف تذكيرًا بعد 120 يومًا للتركيب أو الصيانة.</p></div><Field label="خط العرض GPS" value={form.latitude} onChange={value => setForm({ ...form, latitude: value })} dir="ltr" placeholder="مثال: 24.7136" /><Field label="خط الطول GPS" value={form.longitude} onChange={value => setForm({ ...form, longitude: value })} dir="ltr" placeholder="مثال: 46.6753" /><div className="sm:col-span-2"><label className="field-label">ملاحظات</label><textarea className="field-textarea" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="أي ملاحظات مفيدة للفني" /></div><div className="flex justify-end gap-3 pt-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">إلغاء</Button><Button disabled={saving} type="submit" className="rounded-xl bg-teal-700 hover:bg-teal-800">{saving ? "جارٍ الحفظ…" : "حفظ البيانات"}</Button></div></form></DialogContent></Dialog>
    </div>
  );
}

function Field({ label, value, onChange, required, dir, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; dir?: "ltr" | "rtl"; placeholder?: string }) { return <label><span className="field-label">{label}</span><input className="field-input" value={value} dir={dir} placeholder={placeholder} required={required} onChange={event => onChange(event.target.value)} /></label>; }
