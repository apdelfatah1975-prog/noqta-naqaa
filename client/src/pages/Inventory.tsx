import { Badge } from "@/components/ui/badge";
import { PinVerificationDialog } from "@/components/PinVerificationDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatDate, toDateTimeLocal } from "@/lib/filterUi";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Boxes, PackagePlus, Plus } from "lucide-react";

const INVENTORY_CATEGORY_OPTIONS = ["فلتر ٧ مراحل كلاسيك", "فلاتر جامبو", "مبردة", "قارورة", "شمعات", "ممبرين", "وصلات", "مستلزمات تركيب", "أخرى"] as const;
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cacheOfflineInventory, getOfflineInventory, getOfflineSession, queueOfflineDelete, queueOfflineInventoryItem, queueOfflineInventoryMovement } from "@/lib/offlineSync";
import { moveToTrash } from "@/lib/trashBin";

export default function Inventory() {
  const [location] = useLocation();
  const selectedItemId = Number(new URLSearchParams(location.split("?")[1] ?? "").get("item") ?? 0);
  const owner = getOfflineSession();
  const inventoryQuery = trpc.filters.inventory.summary.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const cachedInventory = getOfflineInventory<typeof inventoryQuery.data>(owner?.id ?? 0);
  const emptyInventory = { items: [], movements: [] } as unknown as NonNullable<typeof inventoryQuery.data>;
  const data = inventoryQuery.data ?? cachedInventory ?? emptyInventory;
  const isLoading = inventoryQuery.isLoading && !inventoryQuery.data && !cachedInventory;
  const isError = false;
  const inventoryStats = useMemo(() => {
    const movements = data.movements ?? [];
    return {
      totalItems: data.items.length,
      lowStock: data.items.filter(item => item.currentBalance <= (item.reorderLevel ?? 2)).length,
      currentBalance: data.items.reduce((sum, item) => sum + item.currentBalance, 0),
      incoming: movements.filter(movement => movement.movementType === "incoming").reduce((sum, movement) => sum + movement.quantity, 0),
      outgoing: movements.filter(movement => movement.movementType === "outgoing").reduce((sum, movement) => sum + movement.quantity, 0),
    };
  }, [data]);
  const lowStockItems = useMemo(() => data.items.filter(item => item.currentBalance <= (item.reorderLevel ?? 2)).slice(0, 3), [data]);
  useEffect(() => {
    if (inventoryQuery.data && owner) cacheOfflineInventory(owner.id, inventoryQuery.data);
  }, [inventoryQuery.data, owner]);
  useEffect(() => {
    if (!selectedItemId) return;
    const target = document.getElementById(`inventory-item-${selectedItemId}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedItemId, data.items.length]);
  const utils = trpc.useUtils();
  const [itemDialog, setItemDialog] = useState(false);
  const [movementItem, setMovementItem] = useState<{ id: number; name: string } | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("عام");
  const [itemUnit, setItemUnit] = useState("قطعة");
  const [reorderLevel, setReorderLevel] = useState("2");
  const [defaultUnitCost, setDefaultUnitCost] = useState("0");
  const [openingQuantity, setOpeningQuantity] = useState("0");
  const [itemNotes, setItemNotes] = useState("");
  const [movementType, setMovementType] = useState<"incoming" | "outgoing">("incoming");
  function openMovement(item: { id: number; name: string }, type: "incoming" | "outgoing") {
    setMovementType(type);
    setMovementItem(item);
    setQuantity("");
    setUnitCost("");
    setTechnicianName("");
    setMovementNotes("");
  }
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [movementCurrency, setMovementCurrency] = useState<"SAR">("SAR");
  const [movementDate, setMovementDate] = useState(toDateTimeLocal());
  const [technicianName, setTechnicianName] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [pinAction, setPinAction] = useState<{ kind: "item" | "movement"; id: number } | null>(null);

  const createItem = trpc.filters.inventory.createItem.useMutation({
    onSuccess: () => {
      utils.filters.inventory.summary.invalidate();
      utils.filters.dashboard.invalidate();
      toast.success("تمت إضافة الصنف إلى المخزن");
      setItemDialog(false); setItemName(""); setItemCategory("عام"); setItemUnit("قطعة"); setReorderLevel("2"); setDefaultUnitCost("0"); setOpeningQuantity("0"); setItemNotes("");
    },
    onError: error => toast.error(error.message || "تعذر إضافة الصنف. يرجى المحاولة مرة أخرى."),
  });
  const deleteItem = trpc.filters.inventory.deleteItem.useMutation({ onSuccess: () => { utils.filters.inventory.summary.invalidate(); utils.filters.dashboard.invalidate(); setPinAction(null); toast.success("تم حذف الصنف وحركاته المرتبطة"); }, onError: error => toast.error(error.message || "تعذر حذف الصنف.") });
  const deleteMovement = trpc.filters.inventory.deleteMovement.useMutation({ onSuccess: () => { utils.filters.inventory.summary.invalidate(); utils.filters.dashboard.invalidate(); setPinAction(null); toast.success("تم حذف حركة المخزن"); }, onError: error => toast.error(error.message || "تعذر حذف الحركة.") });
  const createMovement = trpc.filters.inventory.createMovement.useMutation({
    onSuccess: () => {
      utils.filters.inventory.summary.invalidate();
      utils.filters.dashboard.invalidate();
      toast.success(movementType === "outgoing" ? "تم تسجيل المنصرف وتحديث الرصيد" : "تم تسجيل الوارد وتحديث الرصيد");
      setMovementItem(null); setQuantity(""); setUnitCost(""); setMovementCurrency("SAR"); setTechnicianName(""); setMovementNotes("");
    },
    onError: error => toast.error(error.message || "تعذر تسجيل الحركة. يرجى المحاولة مرة أخرى."),
  });

  function submitItem(event: FormEvent) {
    event.preventDefault();
    const input = { name: itemName, category: itemCategory.trim() || "عام", unit: itemUnit.trim() || "قطعة", reorderLevel: Number(reorderLevel || 0), defaultUnitCost: Math.round(Number(defaultUnitCost || 0) * 100), openingQuantity: Number(openingQuantity || 0), notes: itemNotes || null };
    if (!navigator.onLine && owner) {
      const pending = queueOfflineInventoryItem(owner.id, input);
      const current = data as any;
      cacheOfflineInventory(owner.id, { ...current, items: [{ ...input, id: pending.localId, currentBalance: input.openingQuantity }, ...current.items], movements: current.movements ?? [] });
      toast.success("تم حفظ الصنف محليًا وستتم مزامنته عند عودة الإنترنت");
      setItemDialog(false); setItemName(""); setItemCategory("عام"); setItemUnit("قطعة"); setReorderLevel("2"); setDefaultUnitCost("0"); setOpeningQuantity("0"); setItemNotes("");
      return;
    }
    createItem.mutate(input);
  }
  function submitMovement(event: FormEvent) {
    event.preventDefault();
    if (!movementItem) return;
    const input = { inventoryItemId: movementItem.id, movementType, quantity: Number(quantity), unitCost: movementType === "incoming" ? Number(unitCost || 0) : 0, currency: movementCurrency, movementDate: new Date(movementDate), technicianName: technicianName || null, notes: movementNotes || null };
    if (!navigator.onLine && owner) {
      queueOfflineInventoryMovement(owner.id, { ...input, movementDate: input.movementDate.toISOString() });
      const current = data as any;
      const delta = movementType === "incoming" ? input.quantity : -input.quantity;
      cacheOfflineInventory(owner.id, { ...current, items: current.items.map((item: any) => item.id === movementItem.id ? { ...item, currentBalance: item.currentBalance + delta } : item), movements: [{ ...input, id: -Date.now(), movementDate: input.movementDate.toISOString(), inventoryItemName: movementItem.name }, ...(current.movements ?? [])] });
      toast.success("تم حفظ حركة المخزن محليًا وستتم مزامنتها عند عودة الإنترنت");
      setMovementItem(null); setQuantity(""); setUnitCost(""); setTechnicianName(""); setMovementNotes("");
      return;
    }
    createMovement.mutate(input);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="page-heading">إدارة المخزن</h1><p className="page-subheading">تابع الأصناف والرصيد وحركات الوارد والمنصرف من مكان واحد.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setItemDialog(true)} className="h-11 rounded-xl bg-teal-700 px-5 font-bold hover:bg-teal-800"><Plus className="ml-2 h-5 w-5" />إضافة صنف</Button>
          <span className="inline-flex h-11 items-center rounded-xl border border-teal-100 bg-teal-50 px-4 text-xs font-bold text-teal-800">الصرف يتم من بطاقة الصنف</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-teal-100 bg-white px-4 py-3 text-sm shadow-sm">
        <span className="font-bold text-teal-950">ملخص المخزن</span>
        <span className="text-slate-600">الأصناف: <strong className="text-teal-800">{inventoryStats.totalItems.toLocaleString("ar-SA")}</strong></span>
        <span className="text-slate-600">الرصيد: <strong className="text-teal-800">{inventoryStats.currentBalance.toLocaleString("ar-SA")}</strong></span>
        <span className={inventoryStats.lowStock ? "text-amber-700" : "text-emerald-700"}>يحتاج شراء: <strong>{inventoryStats.lowStock.toLocaleString("ar-SA")}</strong></span>
        <span className="text-slate-600">الوارد: <strong className="text-teal-800">{inventoryStats.incoming.toLocaleString("ar-SA")}</strong></span>
        <span className="text-slate-600">المنصرف: <strong className="text-amber-800">{inventoryStats.outgoing.toLocaleString("ar-SA")}</strong></span>
      </div>

      <section className="soft-card overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-right">
            <thead className="bg-teal-50/70 text-xs text-teal-950/65"><tr><th className="px-5 py-4 font-bold">رقم الصنف</th><th className="px-5 py-4 font-bold">نوع الصنف</th><th className="px-5 py-4 font-bold">الرصيد الافتتاحي</th><th className="px-5 py-4 font-bold">الرصيد الحالي</th><th className="px-5 py-4 font-bold">الحالة</th><th className="px-5 py-4 font-bold">إجراء</th></tr></thead>
            <tbody className="divide-y divide-teal-950/6">
              {data?.items.length ? data.items.map(item => <InventoryTableRow key={item.id} item={item} selected={item.id === selectedItemId} onMovement={() => openMovement({ id: item.id, name: item.name }, "outgoing")} onDelete={() => setPinAction({ kind: "item", id: item.id })} />) : <EmptyInventoryRow isLoading={isLoading} />}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-teal-950/6 md:hidden">
          {data?.items.length ? data.items.map(item => <div id={`inventory-item-${item.id}`} key={item.id} className={`space-y-4 p-5 ${item.id === selectedItemId ? "bg-teal-50 ring-2 ring-inset ring-teal-300" : ""}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-wide text-teal-700">رقم الصنف: {inventoryItemCode(item.id)}</p><p className="mt-1 text-lg font-extrabold leading-7 text-teal-950">{item.name} <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-sm font-black ${balanceTextClass(item.currentBalance, item.reorderLevel)} bg-current/10`}>({item.currentBalance})</span></p><div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{item.category}</span><span className="rounded-full bg-teal-50 px-2 py-1 text-teal-700">الوحدة: {item.unit}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">تنبيه عند: {item.reorderLevel}</span></div>{item.notes ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.notes}</p> : null}</div><StockBadge balance={item.currentBalance} reorderLevel={item.reorderLevel} /></div><div className="grid grid-cols-2 gap-3 rounded-xl bg-teal-50/60 p-3 text-sm"><div><p className="text-xs text-muted-foreground">الرصيد الافتتاحي</p><p className="mt-1 font-extrabold">{item.openingQuantity}</p></div><div><p className="text-xs text-muted-foreground">الرصيد الحالي</p><p className={`mt-1 text-lg font-extrabold ${balanceTextClass(item.currentBalance, item.reorderLevel)}`}>{item.currentBalance}</p></div></div><div className="grid gap-2 sm:grid-cols-2"><Button size="sm" variant="outline" onClick={() => openMovement({ id: item.id, name: item.name }, "outgoing")} className="w-full rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50"><PackagePlus className="ml-1 h-4 w-4" />صرف صنف</Button><Button size="sm" variant="outline" onClick={() => setPinAction({ kind: "item", id: item.id })} className="w-full rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50">حذف الصنف</Button></div></div>) : <EmptyInventoryCard isLoading={isLoading} />}
        </div>
      </section>

      <section className="soft-card overflow-hidden">
        <div className="border-b border-teal-950/6 p-5"><h2 className="font-extrabold">آخر حركات المخزن</h2><p className="mt-1 text-xs text-muted-foreground">الوارد والمنصرف مع تفاصيل الفني المستلم.</p></div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-right">
            <thead className="bg-teal-50/45 text-xs text-teal-950/65"><tr><th className="px-5 py-3 font-bold">التاريخ</th><th className="px-5 py-3 font-bold">الصنف</th><th className="px-5 py-3 font-bold">نوع الحركة</th><th className="px-5 py-3 font-bold">الكمية</th><th className="px-5 py-3 font-bold">الفني / المستلم</th><th className="px-5 py-3 font-bold">ملاحظات</th><th className="px-5 py-3 font-bold">إجراء</th></tr></thead>
            <tbody className="divide-y divide-teal-950/6">{data?.movements.length ? data.movements.map(movement => <MovementTableRow key={movement.id} movement={movement} onDelete={() => setPinAction({ kind: "movement", id: movement.id })} />) : <tr><td colSpan={7} className="p-10 text-center text-sm text-muted-foreground">لا توجد حركات في المخزن بعد.</td></tr>}</tbody>
          </table>
        </div>
        <div className="divide-y divide-teal-950/6 md:hidden">
          {data?.movements.length ? data.movements.map(movement => <div key={movement.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">الصنف</p><p className="mt-1 font-extrabold text-teal-950">{movement.inventoryItemName}</p></div><span className="font-extrabold">{movement.quantity} قطعة</span></div><div className="mt-3"><MovementType movementType={movement.movementType} /></div><div className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-muted-foreground"><p>التاريخ</p><p className="text-left text-teal-950">{formatDate(movement.movementDate)}</p>{movement.movementType === "incoming" ? <><p>إجمالي التكلفة</p><p className="text-left font-bold text-violet-800">{formatMoney((movement.unitCost ?? 0) * movement.quantity)}</p></> : null}<p>الفني / المستلم</p><p className="text-left text-teal-950">{movement.technicianName || "—"}</p>{movement.notes ? <><p>ملاحظات</p><p className="text-left text-teal-950">{movement.notes}</p></> : null}</div><Button size="sm" variant="outline" onClick={() => setPinAction({ kind: "movement", id: movement.id })} className="mt-4 w-full rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50">حذف الحركة</Button></div>) : <div className="p-10 text-center text-sm text-muted-foreground">لا توجد حركات في المخزن بعد.</div>}
        </div>
      </section>

      <PinVerificationDialog open={pinAction !== null} onOpenChange={open => { if (!open) setPinAction(null); }} busy={deleteItem.isPending || deleteMovement.isPending} title={pinAction?.kind === "item" ? "تأكيد حذف الصنف" : "تأكيد حذف حركة المخزن"} description={pinAction?.kind === "item" ? "سيتم حذف الصنف وجميع حركاته المرتبطة نهائيًا." : "سيتم حذف الحركة وسجل الشراء المرتبط بها إن وجد."} onConfirm={pin => { if (!pinAction) return; const target = pinAction.kind === "item" ? data.items.find((item: any) => item.id === pinAction.id) : data.movements.find((movement: any) => movement.id === pinAction.id); if (target) { const relatedMovements = pinAction.kind === "item" ? (data.movements ?? []).filter((movement: any) => movement.inventoryItemId === pinAction.id) : []; moveToTrash({ entityType: "inventory", entityLabel: pinAction.kind === "item" ? `صنف من المخزن: ${(target as any).name ?? "غير مسمى"}` : `حركة من المخزن: ${(target as any).inventoryItemName ?? "غير مسمى"}`, payload: { kind: pinAction.kind, target, relatedMovements } }); } if (!navigator.onLine && owner) { queueOfflineDelete(owner.id, { entity: pinAction.kind === "item" ? "inventoryItem" : "inventoryMovement", id: pinAction.id, pin }); const current = data as any; cacheOfflineInventory(owner.id, pinAction.kind === "item" ? { ...current, items: current.items.filter((item: any) => item.id !== pinAction.id), movements: (current.movements ?? []).filter((movement: any) => movement.inventoryItemId !== pinAction.id) } : { ...current, movements: (current.movements ?? []).filter((movement: any) => movement.id !== pinAction.id), items: current.items.map((item: any) => item) }); setPinAction(null); toast.success("تم الحذف محليًا وستتم مزامنته عند عودة الإنترنت"); } else if (pinAction.kind === "item") deleteItem.mutate({ id: pinAction.id, pin }); else deleteMovement.mutate({ id: pinAction.id, pin }); }} />
      <Dialog open={itemDialog} onOpenChange={setItemDialog}><DialogContent dir="rtl"><DialogHeader><DialogTitle>إضافة صنف إلى المخزن</DialogTitle></DialogHeader><form onSubmit={submitItem} className="space-y-4 py-2"><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">اسم الصنف</span><input className="field-input" value={itemName} onChange={event => setItemName(event.target.value)} required placeholder="مثال: شمعة كربون" /></label><label><span className="field-label">نوع الصنف</span><select className="field-input" value={INVENTORY_CATEGORY_OPTIONS.includes(itemCategory as typeof INVENTORY_CATEGORY_OPTIONS[number]) ? itemCategory : "أخرى"} onChange={event => setItemCategory(event.target.value === "أخرى" ? "" : event.target.value)}><option value="" disabled>اختر نوع الصنف</option>{INVENTORY_CATEGORY_OPTIONS.map(category => <option key={category} value={category}>{category}</option>)}</select>{(!itemCategory || !INVENTORY_CATEGORY_OPTIONS.includes(itemCategory as typeof INVENTORY_CATEGORY_OPTIONS[number])) ? <input className="field-input mt-2" value={itemCategory} onChange={event => setItemCategory(event.target.value)} placeholder="اكتب نوعًا مخصصًا" required /> : null}</label><label><span className="field-label">وحدة القياس</span><input className="field-input" value={itemUnit} onChange={event => setItemUnit(event.target.value)} placeholder="قطعة" /></label><label><span className="field-label">الرصيد الافتتاحي</span><input type="number" min="0" className="field-input" value={openingQuantity} onChange={event => setOpeningQuantity(event.target.value)} required /></label><label><span className="field-label">حد التنبيه</span><input type="number" min="0" className="field-input" value={reorderLevel} onChange={event => setReorderLevel(event.target.value)} /><p className="mt-1 text-xs text-muted-foreground">يظهر الصنف منخفضًا عند الوصول إليه.</p></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={itemNotes} onChange={event => setItemNotes(event.target.value)} placeholder="المقاس أو المورد أو أي ملاحظة مفيدة" /></label></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setItemDialog(false)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createItem.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createItem.isPending ? "جارٍ الحفظ…" : "إضافة الصنف"}</Button></div></form></DialogContent></Dialog>
      <Dialog open={Boolean(movementItem)} onOpenChange={open => !open && setMovementItem(null)}><DialogContent dir="rtl"><DialogHeader><DialogTitle>{movementType === "outgoing" ? "صرف صنف من المخزن" : "إضافة وارد للمخزن"}: {movementItem?.name}</DialogTitle></DialogHeader><form onSubmit={submitMovement} className="grid gap-4 py-2 sm:grid-cols-2"><label><span className="field-label">نوع الحركة</span><select className="field-input" value={movementType} onChange={event => setMovementType(event.target.value as "incoming" | "outgoing")}><option value="incoming">وارد</option><option value="outgoing">منصرف</option></select></label><label><span className="field-label">الكمية</span><input type="number" min="1" className="field-input" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label><label><span className="field-label">تاريخ الحركة</span><input type="datetime-local" className="field-input" value={movementDate} onChange={event => setMovementDate(event.target.value)} required /></label><label><span className="field-label">اسم الفني المستلم</span><input className="field-input" value={technicianName} onChange={event => setTechnicianName(event.target.value)} placeholder="يُفضّل للمنصرف" /></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={movementNotes} onChange={event => setMovementNotes(event.target.value)} /></label><div className="flex justify-end gap-3 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setMovementItem(null)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createMovement.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createMovement.isPending ? "جارٍ الحفظ…" : "حفظ الحركة"}</Button></div></form></DialogContent></Dialog>
    </div>
  );
}


function formatMoney(minorAmount: number) { return (minorAmount / 100).toLocaleString("ar-SA", { maximumFractionDigits: 2 }); }
function latestPurchaseUnitCost(itemId: number, movements: Array<{ inventoryItemId: number; movementType: string; unitCost?: number | null }>) { return movements.find(movement => movement.inventoryItemId === itemId && movement.movementType === "incoming" && (movement.unitCost ?? 0) > 0)?.unitCost ?? 0; }
function InventorySummaryCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "teal" | "amber" | "sky" | "violet" }) { const tones = { teal: "border-teal-200 bg-teal-50 text-teal-950", amber: "border-amber-200 bg-amber-50 text-amber-950", sky: "border-sky-200 bg-sky-50 text-sky-950", violet: "border-violet-200 bg-violet-50 text-violet-950" }; return <article className={`min-h-28 rounded-2xl border p-4 shadow-sm ${tones[tone]}`}><p className="text-xs font-bold opacity-75">{label}</p><p className="mt-2 text-xl font-black">{value}</p><p className="mt-1 text-[11px] opacity-70">{hint}</p></article>; }
function InventoryDecisionCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "teal" | "amber" | "green" }) { const tones = { teal: "border-teal-200 bg-teal-50 text-teal-950", amber: "border-amber-200 bg-amber-50 text-amber-950", green: "border-emerald-200 bg-emerald-50 text-emerald-950" }; return <article className={`min-h-36 rounded-2xl border p-4 shadow-sm ${tones[tone]}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold opacity-70">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div><span className="rounded-xl bg-white/80 p-2.5 shadow-sm">{icon}</span></div><p className="mt-3 truncate text-xs font-bold opacity-70" title={detail}>{detail}</p></article>; }
function balanceTextClass(balance: number, reorderLevel: number | null | undefined = 2) { const level = reorderLevel ?? 2; return balance <= 0 ? "text-rose-700" : balance <= level ? "text-amber-700" : "text-emerald-700"; }
function StockBadge({ balance, reorderLevel = 2 }: { balance: number; reorderLevel?: number | null }) { const level = reorderLevel ?? 2; return <Badge className={balance <= 0 ? "bg-rose-100 text-rose-800 hover:bg-rose-100" : balance <= level ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"}>{balance <= 0 ? "غير متوفر" : balance <= level ? "رصيد منخفض" : "متوفر"}</Badge>; }
function inventoryItemCode(id: number) { return `#${String(id).padStart(4, "0")}`; }
function InventoryTableRow({ item, onMovement, onDelete, selected }: { item: { id: number; name: string; category?: string | null; notes: string | null; openingQuantity: number; currentBalance: number; reorderLevel?: number | null }; onMovement: () => void; onDelete: () => void; selected?: boolean }) { return <tr id={`inventory-item-${item.id}`} className={selected ? "bg-teal-50 ring-2 ring-inset ring-teal-300" : "hover:bg-teal-50/45"}><td className="px-5 py-4 text-sm font-bold text-teal-700">{inventoryItemCode(item.id)}</td><td className="px-5 py-4"><p className="text-base font-extrabold text-teal-950">{item.name} <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-sm font-black ${balanceTextClass(item.currentBalance, item.reorderLevel)} bg-current/10`}>({item.currentBalance})</span></p><p className="mt-1 text-xs font-bold text-teal-700">{item.category || "عام"}</p>{item.notes ? <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">{item.notes}</p> : null}</td><td className="px-5 py-4">{item.openingQuantity}</td><td className={`px-5 py-4 text-lg font-extrabold ${balanceTextClass(item.currentBalance, item.reorderLevel)}`}>{item.currentBalance}</td><td className="px-5 py-4"><StockBadge balance={item.currentBalance} reorderLevel={item.reorderLevel} /></td><td className="px-5 py-4"><Button size="sm" variant="outline" onClick={onMovement} className="rounded-lg border-teal-700/20 text-teal-800 hover:bg-teal-50"><PackagePlus className="ml-1 h-4 w-4" />صرف صنف</Button><Button size="sm" variant="outline" onClick={onDelete} className="mr-2 rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50">حذف</Button></td></tr>; }
function EmptyInventoryRow({ isLoading }: { isLoading: boolean }) { return <tr><td colSpan={6} className="p-14 text-center"><Boxes className="mx-auto h-8 w-8 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل المخزن…" : "لا توجد أصناف مسجلة حتى الآن."}</p></td></tr>; }
function EmptyInventoryCard({ isLoading }: { isLoading: boolean }) { return <div className="p-12 text-center"><Boxes className="mx-auto h-8 w-8 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل المخزن…" : "لا توجد أصناف مسجلة حتى الآن."}</p></div>; }
function MovementType({ movementType }: { movementType: "incoming" | "outgoing" }) { return movementType === "incoming" ? <span className="inline-flex items-center gap-1 text-sm font-bold text-teal-700"><ArrowDownLeft className="h-4 w-4" />وارد</span> : <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-700"><ArrowUpRight className="h-4 w-4" />منصرف</span>; }
function MovementTableRow({ movement, onDelete }: { movement: { id: number; movementDate: Date; inventoryItemName: string; movementType: "incoming" | "outgoing"; quantity: number; unitCost?: number | null; technicianName: string | null; notes: string | null }; onDelete: () => void }) { return <tr><td className="px-5 py-4 text-sm">{formatDate(movement.movementDate)}</td><td className="px-5 py-4 font-bold text-teal-950">{movement.inventoryItemName}</td><td className="px-5 py-4"><MovementType movementType={movement.movementType} /></td><td className="px-5 py-4 font-extrabold">{movement.quantity}</td><td className="px-5 py-4 text-sm">{movement.technicianName || "—"}</td><td className="max-w-64 truncate px-5 py-4 text-sm text-muted-foreground">{movement.notes || "—"}</td><td className="px-5 py-4"><Button size="sm" variant="outline" onClick={onDelete} className="rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50">حذف</Button></td></tr>; }
