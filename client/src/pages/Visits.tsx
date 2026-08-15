import { Button } from "@/components/ui/button";
import { cacheOfflineCustomers, getOfflineCustomers, getOfflineSession, queueOfflineVisit } from "@/lib/offlineSync";
import { trpc } from "@/lib/trpc";
import { toDateTimeLocal, visitTypeLabels } from "@/lib/filterUi";
import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export default function Visits() {
  const input = useMemo(() => ({}), []);
  const { data: customers, isLoading } = trpc.filters.customers.list.useQuery(input);
  const offlineCustomers = getOfflineCustomers();
  const visibleCustomers = customers ?? (!navigator.onLine ? offlineCustomers : []);
  const [customerId, setCustomerId] = useState("");
  const [visitType, setVisitType] = useState<keyof typeof visitTypeLabels>("maintenance");
  const [visitDate, setVisitDate] = useState(toDateTimeLocal());
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();
  const createVisit = trpc.filters.visits.create.useMutation({ onSuccess: result => { utils.filters.dashboard.invalidate(); utils.filters.customers.list.invalidate(); utils.filters.customers.get.invalidate(); utils.filters.reminders.due.invalidate(); toast.success(result.reminderCreated ? "تم التسجيل وإنشاء تذكير تلقائي بعد 120 يومًا" : "تم تسجيل الزيارة بنجاح"); setNotes(""); }, onError: error => toast.error(error.message || "تعذر تسجيل الزيارة. يرجى المحاولة مرة أخرى.") });
  useEffect(() => { if (customers) cacheOfflineCustomers(customers); }, [customers]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!customerId) return toast.error("اختر العميل أولًا");
    if (!navigator.onLine) {
      const offlineUser = getOfflineSession();
      if (!offlineUser) return toast.error("افتح التطبيق مرة واحدة مع الإنترنت أولًا.");
      queueOfflineVisit(offlineUser.id, { customerId: Number(customerId), visitType, visitDate: new Date(visitDate).toISOString(), notes: notes || null });
      setNotes("");
      toast.success("تم حفظ الزيارة على الجهاز وستتزامن تلقائيًا عند عودة الإنترنت.");
      return;
    }
    createVisit.mutate({ customerId: Number(customerId), visitType, visitDate: new Date(visitDate), notes: notes || null });
  }
  return <div className="mx-auto max-w-3xl space-y-6"><div><h1 className="page-heading">تسجيل زيارة</h1><p className="page-subheading">سجّل تفاصيل الخدمة، وسيتم إنشاء تذكير تلقائي بعد 120 يومًا لزيارات التركيب والصيانة.</p></div><section className="soft-card overflow-hidden"><div className="flex items-center gap-3 bg-teal-50/75 p-5"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-white"><CalendarPlus className="h-5 w-5" /></div><div><h2 className="font-extrabold">بيانات الزيارة</h2><p className="mt-1 text-xs text-muted-foreground">أدخل الخدمة المنفذة وتاريخها بدقة.</p></div></div><form onSubmit={submit} className="grid gap-5 p-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="field-label">العميل</span><select className="field-input" value={customerId} onChange={event => setCustomerId(event.target.value)} required><option value="">{isLoading && !visibleCustomers.length ? "جارٍ تحميل العملاء…" : "اختر العميل"}</option>{visibleCustomers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} — {customer.phone}</option>)}</select></label><label><span className="field-label">نوع الزيارة</span><select className="field-input" value={visitType} onChange={event => setVisitType(event.target.value as keyof typeof visitTypeLabels)}>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="field-label">تاريخ ووقت الزيارة</span><input type="datetime-local" className="field-input" value={visitDate} onChange={event => setVisitDate(event.target.value)} required /></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={notes} onChange={event => setNotes(event.target.value)} placeholder="مثل نوع الفلتر، القطع التي تم استبدالها، أو ملاحظات للفريق" /></label><div className="flex items-center justify-between gap-3 border-t border-teal-950/6 pt-5 sm:col-span-2"><p className="flex items-center gap-2 text-xs leading-6 text-teal-700"><CheckCircle2 className="h-4 w-4 shrink-0" />{navigator.onLine ? "يُنشأ التذكير تلقائيًا لزيارات التركيب والصيانة." : "سيُحفظ السجل على هذا الجهاز ثم يتزامن تلقائيًا."}</p><Button type="submit" disabled={createVisit.isPending} className="h-11 rounded-xl bg-teal-700 px-5 font-bold hover:bg-teal-800">{createVisit.isPending ? "جارٍ الحفظ…" : navigator.onLine ? "تسجيل الزيارة" : "حفظ للمزامنة"}</Button></div></form></section></div>;
}
