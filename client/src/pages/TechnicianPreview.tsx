import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, Clock3, MapPin, PenLine, Phone, ShieldCheck, UserRound, Wifi, Wrench } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { queueOfflineWorkOrderProof, queueOfflineWorkOrderUpdate } from "@/lib/offlineSync";

const statusLabels: Record<string, string> = {
  assigned: "مسند",
  en_route: "في الطريق",
  arrived: "وصل",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  postponed: "مؤجل",
  cancelled: "ملغى",
};

const serviceLabels: Record<string, string> = {
  installation: "تركيب فلتر",
  maintenance: "صيانة",
  cartridge_change: "تغيير شمعات",
  follow_up: "متابعة",
  other: "أخرى",
};

type SelectedItem = { inventoryItemId: number; quantity: number; source: "manual" };
const MAX_COLLECTION_AMOUNT = 100000;

export default function TechnicianPreview() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [result, setResult] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [localUpdates, setLocalUpdates] = useState<Record<number, { status: string; visitResult?: string | null; collectedAmount?: number }>>({});
  const signatureCanvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const clearSignature = () => { const canvas = signatureCanvas.current; if (!canvas) return; canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height); };
  const signaturePoint = (event: React.PointerEvent<HTMLCanvasElement>) => { const canvas = signatureCanvas.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); const context = canvas.getContext("2d"); if (!context) return; context.lineWidth = 2.5; context.lineCap = "round"; context.strokeStyle = "#0f766e"; context.lineTo((event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height); context.stroke(); };
  const saveSignature = () => { const canvas = signatureCanvas.current; if (!selected || !canvas) return; const dataUrl = canvas.toDataURL("image/png"); if (!dataUrl.endsWith("base64,")) return; if (!online && user) { queueOfflineWorkOrderProof(user.id, { visitId: selected.id, kind: "signature", dataUrl }); toast.success("تم حفظ التوقيع على الهاتف، وستتم مزامنته عند عودة الإنترنت"); return; } proofUpload.mutate({ visitId: selected.id, kind: "signature", dataUrl }); };
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);
  const query = trpc.filters.workOrders.list.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const inventoryQuery = trpc.filters.inventory.technicianSummary.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const utils = trpc.useUtils();
  const proofUpload = trpc.filters.workOrders.addProof.useMutation({ onSuccess: () => toast.success("تم حفظ الدليل بأمان"), onError: error => toast.error(error.message || "تعذر حفظ الدليل") });
  const update = trpc.filters.workOrders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ تحديث أمر العمل");
      query.refetch();
      utils.filters.visits.list.invalidate();
      utils.filters.dashboard.invalidate();
      setSelectedId(null);
      setResult("");
      setAmount("");
      setSelectedItems({});
    },
    onError: error => toast.error(error.message || "تعذر حفظ التحديث"),
  });

  const orders = useMemo(() => (query.data ?? []).map(order => localUpdates[order.id] ? { ...order, ...localUpdates[order.id] } : order), [localUpdates, query.data]);
  const inventory = inventoryQuery.data?.items ?? [];
  const visible = useMemo(() => filter === "all" ? orders : orders.filter(order => order.status === filter), [filter, orders]);
  const selected = orders.find(order => order.id === selectedId);

  const saveUpdate = (input: { id: number; status: "en_route" | "arrived" | "in_progress" | "completed"; visitResult: string | null; notes: string | null; collectedAmount: number; items: SelectedItem[] }) => {
    if (!online && user) {
      queueOfflineWorkOrderUpdate(user.id, { ...input, collectedCurrency: "SAR" });
      setLocalUpdates(current => ({ ...current, [input.id]: { status: input.status, visitResult: input.visitResult, collectedAmount: input.collectedAmount } }));
      toast.success("تم الحفظ على الهاتف، وستتم المزامنة عند عودة الإنترنت");
      setSelectedId(null);
      setResult("");
      setAmount("");
      setSelectedItems({});
      return;
    }
    update.mutate(input);
  };
  const updateOrder = (id: number, status: "en_route" | "arrived" | "in_progress") => {
    saveUpdate({ id, status, visitResult: null, notes: null, collectedAmount: 0, items: [] });
  };

  const toggleItem = (id: number, balance: number) => {
    setSelectedItems(current => {
      if (current[id]) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: Math.min(1, balance) };
    });
  };

  const uploadProof = (kind: "photo" | "signature", file: File | undefined) => {
    if (!selected || !file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { toast.error("اختر صورة لا تتجاوز 5 ميجابايت"); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result !== "string") return; if (!online && user) { queueOfflineWorkOrderProof(user.id, { visitId: selected.id, kind, dataUrl: reader.result }); toast.success("تم حفظ الدليل على الهاتف، وستتم مزامنته عند عودة الإنترنت"); return; } proofUpload.mutate({ visitId: selected.id, kind, dataUrl: reader.result }); };
    reader.readAsDataURL(file);
  };

  const completeOrder = () => {
    if (!selected) return;
    const normalizedAmount = Number(amount.trim() || "0");
    if (!Number.isFinite(normalizedAmount) || !Number.isInteger(normalizedAmount) || normalizedAmount < 0) {
      toast.error("أدخل مبلغًا صحيحًا غير سالب بالريال.");
      return;
    }
    if (normalizedAmount > MAX_COLLECTION_AMOUNT) {
      toast.error("مبلغ التحصيل غير منطقي؛ الحد الأقصى المسموح 100,000 ريال.");
      return;
    }
    const items: SelectedItem[] = Object.entries(selectedItems)
      .filter(([, quantity]) => quantity > 0)
      .map(([inventoryItemId, quantity]) => ({ inventoryItemId: Number(inventoryItemId), quantity, source: "manual" }));
    saveUpdate({
      id: selected.id,
      status: "completed",
      visitResult: result.trim() || "تم تنفيذ الخدمة",
      notes: null,
      // المبلغ موحّد بالريال الكامل في الواجهة والخادم والخزينة.
      collectedAmount: normalizedAmount,
      items,
    });
  };

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-xl space-y-4 bg-slate-50 px-3 pb-6 pt-3">
      <section className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#075e59,#0f766e)] p-5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setLocation("/")} className="grid h-10 w-10 place-items-center rounded-xl bg-white/15" aria-label="العودة"><ArrowLeft className="h-5 w-5" /></button>
          <div className="text-left"><p className="text-xs font-bold text-teal-100">حساب الفني</p><h1 className="mt-1 text-2xl font-black">أوامري فقط</h1></div>
          <Wrench className="h-7 w-7 text-teal-100" />
        </div>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/10 px-3 py-3 text-sm"><span className="font-bold">الفني: {user?.name || "حساب الفني"}</span><span className="flex items-center gap-1.5 text-teal-50"><Wifi className="h-4 w-4" /> {online ? "متصل ومزامن" : "محفوظ على الهاتف"}</span></div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[{ key: "all", label: "كل الأوامر", value: orders.length }, { key: "in_progress", label: "قيد التنفيذ", value: orders.filter(order => ["en_route", "arrived", "in_progress"].includes(order.status)).length }, { key: "completed", label: "مكتملة", value: orders.filter(order => order.status === "completed").length }].map(stat => <button key={stat.key} type="button" onClick={() => setFilter(stat.key)} className={`rounded-2xl border bg-white p-3 text-center shadow-sm ${filter === stat.key ? "border-teal-500 ring-2 ring-teal-100" : "border-slate-200"}`}><p className="text-[11px] font-bold text-slate-500">{stat.label}</p><p className="mt-1 text-2xl font-black text-teal-800">{stat.value}</p></button>)}
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-black text-emerald-950">أوامرك المسندة فقط</h2><p className="mt-1 text-xs font-semibold leading-6 text-emerald-800">تظهر هنا أوامر العمل الخاصة بك فقط، دون الخزينة أو التقارير أو بيانات باقي الفنيين.</p></div></div></section>

      <section className="space-y-3"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-slate-900">خطوات الزيارة</h2><p className="mt-1 text-xs font-bold text-slate-500">حدّث الحالة بعد كل خطوة</p></div><span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">{visible.length} أوامر</span></div>
        {visible.length ? visible.map(order => <article key={order.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700"><UserRound className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="truncate text-base font-black text-slate-900">{order.customer?.name || "عميل"}</h3><p className="mt-1 text-xs font-bold text-slate-500">{serviceLabels[order.visitType] || order.visitType}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">{statusLabels[order.status] || order.status}</span></div><div className="mt-3 space-y-2 text-xs font-bold text-slate-500"><span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-teal-600" />{new Date(order.visitDate).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}</span><span className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />{order.customer?.address || "العنوان غير مسجل"}</span></div></div></div><div className="mt-4 grid grid-cols-3 gap-2"><a href={`tel:${order.customer?.phone || ""}`} className="flex h-10 items-center justify-center gap-1 rounded-xl bg-slate-100 text-xs font-black text-slate-700"><Phone className="h-4 w-4" /> اتصال</a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer?.latitude && order.customer?.longitude ? `${order.customer.latitude},${order.customer.longitude}` : order.customer?.address || "")}`} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-1 rounded-xl bg-sky-50 text-xs font-black text-sky-800"><MapPin className="h-4 w-4" /> خريطة</a>{order.status === "assigned" ? <Button type="button" onClick={() => updateOrder(order.id, "en_route")} className="h-10 rounded-xl bg-teal-700 text-xs font-black">في الطريق</Button> : order.status !== "completed" && order.status !== "cancelled" ? <Button type="button" onClick={() => { setSelectedId(order.id); setResult(order.visitResult || ""); }} aria-label="تحديث" className="h-10 rounded-xl bg-teal-700 text-xs font-black">تحديث / تسجيل التنفيذ</Button> : <span className="flex h-10 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-800">تم الحفظ</span>}</div>{order.status === "en_route" ? <Button type="button" onClick={() => updateOrder(order.id, "arrived")} className="mt-2 h-10 w-full rounded-xl bg-sky-700 text-xs font-black">وصلت إلى العميل</Button> : null}{order.status === "arrived" ? <Button type="button" onClick={() => updateOrder(order.id, "in_progress")} className="mt-2 h-10 w-full rounded-xl bg-indigo-700 text-xs font-black">بدء التنفيذ</Button> : null}</article>) : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">لا توجد أوامر مسندة حاليًا.</div>}
      </section>

      {selected ? <section className="rounded-3xl border border-teal-200 bg-white p-5 shadow-lg"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-teal-700">إغلاق أمر العمل</p><h2 className="mt-1 text-lg font-black text-slate-900">{selected.customer?.name}</h2></div><button type="button" onClick={() => setSelectedId(null)} className="text-sm font-black text-slate-500">إغلاق</button></div><label className="mt-4 block text-sm font-black text-slate-700">ما تم تنفيذه<textarea aria-label="ما تم تنفيذه" value={result} onChange={event => setResult(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3 font-bold" placeholder="مثال: تم تغيير الشمعات وفحص التسريب" /></label><label className="mt-3 block text-sm font-black text-slate-700">المبلغ المحصل بالريال<input aria-label="المبلغ المحصل" inputMode="numeric" min="0" max={MAX_COLLECTION_AMOUNT} value={amount} onChange={event => setAmount(event.target.value.replace(/[^0-9-]/g, ""))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-lg font-black" placeholder="0" /><span className="mt-1 block text-[11px] font-bold text-slate-500">اكتب الرقم كما هو، مثل: 250</span></label><div className="mt-4 grid grid-cols-2 gap-2"><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-black text-sky-800"><Camera className="h-4 w-4" /> صورة العمل<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => uploadProof("photo", event.target.files?.[0])} /></label><div className="col-span-2 rounded-xl border border-violet-200 bg-violet-50 p-3"><div className="mb-2 flex items-center justify-between text-xs font-black text-violet-800"><span className="flex items-center gap-2"><PenLine className="h-4 w-4" /> توقيع العميل</span><button type="button" onClick={clearSignature} className="text-[11px] underline">مسح</button></div><canvas ref={signatureCanvas} width={640} height={180} onPointerDown={event => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); const context = event.currentTarget.getContext("2d"); context?.beginPath(); signaturePoint(event); }} onPointerMove={event => { if (drawing.current) signaturePoint(event); }} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} className="h-28 w-full touch-none rounded-lg border border-violet-200 bg-white" aria-label="لوحة توقيع العميل" /><div className="mt-2 flex gap-2"><Button type="button" onClick={saveSignature} className="h-8 flex-1 bg-violet-700 text-xs">حفظ التوقيع</Button><label className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-violet-200 px-3 text-[11px] font-black text-violet-800">رفع ملف<input type="file" accept="image/png,image/jpeg" className="hidden" onChange={event => uploadProof("signature", event.target.files?.[0])} /></label></div></div></div><div className="mt-4"><h3 className="text-sm font-black text-slate-700">الأصناف المستخدمة</h3><p className="mt-1 text-xs font-semibold text-slate-500">اختر الصنف واكتب الكمية، وسيتم خصمها عند إغلاق الأمر.</p><div className="mt-2 space-y-2">{inventory.length ? inventory.map(item => { const selectedQuantity = selectedItems[item.id] || 0; const balance = Math.max(0, item.currentBalance ?? 0); return <div key={item.id} className={`flex items-center gap-2 rounded-xl border p-2 ${selectedQuantity ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-white"}`}><button type="button" onClick={() => toggleItem(item.id, balance)} disabled={balance < 1} className="min-w-0 flex-1 text-right text-xs font-black text-slate-800"><span>{item.name}</span><span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] ${balance > (item.reorderLevel ?? 0) ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>الرصيد {balance}</span></button>{selectedQuantity ? <input aria-label={`كمية ${item.name}`} inputMode="numeric" value={selectedQuantity} onChange={event => setSelectedItems(current => ({ ...current, [item.id]: Math.max(1, Math.min(balance, Number(event.target.value.replace(/[^0-9]/g, "")) || 1)) }))} className="h-9 w-16 rounded-lg border border-teal-300 bg-white text-center font-black" /> : null}</div>; }) : <p className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-500">لا توجد أصناف متاحة.</p>}</div></div><Button type="button" onClick={completeOrder} disabled={update.isPending} className="mt-4 h-12 w-full rounded-xl bg-teal-700 font-black hover:bg-teal-800">{update.isPending ? "جاري الحفظ..." : <><CheckCircle2 className="ml-2 h-5 w-5" /> حفظ وإغلاق أمر العمل</>}</Button></section> : null}
    </main>
  );
}
