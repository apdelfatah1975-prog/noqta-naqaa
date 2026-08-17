import { Badge } from "@/components/ui/badge";
import { PinVerificationDialog } from "@/components/PinVerificationDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatDate, toDateTimeLocal } from "@/lib/filterUi";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Boxes, Droplets, Filter, PackagePlus, PackageSearch, Plus, Refrigerator, Snowflake } from "lucide-react";

const INVENTORY_CATEGORY_OPTIONS = ["فلتر ٧ مراحل كلاسيك", "فلاتر جامبو", "مبردة", "قارورة", "شمعات", "ممبرين", "وصلات", "مستلزمات تركيب", "أخرى"] as const;
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cacheOfflineInventory, getOfflineInventory, getOfflineSession, queueOfflineDelete, queueOfflineInventoryItem, queueOfflineInventoryMovement } from "@/lib/offlineSync";
import { moveToTrash } from "@/lib/trashBin";

export default function Inventory() {
  const [location, navigate] = useLocation();
  const selectedItemId = Number(new URLSearchParams(location.includes("?") ? location.split("?")[1] : window.location.search).get("item") ?? 0);
  const owner = getOfflineSession();
  const inventoryQuery = trpc.filters.inventory.summary.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const cachedInventory = getOfflineInventory<typeof inventoryQuery.data>(owner?.id ?? 0);
  const emptyInventory = { items: [], movements: [] } as unknown as NonNullable<typeof inventoryQuery.data>;
  const data = inventoryQuery.data ?? cachedInventory ?? emptyInventory;
  const isLoading = inventoryQuery.isLoading && !inventoryQuery.data && !cachedInventory;
  const isError = false;
  const lowStockItems = useMemo(() => data.items.filter(item => item.currentBalance <= (item.reorderLevel ?? 2)).slice(0, 3), [data]);
  useEffect(() => {
    if (!lowStockItems.length || typeof window === "undefined") return;
    const signature = lowStockItems.map(item => `${item.id}:${item.currentBalance}:${item.reorderLevel ?? 2}`).join("|");
    const storageKey = "purepoint-low-stock-alert";
    if (window.localStorage.getItem(storageKey) === signature) return;
    const names = lowStockItems.map(item => `${item.name} (${item.currentBalance})`).join("، ");
    toast.warning(`تنبيه المخزن: ${names}`, { description: "وصل الرصيد إلى الحد الأدنى أو انخفض عنه. يُرجى مراجعة الكمية." });
    window.localStorage.setItem(storageKey, signature);
  }, [lowStockItems]);
  useEffect(() => {
    if (inventoryQuery.data && owner) cacheOfflineInventory(owner.id, inventoryQuery.data);
  }, [inventoryQuery.data, owner]);
  useEffect(() => {
    if (!selectedItemId) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>(`[data-inventory-item-id="${selectedItemId}"]`));
    const target = targets.find(element => element.offsetParent !== null) ?? targets[0];
    if (target && typeof target.scrollIntoView === "function") target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedItemId, data.items.length]);
  const utils = trpc.useUtils();
  const [itemDialog, setItemDialog] = useState(false);
  const [movementItem, setMovementItem] = useState<{ id: number; name: string; defaultUnitCost?: number | null } | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("مستلزمات تركيب");
  const [itemUnit, setItemUnit] = useState("قطعة");
  const [reorderLevel, setReorderLevel] = useState("2");
  const [defaultUnitCost, setDefaultUnitCost] = useState("0");
  const [openingQuantity, setOpeningQuantity] = useState("0");
  const [itemNotes, setItemNotes] = useState("");
  const [movementType, setMovementType] = useState<"incoming" | "outgoing">("incoming");
  function focusInventoryItem(itemId: number) {
    navigate(`/inventory?item=${itemId}`);
    window.requestAnimationFrame(() => { const targets = Array.from(document.querySelectorAll<HTMLElement>(`[data-inventory-item-id="${itemId}"]`)); const target = targets.find(element => element.offsetParent !== null) ?? targets[0]; if (target && typeof target.scrollIntoView === "function") target.scrollIntoView({ behavior: "smooth", block: "center" }); });
  }
  function openMovement(item: { id: number; name: string; defaultUnitCost?: number | null }, type: "incoming" | "outgoing") {
    setMovementType(type);
    setMovementItem(item);
    setQuantity("");
    setUnitCost(type === "incoming" && (item.defaultUnitCost ?? 0) > 0 ? String((item.defaultUnitCost ?? 0) / 100) : "");
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
    onSuccess: result => {
      utils.filters.inventory.summary.invalidate();
      utils.filters.dashboard.invalidate();
      utils.filters.cash.summary.invalidate();
      toast.success(result.merged ? "الصنف موجود؛ تمت إضافة الكمية كوارد وتسجيل تكلفتها" : "تمت إضافة الصنف إلى المخزن");
      setItemDialog(false); setItemName(""); setItemCategory("مستلزمات تركيب"); setItemUnit("قطعة"); setReorderLevel("2"); setDefaultUnitCost("0"); setOpeningQuantity("0"); setItemNotes("");
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
      const existingItem = (data.items as any[]).find(item => String(item.name).trim().toLocaleLowerCase() === item.name.trim().toLocaleLowerCase());
      if (existingItem) {
        if (input.openingQuantity <= 0) {
          toast.info("الصنف موجود بالفعل؛ أدخل كمية أكبر من صفر لإضافة وارد.");
          return;
        }
        const movementInput = { inventoryItemId: existingItem.id, movementType: "incoming" as const, quantity: input.openingQuantity, unitCost: input.defaultUnitCost, currency: "SAR" as const, movementDate: new Date(), technicianName: null, notes: input.notes || `إضافة وارد للصنف الموجود: ${input.name}` };
        queueOfflineInventoryMovement(owner.id, { ...movementInput, movementDate: movementInput.movementDate.toISOString() });
        const current = data as any;
        cacheOfflineInventory(owner.id, { ...current, items: current.items.map((item: any) => item.id === existingItem.id ? { ...item, currentBalance: item.currentBalance + input.openingQuantity } : item), movements: [{ ...movementInput, id: -Date.now(), movementDate: movementInput.movementDate.toISOString(), inventoryItemName: existingItem.name }, ...(current.movements ?? [])] });
        toast.success("الصنف موجود؛ تم حفظ الوارد محليًا دون إنشاء بطاقة ثانية");
      } else {
        const pending = queueOfflineInventoryItem(owner.id, input);
        const current = data as any;
        cacheOfflineInventory(owner.id, { ...current, items: [{ ...input, id: pending.localId, currentBalance: input.openingQuantity }, ...current.items], movements: current.movements ?? [] });
        toast.success("تم حفظ الصنف محليًا وستتم مزامنته عند عودة الإنترنت");
      }
      setItemDialog(false); setItemName(""); setItemCategory("مستلزمات تركيب"); setItemUnit("قطعة"); setReorderLevel("2"); setDefaultUnitCost("0"); setOpeningQuantity("0"); setItemNotes("");
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
          <Button onClick={() => setItemDialog(true)} className="h-11 rounded-xl bg-teal-700 px-5 font-bold hover:bg-teal-800"><Plus className="ml-2 h-5 w-5" />إضافة صنف جديد</Button>
          <span className="inline-flex h-11 items-center rounded-xl border border-teal-100 bg-teal-50 px-4 text-xs font-bold text-teal-800">الصرف يتم من بطاقة الصنف</span>
        </div>
      </div>

      <section aria-labelledby="inventory-items-cards" className="rounded-2xl border border-teal-100 bg-teal-50/60 p-2.5 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h2 id="inventory-items-cards" className="text-sm font-extrabold text-teal-950">أصناف المخزن</h2>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-teal-700 ring-1 ring-teal-100">اختيار سريع</span>
        </div>
        {data.items.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {data.items.map(item => <button key={item.id} type="button" onClick={() => focusInventoryItem(item.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); focusInventoryItem(item.id); } }} className="inventory-item-card flex min-w-0 items-center gap-2 rounded-xl border border-white bg-white px-2.5 py-2.5 text-right shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`الصنف ${item.name}، رقم المخزون ${item.id}، الرصيد ${item.currentBalance}`}>
            <InventoryVisual compact category={item.category} name={item.name} customEmoji={item.customEmoji} imageUrl={item.imageUrl} />
            <span className="min-w-0"><span className="block truncate text-[13px] font-extrabold leading-5 text-teal-950">{item.name}</span><span className="mt-0.5 block text-xs font-bold text-slate-600">الرصيد: <b className={`text-sm ${balanceTextClass(item.currentBalance, item.reorderLevel)}`}>{item.currentBalance}</b></span></span>
          </button>)}
        </div> : <p className="px-2 py-3 text-center text-xs text-muted-foreground">ستظهر بطاقات الأصناف هنا بعد إضافة أول صنف.</p>}
      </section>

      <section className="soft-card overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-right">
            <thead className="bg-teal-50/70 text-xs text-teal-950/65"><tr><th className="px-5 py-4 font-bold">الصنف</th><th className="px-5 py-4 font-bold">الرصيد الافتتاحي</th><th className="px-5 py-4 font-bold">الرصيد الحالي</th><th className="px-5 py-4 font-bold">الحالة</th><th className="px-5 py-4 font-bold">إجراء</th></tr></thead>
            <tbody className="divide-y divide-teal-950/6">
              {data?.items.length ? data.items.map(item => <InventoryTableRow key={item.id} item={item} selected={item.id === selectedItemId} onMovement={() => openMovement({ id: item.id, name: item.name, defaultUnitCost: item.defaultUnitCost }, "outgoing")} onIncoming={() => openMovement({ id: item.id, name: item.name, defaultUnitCost: item.defaultUnitCost }, "incoming")} onDelete={() => setPinAction({ kind: "item", id: item.id })} />) : <EmptyInventoryRow isLoading={isLoading} />}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-teal-950/6 md:hidden">
        <div className="divide-y divide-teal-950/6 md:hidden">
          {data?.items.length ? data.items.map(item => (
            <div data-inventory-item-id={item.id} key={item.id} className={`inventory-item-row space-y-4 p-5 transition-[background-color,box-shadow] duration-500 ease-out ${item.id === selectedItemId ? "inventory-item-row-selected bg-orange-100 ring-2 ring-inset ring-orange-500 shadow-[inset_0_0_0_1px_rgba(249,115,22,.45)]" : "hover:bg-teal-50/40"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <InventoryVisual category={item.category} name={item.name} customEmoji={item.customEmoji} imageUrl={item.imageUrl} />
                  <div className="min-w-0">
                    <p className="mt-1 text-lg font-extrabold leading-7 text-teal-950">{item.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{item.category}</span>
                      <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-700">الوحدة: {item.unit}</span>
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">تنبيه عند: {item.reorderLevel}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">أضيف في: {formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <StockBadge balance={item.currentBalance} reorderLevel={item.reorderLevel} />
              </div>
              {item.notes ? <p className="text-xs leading-5 text-muted-foreground">{item.notes}</p> : null}
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-teal-50/60 p-3 text-sm">
                <div><p className="text-xs text-muted-foreground">الرصيد الافتتاحي</p><p className="mt-1 font-extrabold">{item.openingQuantity}</p></div>
                <div><p className="text-xs text-muted-foreground">الرصيد الحالي</p><p className={`mt-1 text-lg font-extrabold ${balanceTextClass(item.currentBalance, item.reorderLevel)}`}>{item.currentBalance}</p></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => openMovement({ id: item.id, name: item.name, defaultUnitCost: item.defaultUnitCost }, "incoming")} className="w-full rounded-xl border-emerald-200 text-emerald-800 hover:bg-emerald-50"><PackagePlus className="ml-1 h-4 w-4" />إضافة وارد</Button><Button size="sm" variant="outline" onClick={() => openMovement({ id: item.id, name: item.name, defaultUnitCost: item.defaultUnitCost }, "outgoing")} className="w-full rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50"><PackagePlus className="ml-1 h-4 w-4" />صرف صنف</Button></div>
                <Button size="sm" variant="outline" onClick={() => setPinAction({ kind: "item", id: item.id })} className="w-full rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50">حذف الصنف</Button>
              </div>
            </div>
          )) : <EmptyInventoryCard isLoading={isLoading} />}
        </div>
        </div>
      </section>

      <section className="soft-card overflow-hidden">
        <div className="border-b border-teal-950/6 p-5"><h2 className="font-extrabold">آخر حركات المخزن</h2><p className="mt-1 text-xs text-muted-foreground">الوارد والمنصرف مع تفاصيل الفني المستلم.</p></div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-right">
            <thead className="bg-teal-50/45 text-xs text-teal-950/65"><tr><th className="px-5 py-3 font-bold">التاريخ</th><th className="px-5 py-3 font-bold">الصنف</th><th className="px-5 py-3 font-bold">نوع الحركة</th><th className="px-5 py-3 font-bold">الكمية</th><th className="px-5 py-3 font-bold">التكلفة</th><th className="px-5 py-3 font-bold">الفني / المستلم</th><th className="px-5 py-3 font-bold">ملاحظات</th><th className="px-5 py-3 font-bold">إجراء</th></tr></thead>
            <tbody className="divide-y divide-teal-950/6">{data?.movements.length ? data.movements.map(movement => <MovementTableRow key={movement.id} movement={movement} onDelete={() => setPinAction({ kind: "movement", id: movement.id })} />) : <tr><td colSpan={8} className="p-10 text-center text-sm text-muted-foreground">لا توجد حركات في المخزن بعد.</td></tr>}</tbody>
          </table>
        </div>
        <div className="divide-y divide-teal-950/6 md:hidden">
          {data?.movements.length ? data.movements.map(movement => <div key={movement.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">الصنف</p><p className="mt-1 font-extrabold text-teal-950">{movement.inventoryItemName}</p></div><span className="font-extrabold">{movement.quantity} قطعة</span></div><div className="mt-3"><MovementType movementType={movement.movementType} /></div><div className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-muted-foreground"><p>التاريخ</p><p className="text-left text-teal-950">{formatDate(movement.movementDate)}</p>{movement.movementType === "incoming" ? <><p>إجمالي التكلفة</p><p className="text-left font-bold text-violet-800">{formatMoney((movement.unitCost ?? 0) * movement.quantity)}</p></> : null}<p>الفني / المستلم</p><p className="text-left text-teal-950">{movement.technicianName || "—"}</p>{movement.notes ? <><p>ملاحظات</p><p className="text-left text-teal-950">{movement.notes}</p></> : null}</div><Button size="sm" variant="outline" onClick={() => setPinAction({ kind: "movement", id: movement.id })} className="mt-4 w-full rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50">حذف الحركة</Button></div>) : <div className="p-10 text-center text-sm text-muted-foreground">لا توجد حركات في المخزن بعد.</div>}
        </div>
      </section>

      <PinVerificationDialog open={pinAction !== null} onOpenChange={open => { if (!open) setPinAction(null); }} busy={deleteItem.isPending || deleteMovement.isPending} title={pinAction?.kind === "item" ? "تأكيد حذف الصنف" : "تأكيد حذف حركة المخزن"} description={pinAction?.kind === "item" ? "سيتم حذف الصنف وجميع حركاته المرتبطة نهائيًا." : "سيتم حذف الحركة وسجل الشراء المرتبط بها إن وجد."} onConfirm={pin => { if (!pinAction) return; const target = pinAction.kind === "item" ? data.items.find((item: any) => item.id === pinAction.id) : data.movements.find((movement: any) => movement.id === pinAction.id); if (target) { const relatedMovements = pinAction.kind === "item" ? (data.movements ?? []).filter((movement: any) => movement.inventoryItemId === pinAction.id) : []; moveToTrash({ entityType: "inventory", entityLabel: pinAction.kind === "item" ? `صنف من المخزن: ${(target as any).name ?? "غير مسمى"}` : `حركة من المخزن: ${(target as any).inventoryItemName ?? "غير مسمى"}`, payload: { kind: pinAction.kind, target, relatedMovements } }); } if (!navigator.onLine && owner) { queueOfflineDelete(owner.id, { entity: pinAction.kind === "item" ? "inventoryItem" : "inventoryMovement", id: pinAction.id, pin }); const current = data as any; cacheOfflineInventory(owner.id, pinAction.kind === "item" ? { ...current, items: current.items.filter((item: any) => item.id !== pinAction.id), movements: (current.movements ?? []).filter((movement: any) => movement.inventoryItemId !== pinAction.id) } : { ...current, movements: (current.movements ?? []).filter((movement: any) => movement.id !== pinAction.id), items: current.items.map((item: any) => item) }); setPinAction(null); toast.success("تم الحذف محليًا وستتم مزامنته عند عودة الإنترنت"); } else if (pinAction.kind === "item") deleteItem.mutate({ id: pinAction.id, pin }); else deleteMovement.mutate({ id: pinAction.id, pin }); }} />
      <Dialog open={itemDialog} onOpenChange={setItemDialog}><DialogContent dir="rtl"><DialogHeader><DialogTitle>إضافة صنف جديد إلى المخزن</DialogTitle><p className="text-sm text-muted-foreground">اكتب اسم الصنف والكمية، ثم احفظ. باقي البيانات اختيارية ويمكن تعديلها لاحقًا.</p></DialogHeader><form onSubmit={submitItem} className="space-y-4 py-2"><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">اسم الصنف</span><input className="field-input" value={itemName} onChange={event => setItemName(event.target.value)} required placeholder="مثال: شمعة كربون أو فلتر جامبو" /></label><label><span className="field-label">نوع الصنف</span><select className="field-input" value={INVENTORY_CATEGORY_OPTIONS.includes(itemCategory as typeof INVENTORY_CATEGORY_OPTIONS[number]) ? itemCategory : "أخرى"} onChange={event => setItemCategory(event.target.value === "أخرى" ? "" : event.target.value)}><option value="" disabled>اختر نوع الصنف</option>{INVENTORY_CATEGORY_OPTIONS.map(category => <option key={category} value={category}>{category}</option>)}</select>{(!itemCategory || !INVENTORY_CATEGORY_OPTIONS.includes(itemCategory as typeof INVENTORY_CATEGORY_OPTIONS[number])) ? <input className="field-input mt-2" value={itemCategory} onChange={event => setItemCategory(event.target.value)} placeholder="اكتب نوعًا مخصصًا" required /> : null}</label><label><span className="field-label">وحدة القياس</span><input className="field-input" value={itemUnit} onChange={event => setItemUnit(event.target.value)} placeholder="قطعة" /></label><label><span className="field-label">الرصيد الافتتاحي</span><input type="number" min="0" className="field-input" value={openingQuantity} onChange={event => setOpeningQuantity(event.target.value)} required /></label><label><span className="field-label">الحد الأدنى للرصيد</span><input type="number" min="0" className="field-input" value={reorderLevel} onChange={event => setReorderLevel(event.target.value)} /><p className="mt-1 text-xs text-muted-foreground">يظهر تنبيه تلقائي عند وصول الرصيد إلى هذا الحد أو انخفاضه عنه.</p></label><label><span className="field-label">سعر شراء القطعة</span><input type="number" min="0" step="0.01" inputMode="decimal" className="field-input" value={defaultUnitCost} onChange={event => setDefaultUnitCost(event.target.value)} placeholder="0" /><p className="mt-1 text-xs text-muted-foreground">يُستخدم تلقائيًا عند تسجيل الوارد لخصم التكلفة من الخزينة.</p></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={itemNotes} onChange={event => setItemNotes(event.target.value)} placeholder="المقاس أو المورد أو أي ملاحظة مفيدة" /></label></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setItemDialog(false)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createItem.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createItem.isPending ? "جارٍ الحفظ…" : "إضافة الصنف"}</Button></div></form></DialogContent></Dialog>
      <Dialog open={Boolean(movementItem)} onOpenChange={open => !open && setMovementItem(null)}><DialogContent dir="rtl"><DialogHeader><DialogTitle>{movementType === "outgoing" ? "صرف صنف من المخزن" : "إضافة وارد للمخزن"}: {movementItem?.name}</DialogTitle></DialogHeader><form onSubmit={submitMovement} className="grid gap-4 py-2 sm:grid-cols-2"><label><span className="field-label">نوع الحركة</span><select className="field-input" value={movementType} onChange={event => setMovementType(event.target.value as "incoming" | "outgoing")}><option value="incoming">وارد</option><option value="outgoing">منصرف</option></select></label><label><span className="field-label">الكمية</span><input type="number" min="1" className="field-input" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label>{movementType === "incoming" ? <label><span className="field-label">سعر شراء القطعة</span><input type="number" min="0" step="0.01" inputMode="decimal" className="field-input" value={unitCost} onChange={event => setUnitCost(event.target.value)} required /><p className="mt-1 text-xs text-muted-foreground">سيُخصم إجمالي الكمية × السعر من الخزينة تلقائيًا.</p><p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-800">إجمالي الخصم المتوقع: {(Math.max(0, Number(quantity) || 0) * Math.max(0, Number(unitCost) || 0)).toFixed(2)}</p></label> : null}<label><span className="field-label">تاريخ الحركة</span><input type="datetime-local" className="field-input" value={movementDate} onChange={event => setMovementDate(event.target.value)} required /></label><label><span className="field-label">اسم الفني المستلم</span><input className="field-input" value={technicianName} onChange={event => setTechnicianName(event.target.value)} placeholder="يُفضّل للمنصرف" /></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={movementNotes} onChange={event => setMovementNotes(event.target.value)} /></label><div className="flex justify-end gap-3 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setMovementItem(null)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createMovement.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createMovement.isPending ? "جارٍ الحفظ…" : "حفظ الحركة"}</Button></div></form></DialogContent></Dialog>
    </div>
  );
}


function formatMoney(minorAmount: number) { return (minorAmount / 100).toLocaleString("ar-SA", { maximumFractionDigits: 2 }); }
function latestPurchaseUnitCost(itemId: number, movements: Array<{ inventoryItemId: number; movementType: string; unitCost?: number | null }>) { return movements.find(movement => movement.inventoryItemId === itemId && movement.movementType === "incoming" && (movement.unitCost ?? 0) > 0)?.unitCost ?? 0; }
function InventorySummaryCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "teal" | "amber" | "sky" | "violet" }) { const tones = { teal: "border-teal-200 bg-teal-50 text-teal-950", amber: "border-amber-200 bg-amber-50 text-amber-950", sky: "border-sky-200 bg-sky-50 text-sky-950", violet: "border-violet-200 bg-violet-50 text-violet-950" }; return <article className={`min-h-28 rounded-2xl border p-4 shadow-sm ${tones[tone]}`}><p className="text-xs font-bold opacity-75">{label}</p><p className="mt-2 text-xl font-black">{value}</p><p className="mt-1 text-[11px] opacity-70">{hint}</p></article>; }
function InventoryDecisionCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "teal" | "amber" | "green" }) { const tones = { teal: "border-teal-200 bg-teal-50 text-teal-950", amber: "border-amber-200 bg-amber-50 text-amber-950", green: "border-emerald-200 bg-emerald-50 text-emerald-950" }; return <article className={`min-h-36 rounded-2xl border p-4 shadow-sm ${tones[tone]}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold opacity-70">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div><span className="rounded-xl bg-white/80 p-2.5 shadow-sm">{icon}</span></div><p className="mt-3 truncate text-xs font-bold opacity-70" title={detail}>{detail}</p></article>; }
function balanceTextClass(balance: number, reorderLevel: number | null | undefined = 2) { const level = reorderLevel ?? 2; return balance <= 0 ? "text-rose-700" : balance <= level ? "text-amber-700" : "text-emerald-700"; }
function StockBadge({ balance, reorderLevel = 2 }: { balance: number; reorderLevel?: number | null }) { const level = reorderLevel ?? 2; return <Badge className={balance <= 0 ? "bg-rose-100 text-rose-800 hover:bg-rose-100" : balance <= level ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"}>{balance <= 0 ? "غير متوفر" : balance <= level ? "رصيد منخفض" : "متوفر"}</Badge>; }
function inventoryVisual(category?: string | null, name?: string) {
  const value = `${category ?? ""} ${name ?? ""}`;
  if (value.includes("مبرد") || value.includes("ثلاج")) return { icon: Refrigerator, tone: "bg-sky-100 text-sky-700" };
  if (value.includes("قارور") || value.includes("زجاج") || value.includes("عبو")) return { icon: Droplets, tone: "bg-cyan-100 text-cyan-700" };
  if (value.includes("فلتر") || value.includes("شمع") || value.includes("ممبرين")) return { icon: Filter, tone: "bg-teal-100 text-teal-700" };
  if (value.includes("ثلج") || value.includes("تبريد")) return { icon: Snowflake, tone: "bg-indigo-100 text-indigo-700" };
  return { icon: PackageSearch, tone: "bg-violet-100 text-violet-700" };
}
function InventoryVisual({ category, name, customEmoji, imageUrl, compact = false }: { category?: string | null; name?: string; customEmoji?: string | null; imageUrl?: string | null; compact?: boolean }) { const visual = inventoryVisual(category, name); const Icon = visual.icon; return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${compact ? "h-8 w-8 rounded-xl" : "h-11 w-11 rounded-2xl"} ${visual.tone}`}>{imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : customEmoji ? <span className={`${compact ? "text-lg" : "text-2xl"} leading-none`}>{customEmoji}</span> : <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />}</span>; }
function InventoryTableRow({ item, onMovement, onIncoming, onDelete, selected }: { item: { id: number; name: string; category?: string | null; customEmoji?: string | null; imageUrl?: string | null; notes: string | null; openingQuantity: number; currentBalance: number; reorderLevel?: number | null; defaultUnitCost?: number | null; createdAt?: Date | string | null }; onMovement: () => void; onIncoming: () => void; onDelete: () => void; selected?: boolean }) {
  return <tr data-inventory-item-id={item.id} className={`inventory-item-row transition-[background-color,box-shadow] duration-500 ease-out ${selected ? "inventory-item-row-selected bg-orange-100 ring-2 ring-inset ring-orange-500 shadow-[inset_0_0_0_1px_rgba(249,115,22,.45)]" : "hover:bg-teal-50/45"}`}>
    <td className="px-5 py-4"><div className="flex items-center gap-3"><InventoryVisual category={item.category} name={item.name} customEmoji={item.customEmoji} imageUrl={item.imageUrl} /><div><p className="mt-1 text-base font-extrabold text-teal-950">{item.name}</p><p className="mt-1 text-xs font-bold text-teal-700">{item.category || "عام"}</p><p className="mt-1 text-xs text-muted-foreground">أضيف في: {formatDate(item.createdAt)}</p>{item.notes ? <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">{item.notes}</p> : null}</div></div></td>
    <td className="px-5 py-4">{item.openingQuantity}</td><td className={`px-5 py-4 text-lg font-extrabold ${balanceTextClass(item.currentBalance, item.reorderLevel)}`}>{item.currentBalance}</td><td className="px-5 py-4"><StockBadge balance={item.currentBalance} reorderLevel={item.reorderLevel} /></td><td className="px-5 py-4"><Button size="sm" variant="outline" onClick={onIncoming} className="rounded-lg border-emerald-200 text-emerald-800 hover:bg-emerald-50"><PackagePlus className="ml-1 h-4 w-4" />إضافة وارد</Button><Button size="sm" variant="outline" onClick={onMovement} className="mr-2 rounded-lg border-teal-700/20 text-teal-800 hover:bg-teal-50"><PackagePlus className="ml-1 h-4 w-4" />صرف صنف</Button><Button size="sm" variant="outline" onClick={onDelete} className="mr-2 rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50">حذف</Button></td>
  </tr>;
}
function EmptyInventoryRow({ isLoading }: { isLoading: boolean }) { return <tr><td colSpan={5} className="p-14 text-center"><Boxes className="mx-auto h-8 w-8 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل المخزن…" : "لا توجد أصناف مسجلة حتى الآن."}</p></td></tr>; }
function EmptyInventoryCard({ isLoading }: { isLoading: boolean }) { return <div className="p-12 text-center"><Boxes className="mx-auto h-8 w-8 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل المخزن…" : "لا توجد أصناف مسجلة حتى الآن."}</p></div>; }
function MovementType({ movementType }: { movementType: "incoming" | "outgoing" }) { return movementType === "incoming" ? <span className="inline-flex items-center gap-1 text-sm font-bold text-teal-700"><ArrowDownLeft className="h-4 w-4" />وارد</span> : <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-700"><ArrowUpRight className="h-4 w-4" />منصرف</span>; }
function MovementTableRow({ movement, onDelete }: { movement: { id: number; movementDate: Date; inventoryItemName: string; movementType: "incoming" | "outgoing"; quantity: number; unitCost?: number | null; technicianName: string | null; notes: string | null }; onDelete: () => void }) { const totalCost = (movement.unitCost ?? 0) * movement.quantity; return <tr><td className="px-5 py-4 text-sm">{formatDate(movement.movementDate)}</td><td className="px-5 py-4 font-bold text-teal-950">{movement.inventoryItemName}</td><td className="px-5 py-4"><MovementType movementType={movement.movementType} /></td><td className="px-5 py-4 font-extrabold">{movement.quantity}</td><td className="px-5 py-4 text-sm">{movement.movementType === "incoming" ? <div><p className="font-bold text-violet-800">سعر الوحدة: {formatMoney(movement.unitCost ?? 0)}</p><p className="mt-1 text-xs text-violet-700">الإجمالي: {formatMoney(totalCost)}</p></div> : <span className="text-muted-foreground">—</span>}</td><td className="px-5 py-4 text-sm">{movement.technicianName || "—"}</td><td className="max-w-64 truncate px-5 py-4 text-sm text-muted-foreground">{movement.notes || "—"}</td><td className="px-5 py-4"><Button size="sm" variant="outline" onClick={onDelete} className="rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50">حذف</Button></td></tr>; }
