import { useMemo, useState } from "react";
import { CalendarDays, MapPin, Plus, UserRound, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const serviceOptions = [
  { value: "installation", label: "تركيب فلتر" },
  { value: "maintenance", label: "صيانة" },
  { value: "cartridge_change", label: "تغيير شمعات" },
  { value: "follow_up", label: "متابعة" },
  { value: "other", label: "أخرى" },
] as const;

export default function WorkOrders() {
  const today = new Date().toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [visitType, setVisitType] = useState<(typeof serviceOptions)[number]["value"]>("maintenance");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const customersQuery = trpc.filters.customers.list.useQuery({ followUpStatus: "all", sortBy: "created_desc" });
  const techniciansQuery = trpc.filters.technicians.list.useQuery();
  const ordersQuery = trpc.filters.workOrders.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const createOrder = trpc.filters.workOrders.create.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال أمر العمل إلى صفحة الفني");
      utils.filters.workOrders.list.invalidate();
      setCustomerId("");
      setTechnicianId("");
      setNotes("");
    },
    onError: error => toast.error(error.message || "تعذر إنشاء أمر العمل"),
  });
  const selectedCustomer = useMemo(() => (customersQuery.data ?? []).find(customer => String(customer.id) === customerId), [customersQuery.data, customerId]);

  const submit = () => {
    if (!customerId || !technicianId || !date) {
      toast.error("اختر العميل والفني والموعد أولًا");
      return;
    }
    createOrder.mutate({ customerId: Number(customerId), assignedTechnicianId: Number(technicianId), visitType, visitDate: new Date(`${date}T${time}:00`), notes: notes.trim() || null });
  };

  return <main dir="rtl" className="space-y-5 pb-8">
    <section className="rounded-[2rem] bg-[linear-gradient(135deg,#075e59,#0f766e)] p-5 text-white shadow-lg">
      <p className="text-sm font-bold text-teal-100">التشغيل الميداني</p>
      <h1 className="mt-1 text-2xl font-black">أوامر الفنيين</h1>
      <p className="mt-2 text-sm leading-6 text-teal-50">أنشئ أمر تركيب أو صيانة، وسيظهر للفني مع العنوان والموقع والبيانات اللازمة فقط.</p>
    </section>

    <section className="rounded-3xl border border-teal-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-50 text-teal-700"><Plus className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-slate-900">إرسال أمر جديد</h2><p className="text-xs font-bold text-slate-500">لن يرى الفني بيانات الخزينة أو تكلفة الشراء</p></div></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-black text-slate-700">العميل<select value={customerId} onChange={event => setCustomerId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold"><option value="">اختر العميل</option>{(customersQuery.data ?? []).map(customer => <option key={customer.id} value={customer.id}>{customer.name}{customer.manualCode ? ` — ${customer.manualCode}` : ""}</option>)}</select></label>
        <label className="text-sm font-black text-slate-700">الفني<select value={technicianId} onChange={event => setTechnicianId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold"><option value="">اختر الفني</option>{(techniciansQuery.data ?? []).map(technician => <option key={technician.id} value={technician.id}>{technician.name}</option>)}</select></label>
        <label className="text-sm font-black text-slate-700">نوع الخدمة<select value={visitType} onChange={event => setVisitType(event.target.value as typeof visitType)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold">{serviceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-sm font-black text-slate-700">التاريخ<input type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 font-bold" /></label><label className="text-sm font-black text-slate-700">الوقت<input type="time" value={time} onChange={event => setTime(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 font-bold" /></label></div>
        <label className="text-sm font-black text-slate-700 md:col-span-2">تعليمات للفني<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="مثال: فحص تسريب أسفل الحوض" className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3 font-bold" /></label>
      </div>
      {selectedCustomer ? <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-teal-700" />{selectedCustomer.name} — {selectedCustomer.phone || "بدون هاتف"}</div><div className="mt-2 flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />{selectedCustomer.address || "العنوان غير مسجل"}</div></div> : null}
      <Button type="button" onClick={submit} disabled={createOrder.isPending} className="mt-4 h-12 w-full rounded-xl bg-teal-700 font-black hover:bg-teal-800">{createOrder.isPending ? "جاري الإرسال..." : "إرسال الأمر إلى الفني"}</Button>
    </section>

    <section className="space-y-3"><div className="flex items-center gap-2"><Wrench className="h-5 w-5 text-teal-700" /><h2 className="text-lg font-black text-slate-900">الأوامر المرسلة</h2></div>{(ordersQuery.data ?? []).map(order => <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{order.customer?.name || "عميل غير معروف"}</h3><p className="mt-1 text-xs font-bold text-slate-500">{serviceOptions.find(option => option.value === order.visitType)?.label || order.visitType} · {order.technicianName || "بدون فني"}</p></div><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">{order.status === "completed" ? "مكتمل" : order.status === "assigned" ? "مسند" : "قيد التنفيذ"}</span></div><div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-500"><span className="flex items-center gap-1"><CalendarDays className="h-4 w-4 text-teal-700" />{new Date(order.visitDate).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}</span><span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-teal-700" />{order.customer?.address || "بدون عنوان"}</span></div></article>)}</section>
  </main>;
}
