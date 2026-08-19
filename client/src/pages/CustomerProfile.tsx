import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerContactActions } from "@/components/CustomerContactActions";
import { PinVerificationDialog } from "@/components/PinVerificationDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UsedItemsSection, addOrIncrementVisitItem, buildPartsConfirmation, type CatalogItem, type UsedVisitItem } from "@/pages/Customers";
import { cacheOfflineInventory, getOfflineCustomers, getOfflineInventory, getOfflineServiceCatalog, getOfflineSession, getOfflineVisits, queueOfflineVisit } from "@/lib/offlineSync";

type OfflineInventorySnapshot = { items: Array<{ id: number; name: string; unit: string; currentBalance: number }>; movements?: Array<Record<string, unknown>> };
import { trpc } from "@/lib/trpc";
import { formatDateTime, reminderStatusLabels, toDateTimeLocal, visitTypeLabels } from "@/lib/filterUi";
import { ArrowRight, BellRing, CalendarClock, CalendarPlus, Edit3, Loader2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

function daysLabel(daysRemaining: number) {
  if (daysRemaining < 0) return `متأخر ${Math.abs(daysRemaining)} يوم`;
  if (daysRemaining === 0) return "موعده اليوم";
  return `متبقي ${daysRemaining} يوم`;
}

export default function CustomerProfile() {
  const [, params] = useRoute("/customers/:id");
  const customerId = Number(params?.id);
  const queryInput = useMemo(() => ({ id: customerId }), [customerId]);
  const { data, isLoading } = trpc.filters.customers.get.useQuery(queryInput, { enabled: Number.isFinite(customerId), retry: false });
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const offlineData = useMemo(() => {
    if (!isOffline) return null;
    const customer = getOfflineCustomers().find(item => item.id === customerId);
    if (!customer) return null;
    const visits = getOfflineVisits().filter(visit => visit.customerId === customerId).sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
    return { customer: { ...customer, followUp: null }, visits, reminders: [] } as const;
  }, [customerId, isOffline]);
  const resolvedData = data ?? offlineData;
  const offlineOwnerId = getOfflineSession()?.id ?? 0;
  const { data: inventoryData } = trpc.filters.inventory.summary.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const offlineCatalog = getOfflineServiceCatalog();
  const catalogItems: CatalogItem[] = (inventoryData?.items ?? offlineCatalog?.items ?? []).map(item => ({ id: item.id, name: item.name, unit: item.unit, currentBalance: item.currentBalance }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visitType, setVisitType] = useState<keyof typeof visitTypeLabels>("maintenance");
  const [visitDate, setVisitDate] = useState(toDateTimeLocal());
  const [notes, setNotes] = useState("");
  const [visitResult, setVisitResult] = useState("");
  const [visitTechnicianName, setVisitTechnicianName] = useState("");
  const [visitCollectedAmount, setVisitCollectedAmount] = useState("");
  const [visitItems, setVisitItems] = useState<UsedVisitItem[]>([]);
  const [manualItemName, setManualItemName] = useState("");
  const [manualItemQuantity, setManualItemQuantity] = useState("1");
  const [editingVisitId, setEditingVisitId] = useState<number | null>(null);
  const [visitPinOpen, setVisitPinOpen] = useState(false);
  const [editingVisitDate, setEditingVisitDate] = useState(toDateTimeLocal());
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const updateVisitDate = trpc.filters.visits.updateDate.useMutation({
    onSuccess: () => {
      utils.filters.customers.get.invalidate(queryInput);
      utils.filters.customers.list.invalidate();
      utils.filters.dashboard.invalidate();
      utils.filters.reminders.due.invalidate();
      toast.success("تم تعديل تاريخ ووقت الخدمة وتحديث موعد المتابعة");
      setEditingVisitId(null);
    },
    onError: error => toast.error(error.message || "تعذر تعديل الخدمة"),
  });
  useEffect(() => {
    const shouldOpenVisit = new URLSearchParams(window.location.search).get("openVisit") === "1";
    if (shouldOpenVisit && data) {
      setDialogOpen(true);
      setVisitType("maintenance");
      setVisitDate(toDateTimeLocal());
      setNotes(""); setVisitResult(""); setVisitTechnicianName(""); setVisitCollectedAmount(""); setVisitItems([]); setManualItemName(""); setManualItemQuantity("1");
      window.history.replaceState({}, "", `/customers/${customerId}`);
    }
  }, [customerId, data]);

  const createVisit = trpc.filters.visits.create.useMutation({
    onSuccess: result => {
      utils.filters.customers.get.invalidate(queryInput);
      utils.filters.customers.list.invalidate();
      utils.filters.dashboard.invalidate();
      utils.filters.reminders.due.invalidate();
      toast.success(result.reminderCreated ? "تم تسجيل الزيارة وإنشاء تذكير بعد 120 يومًا" : "تم تسجيل الزيارة بنجاح");
      setDialogOpen(false);
      setNotes(""); setVisitResult(""); setVisitTechnicianName(""); setVisitCollectedAmount(""); setVisitItems([]); setManualItemName(""); setManualItemQuantity("1");
    },
    onError: error => toast.error(error.message || "تعذر تسجيل الزيارة. يرجى المحاولة مرة أخرى."),
  });

  if (isLoading && !resolvedData) return <div className="grid min-h-72 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>;
  if (!resolvedData) return <div className="soft-card p-8 text-center"><p className="font-bold">تعذر العثور على العميل في البيانات المحلية.</p><Button onClick={() => setLocation("/customers")} variant="outline" className="mt-4 rounded-xl">العودة للعملاء</Button></div>;

  const { customer } = resolvedData;
  const customerCode = "customerCode" in customer ? customer.customerCode : customer.manualCode ?? customer.id;
  const followUp = customer.followUp;

  function submitVisit(event: FormEvent) {
    event.preventDefault();
    const collectedAmount = Math.round((Number.parseFloat(visitCollectedAmount) || 0) * 100);
    const payload = { customerId, visitType, visitDate: new Date(visitDate), technicianName: visitTechnicianName || null, visitResult: visitResult || null, collectedAmount, collectedCurrency: "SAR" as const, notes: notes || null, items: visitItems.filter(item => item.quantity > 0) };
    if (payload.items.length > 0 && !window.confirm(buildPartsConfirmation(payload.items, catalogItems))) return;
    if (isOffline) {
      const offlineUser = getOfflineSession();
      if (!offlineUser) { toast.error("افتح التطبيق مرة واحدة مع الإنترنت أولًا لتفعيل العمل دون اتصال."); return; }
      const offlineInventory = getOfflineInventory<OfflineInventorySnapshot>(offlineUser.id);
      if (offlineInventory) {
        for (const usedItem of payload.items) {
          const localItem = offlineInventory.items.find((item: OfflineInventorySnapshot["items"][number]) => item.id === usedItem.inventoryItemId);
          if (!localItem) { toast.error("تعذر العثور على أحد الأصناف في المخزن المحلي."); return; }
          if (usedItem.quantity > localItem.currentBalance) { toast.error(`الرصيد غير كافٍ من صنف ${localItem.name}؛ المتاح ${localItem.currentBalance} والمطلوب ${usedItem.quantity}.`); return; }
        }
        const movementDate = new Date(visitDate).toISOString();
        cacheOfflineInventory(offlineUser.id, { ...offlineInventory, items: offlineInventory.items.map((item: OfflineInventorySnapshot["items"][number]) => { const used = payload.items.filter(entry => entry.inventoryItemId === item.id).reduce((sum, entry) => sum + entry.quantity, 0); return used ? { ...item, currentBalance: item.currentBalance - used } : item; }), movements: [...(offlineInventory.movements ?? []), ...payload.items.map((entry, index) => ({ id: -Date.now() - index, inventoryItemId: entry.inventoryItemId, inventoryItemName: offlineInventory.items.find((item: OfflineInventorySnapshot["items"][number]) => item.id === entry.inventoryItemId)?.name ?? "صنف", movementType: "outgoing" as const, quantity: entry.quantity, movementDate, technicianName: visitTechnicianName || null, notes: "منصرف تلقائي من زيارة محفوظة دون اتصال" }))] });
      }
      queueOfflineVisit(offlineUser.id, { ...payload, visitDate: new Date(visitDate).toISOString() });
      toast.success("تم حفظ الزيارة وخصم الأصناف محليًا، وستتم المزامنة تلقائيًا عند عودة الإنترنت.");
      setDialogOpen(false);
      return;
    }
    createVisit.mutate(payload);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <button onClick={() => setLocation("/customers")} className="inline-flex items-center text-sm font-bold text-teal-700"><ArrowRight className="ml-1 h-4 w-4" />العودة إلى العملاء</button>
      <section className="soft-card overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#064e4a,#0f766e)] p-6 text-white sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-teal-100">ملف العميل</p>
            <div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold">{customer.name}</h1><span className="text-lg font-extrabold text-white" dir="ltr">{customerCode}</span></div>
            <p className="mt-2 text-sm text-teal-50/80" dir="ltr">{customer.phone}</p>
          </div>
          <Button onClick={() => {       setVisitType("maintenance"); setVisitDate(toDateTimeLocal()); setNotes(""); setVisitResult(""); setVisitTechnicianName(""); setVisitCollectedAmount(""); setVisitItems([]); setManualItemName(""); setManualItemQuantity("1"); setDialogOpen(true); }} className="mt-5 rounded-xl bg-white text-teal-800 hover:bg-teal-50 sm:mt-0"><CalendarPlus className="ml-2 h-4 w-4" />تسجيل زيارة</Button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <div><p className="text-xs font-bold text-muted-foreground">العنوان</p><p className="mt-2 text-sm leading-6">{customer.address || "غير مسجل"}</p></div>
          <div><p className="text-xs font-bold text-muted-foreground">الموقع GPS</p><p className="mt-2 text-sm" dir="ltr">{customer.latitude && customer.longitude ? `${customer.latitude}, ${customer.longitude}` : "غير مسجل"}</p></div>
          <CustomerContactActions customer={customer} labels className="items-end" />
        </div>
        {customer.notes ? <div className="border-t border-teal-950/6 bg-teal-50/35 px-6 py-4 text-sm leading-7 text-muted-foreground"><span className="font-bold text-teal-950">ملاحظات: </span>{customer.notes}</div> : null}
      </section>
      <section className="soft-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-teal-950/6 bg-teal-50/40 p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-700 text-white"><CalendarClock className="h-5 w-5" /></div><div><h2 className="font-extrabold">الموعد القادم</h2><p className="mt-1 text-xs text-muted-foreground">يُحتسب تلقائيًا بعد 120 يومًا من آخر تركيب أو صيانة.</p></div></div>
        {followUp ? <div className="grid gap-4 p-5 sm:grid-cols-3"><div><p className="text-xs font-bold text-muted-foreground">موعد المتابعة</p><p className="mt-2 font-extrabold text-teal-950">{formatDateTime(followUp.nextVisitDate)}</p></div><div><p className="text-xs font-bold text-muted-foreground">الحالة</p><p className={`mt-2 font-extrabold ${followUp.daysRemaining < 0 ? "text-rose-700" : "text-teal-700"}`}>{daysLabel(followUp.daysRemaining)}</p></div><div><p className="text-xs font-bold text-muted-foreground">آخر زيارة محسوبة</p><p className="mt-2 font-bold">{visitTypeLabels[followUp.lastServiceVisitType]} <span className="font-normal text-muted-foreground">— {formatDateTime(followUp.lastServiceVisitDate)}</span></p></div></div> : <p className="p-5 text-sm leading-7 text-muted-foreground">لا يوجد موعد متابعة بعد؛ سجّل زيارة من نوع تركيب أو صيانة لإنشائه تلقائيًا.</p>}
      </section>
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="soft-card lg:col-span-2"><div className="flex items-center justify-between border-b border-teal-950/6 p-5"><div><h2 className="font-extrabold">سجل الزيارات</h2><p className="mt-1 text-xs text-muted-foreground">جميع الزيارات المسجلة للعميل مرتبة من الأحدث.</p></div><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">{resolvedData.visits.length} زيارة</span></div><div className="divide-y divide-teal-950/6">{resolvedData.visits.length ? resolvedData.visits.map(visit => <div key={visit.id} className="flex gap-4 p-5"><div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-teal-500 ring-4 ring-teal-50" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary" className="bg-teal-50 text-teal-800">{visitTypeLabels[visit.visitType]}</Badge><div className="flex items-center gap-2"><p className="text-xs font-bold text-muted-foreground">{formatDateTime(visit.visitDate)}</p><Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-2 text-teal-700" onClick={() => { setEditingVisitId(visit.id); setEditingVisitDate(toDateTimeLocal(new Date(visit.visitDate))); }}><Edit3 className="ml-1 h-3.5 w-3.5" />تعديل</Button></div></div>{visit.notes ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{visit.notes}</p> : null}</div></div>) : <div className="p-10 text-center text-sm text-muted-foreground">لا توجد زيارات سابقة لهذا العميل.</div>}</div></div>
        <div className="soft-card"><div className="flex items-center gap-2 border-b border-teal-950/6 p-5"><BellRing className="h-5 w-5 text-amber-500" /><div><h2 className="font-extrabold">التذكيرات</h2><p className="mt-1 text-xs text-muted-foreground">متابعة الصيانة</p></div></div><div className="divide-y divide-teal-950/6">{resolvedData.reminders.length ? resolvedData.reminders.map(reminder => <div key={reminder.id} className="p-4"><Badge variant="secondary" className={reminder.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}>{reminderStatusLabels[reminder.status]}</Badge><p className="mt-2 text-sm font-bold">{formatDateTime(reminder.reminderDate)}</p></div>) : <div className="p-8 text-center text-sm text-muted-foreground">لا يوجد تذكير مسجل.</div>}</div></div>
      </section>
      <Dialog open={editingVisitId !== null} onOpenChange={open => { if (!open) setEditingVisitId(null); }}><DialogContent dir="rtl"><DialogHeader><DialogTitle>تعديل تاريخ ووقت الخدمة</DialogTitle></DialogHeader><form onSubmit={event => { event.preventDefault(); if (editingVisitId !== null) setVisitPinOpen(true); }} className="space-y-4 py-2"><label><span className="field-label">تاريخ ووقت الخدمة</span><input type="datetime-local" className="field-input" value={editingVisitDate} onChange={event => setEditingVisitDate(event.target.value)} required /></label><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setEditingVisitId(null)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={updateVisitDate.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{updateVisitDate.isPending ? "جارٍ الحفظ…" : "حفظ التعديل"}</Button></div></form></DialogContent></Dialog>
      <PinVerificationDialog open={visitPinOpen} onOpenChange={open => { if (!open) setVisitPinOpen(false); }} busy={updateVisitDate.isPending} title="تأكيد تعديل تاريخ الزيارة" onConfirm={pin => { if (editingVisitId !== null) updateVisitDate.mutate({ visitId: editingVisitId, visitDate: new Date(editingVisitDate), pin }); }} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent dir="rtl" className="flex max-h-[90vh] flex-col overflow-hidden"><DialogHeader className="shrink-0"><DialogTitle>تسجيل زيارة جديدة</DialogTitle><DialogDescription>للعميل: {customer.name} — {customerCode}</DialogDescription></DialogHeader><form onSubmit={submitVisit} className="min-h-0 space-y-4 overflow-y-auto py-2 pl-1"><label><span className="field-label">نوع الزيارة</span><select className="field-input" value={visitType} onChange={event => setVisitType(event.target.value as keyof typeof visitTypeLabels)}>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="field-label">تاريخ ووقت الزيارة</span><input type="datetime-local" className="field-input" value={visitDate} onChange={event => setVisitDate(event.target.value)} required /></label><label><span className="field-label">اسم الفني</span><input className="field-input" value={visitTechnicianName} onChange={event => setVisitTechnicianName(event.target.value)} placeholder="مثال: أحمد" /></label><label><span className="field-label">المبلغ المحصل</span><input type="number" inputMode="decimal" min="0" step="0.01" className="field-input min-h-12 w-full text-lg" value={visitCollectedAmount} onChange={event => setVisitCollectedAmount(event.target.value)} placeholder="مثال: 250" /></label><label><span className="field-label">نتيجة الزيارة</span><textarea className="field-textarea" value={visitResult} onChange={event => setVisitResult(event.target.value)} placeholder="ما الذي تم تنفيذه؟" /></label><label><span className="field-label">ملاحظات الزيارة</span><textarea className="field-textarea" value={notes} onChange={event => setNotes(event.target.value)} placeholder="اكتب تفاصيل مختصرة عن الخدمة" /></label><UsedItemsSection items={visitItems} setItems={setVisitItems} catalogItems={catalogItems} manualName={manualItemName} setManualName={setManualItemName} manualQuantity={manualItemQuantity} setManualQuantity={setManualItemQuantity} onAdd={() => { const item = catalogItems.find(entry => entry.name.trim() === manualItemName.trim()); const quantity = Number.parseInt(manualItemQuantity, 10); if (!item) { toast.error("الصنف غير موجود في المخزن؛ أضفه أولًا من صفحة المخزن."); return; } if (!Number.isInteger(quantity) || quantity <= 0) { toast.error("أدخل كمية صحيحة أكبر من صفر."); return; } const selected = visitItems.find(entry => entry.inventoryItemId === item.id)?.quantity ?? 0; if (item.currentBalance !== undefined && item.currentBalance <= 0) { toast.error(`الصنف ${item.name} غير متوفر حاليًا؛ الرصيد صفر.`); return; } if (item.currentBalance !== undefined && selected + quantity > item.currentBalance) { toast.error(`الرصيد المتاح من ${item.name}: ${item.currentBalance}`); return; } setVisitItems(current => addOrIncrementVisitItem(current, item, quantity)); setManualItemName(""); setManualItemQuantity("1"); }} onQuickAdd={item => setVisitItems(current => addOrIncrementVisitItem(current, item))} listId="profile-visit-inventory-items" /><div className="sticky bottom-0 flex justify-end gap-3 border-t border-teal-100 bg-white/95 pt-3 backdrop-blur"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createVisit.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createVisit.isPending ? "جارٍ التسجيل…" : "حفظ الزيارة"}</Button></div></form></DialogContent></Dialog>
    </div>
  );
}
