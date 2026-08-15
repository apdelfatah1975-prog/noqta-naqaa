import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatDate, toDateTimeLocal } from "@/lib/filterUi";
import { ArrowDownLeft, ArrowUpRight, Boxes, PackagePlus, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export default function Inventory() {
  const { data, isLoading, isError } = trpc.filters.inventory.summary.useQuery();
  const utils = trpc.useUtils();
  const [itemDialog, setItemDialog] = useState(false);
  const [movementItem, setMovementItem] = useState<{ id: number; name: string } | null>(null);
  const [itemName, setItemName] = useState("");
  const [openingQuantity, setOpeningQuantity] = useState("0");
  const [itemNotes, setItemNotes] = useState("");
  const [movementType, setMovementType] = useState<"incoming" | "outgoing">("incoming");
  const [quantity, setQuantity] = useState("");
  const [movementDate, setMovementDate] = useState(toDateTimeLocal());
  const [technicianName, setTechnicianName] = useState("");
  const [movementNotes, setMovementNotes] = useState("");

  const createItem = trpc.filters.inventory.createItem.useMutation({
    onSuccess: () => {
      utils.filters.inventory.summary.invalidate();
      utils.filters.dashboard.invalidate();
      toast.success("تمت إضافة الصنف للمخزنة");
      setItemDialog(false); setItemName(""); setOpeningQuantity("0"); setItemNotes("");
    },
    onError: error => toast.error(error.message || "تعذر إضافة الصنف. يرجى المحاولة مرة أخرى."),
  });
  const createMovement = trpc.filters.inventory.createMovement.useMutation({
    onSuccess: () => {
      utils.filters.inventory.summary.invalidate();
      utils.filters.dashboard.invalidate();
      toast.success("تم تسجيل حركة المخزنة");
      setMovementItem(null); setQuantity(""); setTechnicianName(""); setMovementNotes("");
    },
    onError: error => toast.error(error.message || "تعذر تسجيل الحركة. يرجى المحاولة مرة أخرى."),
  });

  function submitItem(event: FormEvent) {
    event.preventDefault();
    createItem.mutate({ name: itemName, openingQuantity: Number(openingQuantity || 0), notes: itemNotes || null });
  }
  function submitMovement(event: FormEvent) {
    event.preventDefault();
    if (!movementItem) return;
    createMovement.mutate({ inventoryItemId: movementItem.id, movementType, quantity: Number(quantity), movementDate: new Date(movementDate), technicianName: technicianName || null, notes: movementNotes || null });
  }

  if (isError) return <div className="soft-card p-8 text-center"><p className="font-bold text-teal-950">تعذر تحميل بيانات المخزنة.</p><p className="mt-2 text-sm text-muted-foreground">تحقق من الاتصال ثم أعد المحاولة.</p><Button onClick={() => window.location.reload()} variant="outline" className="mt-4 rounded-xl">إعادة المحاولة</Button></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="page-heading">إدارة المخزنة</h1><p className="page-subheading">راقب الأرصدة وحركة الوارد والمنصرف لكل صنف.</p></div>
        <Button onClick={() => setItemDialog(true)} className="h-11 rounded-xl bg-teal-700 px-5 font-bold hover:bg-teal-800"><Plus className="ml-2 h-5 w-5" />إضافة صنف</Button>
      </div>

      <section className="soft-card overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] text-right">
            <thead className="bg-teal-50/70 text-xs text-teal-950/65"><tr><th className="px-5 py-4 font-bold">الصنف</th><th className="px-5 py-4 font-bold">الرصيد الافتتاحي</th><th className="px-5 py-4 font-bold">الرصيد الحالي</th><th className="px-5 py-4 font-bold">الحالة</th><th className="px-5 py-4 font-bold">إجراء</th></tr></thead>
            <tbody className="divide-y divide-teal-950/6">
              {data?.items.length ? data.items.map(item => <InventoryTableRow key={item.id} item={item} onMovement={() => setMovementItem({ id: item.id, name: item.name })} />) : <EmptyInventoryRow isLoading={isLoading} />}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-teal-950/6 md:hidden">
          {data?.items.length ? data.items.map(item => <div key={item.id} className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{item.name}</p>{item.notes ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.notes}</p> : null}</div><StockBadge balance={item.currentBalance} /></div><div className="grid grid-cols-2 gap-3 rounded-xl bg-teal-50/60 p-3 text-sm"><div><p className="text-xs text-muted-foreground">الرصيد الافتتاحي</p><p className="mt-1 font-extrabold">{item.openingQuantity}</p></div><div><p className="text-xs text-muted-foreground">الرصيد الحالي</p><p className="mt-1 text-lg font-extrabold text-teal-800">{item.currentBalance}</p></div></div><Button size="sm" variant="outline" onClick={() => setMovementItem({ id: item.id, name: item.name })} className="w-full rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50"><PackagePlus className="ml-1 h-4 w-4" />تسجيل حركة</Button></div>) : <EmptyInventoryCard isLoading={isLoading} />}
        </div>
      </section>

      <section className="soft-card overflow-hidden">
        <div className="border-b border-teal-950/6 p-5"><h2 className="font-extrabold">آخر حركات المخزنة</h2><p className="mt-1 text-xs text-muted-foreground">الوارد والمنصرف مع تفاصيل الفني المستلم.</p></div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-right">
            <thead className="bg-teal-50/45 text-xs text-teal-950/65"><tr><th className="px-5 py-3 font-bold">التاريخ</th><th className="px-5 py-3 font-bold">الحركة</th><th className="px-5 py-3 font-bold">الكمية</th><th className="px-5 py-3 font-bold">الفني</th><th className="px-5 py-3 font-bold">ملاحظات</th></tr></thead>
            <tbody className="divide-y divide-teal-950/6">{data?.movements.length ? data.movements.map(movement => <MovementTableRow key={movement.id} movement={movement} />) : <tr><td colSpan={5} className="p-10 text-center text-sm text-muted-foreground">لا توجد حركات مخزنة بعد.</td></tr>}</tbody>
          </table>
        </div>
        <div className="divide-y divide-teal-950/6 md:hidden">
          {data?.movements.length ? data.movements.map(movement => <div key={movement.id} className="p-5"><div className="flex items-center justify-between"><MovementType movementType={movement.movementType} /><span className="font-extrabold">{movement.quantity} قطعة</span></div><div className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-muted-foreground"><p>التاريخ</p><p className="text-left text-teal-950">{formatDate(movement.movementDate)}</p><p>الفني</p><p className="text-left text-teal-950">{movement.technicianName || "—"}</p>{movement.notes ? <><p>ملاحظات</p><p className="text-left text-teal-950">{movement.notes}</p></> : null}</div></div>) : <div className="p-10 text-center text-sm text-muted-foreground">لا توجد حركات مخزنة بعد.</div>}
        </div>
      </section>

      <Dialog open={itemDialog} onOpenChange={setItemDialog}><DialogContent dir="rtl"><DialogHeader><DialogTitle>إضافة صنف للمخزنة</DialogTitle></DialogHeader><form onSubmit={submitItem} className="space-y-4 py-2"><label><span className="field-label">اسم الصنف</span><input className="field-input" value={itemName} onChange={event => setItemName(event.target.value)} required placeholder="مثال: شمعة كربون" /></label><label><span className="field-label">الرصيد الافتتاحي</span><input type="number" min="0" className="field-input" value={openingQuantity} onChange={event => setOpeningQuantity(event.target.value)} required /></label><label><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={itemNotes} onChange={event => setItemNotes(event.target.value)} /></label><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setItemDialog(false)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createItem.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createItem.isPending ? "جارٍ الحفظ…" : "إضافة الصنف"}</Button></div></form></DialogContent></Dialog>
      <Dialog open={Boolean(movementItem)} onOpenChange={open => !open && setMovementItem(null)}><DialogContent dir="rtl"><DialogHeader><DialogTitle>حركة مخزنة: {movementItem?.name}</DialogTitle></DialogHeader><form onSubmit={submitMovement} className="grid gap-4 py-2 sm:grid-cols-2"><label><span className="field-label">نوع الحركة</span><select className="field-input" value={movementType} onChange={event => setMovementType(event.target.value as "incoming" | "outgoing")}><option value="incoming">وارد</option><option value="outgoing">منصرف</option></select></label><label><span className="field-label">الكمية</span><input type="number" min="1" className="field-input" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label><label><span className="field-label">تاريخ الحركة</span><input type="datetime-local" className="field-input" value={movementDate} onChange={event => setMovementDate(event.target.value)} required /></label><label><span className="field-label">اسم الفني المستلم</span><input className="field-input" value={technicianName} onChange={event => setTechnicianName(event.target.value)} placeholder="يُفضّل للمنصرف" /></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={movementNotes} onChange={event => setMovementNotes(event.target.value)} /></label><div className="flex justify-end gap-3 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setMovementItem(null)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createMovement.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createMovement.isPending ? "جارٍ الحفظ…" : "حفظ الحركة"}</Button></div></form></DialogContent></Dialog>
    </div>
  );
}

function StockBadge({ balance }: { balance: number }) { return <Badge className={balance <= 2 ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-teal-100 text-teal-800 hover:bg-teal-100"}>{balance <= 2 ? "رصيد منخفض" : "متوفر"}</Badge>; }
function InventoryTableRow({ item, onMovement }: { item: { id: number; name: string; notes: string | null; openingQuantity: number; currentBalance: number }; onMovement: () => void }) { return <tr className="hover:bg-teal-50/45"><td className="px-5 py-4"><p className="font-extrabold">{item.name}</p>{item.notes ? <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">{item.notes}</p> : null}</td><td className="px-5 py-4">{item.openingQuantity}</td><td className="px-5 py-4 text-lg font-extrabold text-teal-800">{item.currentBalance}</td><td className="px-5 py-4"><StockBadge balance={item.currentBalance} /></td><td className="px-5 py-4"><Button size="sm" variant="outline" onClick={onMovement} className="rounded-lg border-teal-700/20 text-teal-800 hover:bg-teal-50"><PackagePlus className="ml-1 h-4 w-4" />حركة</Button></td></tr>; }
function EmptyInventoryRow({ isLoading }: { isLoading: boolean }) { return <tr><td colSpan={5} className="p-14 text-center"><Boxes className="mx-auto h-8 w-8 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل المخزنة…" : "لا توجد أصناف مسجلة حتى الآن."}</p></td></tr>; }
function EmptyInventoryCard({ isLoading }: { isLoading: boolean }) { return <div className="p-12 text-center"><Boxes className="mx-auto h-8 w-8 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل المخزنة…" : "لا توجد أصناف مسجلة حتى الآن."}</p></div>; }
function MovementType({ movementType }: { movementType: "incoming" | "outgoing" }) { return movementType === "incoming" ? <span className="inline-flex items-center gap-1 text-sm font-bold text-teal-700"><ArrowDownLeft className="h-4 w-4" />وارد</span> : <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-700"><ArrowUpRight className="h-4 w-4" />منصرف</span>; }
function MovementTableRow({ movement }: { movement: { id: number; movementDate: Date; movementType: "incoming" | "outgoing"; quantity: number; technicianName: string | null; notes: string | null } }) { return <tr><td className="px-5 py-4 text-sm">{formatDate(movement.movementDate)}</td><td className="px-5 py-4"><MovementType movementType={movement.movementType} /></td><td className="px-5 py-4 font-extrabold">{movement.quantity}</td><td className="px-5 py-4 text-sm">{movement.technicianName || "—"}</td><td className="max-w-64 truncate px-5 py-4 text-sm text-muted-foreground">{movement.notes || "—"}</td></tr>; }
