import React from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  MapPin,
  Menu,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  Wifi,
  Wrench,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const demoVisits = [
  { id: 1, time: "09:00", name: "أحمد محمد", service: "صيانة فلتر", area: "حي النور", status: "قادمة", tone: "amber", phone: "01000000001" },
  { id: 2, time: "11:30", name: "محمود علي", service: "تغيير شمعات", area: "حي الربيع", status: "قيد التنفيذ", tone: "blue", phone: "01000000002" },
  { id: 3, time: "14:00", name: "خالد حسن", service: "متابعة", area: "المنطقة الجديدة", status: "متأخرة", tone: "rose", phone: "01000000003" },
];

const toneStyles = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
};

export default function TechnicianPreview() {
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = React.useState("الكل");
  const [selectedVisit, setSelectedVisit] = React.useState<(typeof demoVisits)[number] | null>(null);
  const [saved, setSaved] = React.useState(false);
  const filters = ["الكل", "قادمة", "قيد التنفيذ", "مكتملة"];
  const visibleVisits = activeFilter === "الكل" ? demoVisits : demoVisits.filter(visit => visit.status === activeFilter);

  return (
    <div dir="rtl" className="mx-auto min-h-[calc(100vh-8rem)] max-w-xl space-y-4 pb-4">
      <section className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#075e59,#0f766e)] p-5 text-white shadow-[0_18px_45px_rgba(6,78,74,.2)]">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setLocation("/")} className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 transition hover:bg-white/25" aria-label="العودة للرئيسية"><ArrowLeft className="h-5 w-5" /></button>
          <div className="text-left"><p className="text-xs font-bold text-teal-100">نموذج تجريبي — لا يغيّر بيانات الشركة</p><h1 className="mt-1 text-2xl font-black">لوحة الفني اليومية</h1></div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><Menu className="h-5 w-5" /></div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/10 px-3 py-3 text-sm"><span className="font-bold">الفني: محمد محمود</span><span className="flex items-center gap-1.5 text-teal-50"><Wifi className="h-4 w-4" /> محفوظ محليًا</span></div>
      </section>

      <section className="grid grid-cols-3 gap-2" aria-label="ملخص اليوم">
        {[{ label: "زيارات اليوم", value: "6", color: "text-teal-800" }, { label: "قيد التنفيذ", value: "1", color: "text-sky-800" }, { label: "مكتملة", value: "3", color: "text-emerald-800" }].map(stat => <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm"><p className="text-[11px] font-bold text-slate-500">{stat.label}</p><p className={`mt-1 text-2xl font-black ${stat.color}`}>{stat.value}</p></div>)}
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-black text-emerald-950">بيانات العمل المسموحة فقط</h2><p className="mt-1 text-xs font-semibold leading-6 text-emerald-800">لا تظهر هنا الخزينة العامة أو تكلفة الشراء أو التقارير أو إعدادات الشركة.</p></div></div></section>

      <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">زيارات اليوم</h2><span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">{visibleVisits.length} زيارات</span></div><div className="flex gap-2 overflow-x-auto pb-1">{filters.map(filter => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition ${activeFilter === filter ? "bg-teal-700 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-teal-50"}`}>{filter}</button>)}</div></section>

      <section className="space-y-3">{visibleVisits.length ? visibleVisits.map(visit => <article key={visit.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.06)]"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700"><UserRound className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="truncate text-base font-black text-slate-900">{visit.name}</h3><p className="mt-1 text-xs font-bold text-slate-500">{visit.service}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${toneStyles[visit.tone as keyof typeof toneStyles]}`}>{visit.status}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-500"><span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-teal-600" />{visit.time}</span><span className="flex items-center gap-1.5 truncate"><MapPin className="h-4 w-4 shrink-0 text-teal-600" />{visit.area}</span></div></div></div><div className="mt-4 grid grid-cols-3 gap-2"><a href={`tel:${visit.phone}`} className="flex h-10 items-center justify-center gap-1 rounded-xl bg-slate-100 text-xs font-black text-slate-700 transition hover:bg-slate-200"><Phone className="h-4 w-4" /> اتصال</a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visit.area)}`} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-1 rounded-xl bg-sky-50 text-xs font-black text-sky-800 transition hover:bg-sky-100"><MapPin className="h-4 w-4" /> خريطة</a><Button type="button" onClick={() => { setSelectedVisit(visit); setSaved(false); }} className="h-10 rounded-xl bg-teal-700 text-xs font-black hover:bg-teal-800">تسجيل</Button></div></article>) : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">لا توجد زيارات في هذا التصنيف.</div>}</section>

      {selectedVisit ? <section className="rounded-3xl border border-teal-200 bg-white p-5 shadow-[0_16px_38px_rgba(13,82,76,.12)]"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-teal-700">تسجيل نتيجة تجريبية</p><h2 className="mt-1 text-lg font-black text-slate-900">{selectedVisit.name}</h2></div><button type="button" onClick={() => setSelectedVisit(null)} className="text-sm font-black text-slate-500">إغلاق</button></div><div className="mt-4 grid gap-3"><label className="text-sm font-black text-slate-700">نتيجة الزيارة<select className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><option>تم تنفيذ الخدمة</option><option>يحتاج زيارة أخرى</option><option>العميل غير موجود</option></select></label><label className="text-sm font-black text-slate-700">الأصناف المستخدمة<input className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="مثال: شمعات 10 بوصة × 2" /></label><Button type="button" onClick={() => setSaved(true)} className="h-12 rounded-xl bg-teal-700 font-black hover:bg-teal-800">{saved ? <><CheckCircle2 className="ml-2 h-5 w-5" /> تم الحفظ في النموذج</> : <><Plus className="ml-2 h-5 w-5" /> حفظ النتيجة التجريبية</>}</Button></div></section> : null}

      <nav className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-white p-2 text-center shadow-sm"><span className="rounded-xl bg-teal-50 py-2 text-[11px] font-black text-teal-800"><Wrench className="mx-auto mb-1 h-4 w-4" />اليوم</span><span className="py-2 text-[11px] font-bold text-slate-500"><UserRound className="mx-auto mb-1 h-4 w-4" />العملاء</span><span className="py-2 text-[11px] font-bold text-slate-500"><CalendarDays className="mx-auto mb-1 h-4 w-4" />الزيارات</span><span className="py-2 text-[11px] font-bold text-slate-500"><ChevronLeft className="mx-auto mb-1 h-4 w-4" />المزيد</span></nav>
    </div>
  );
}
