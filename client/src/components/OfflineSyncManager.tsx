import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  getPendingCustomers,
  getPendingOperationCount,
  getPendingVisits,
  getPendingVisitDeletes,
  getPendingWorkOrderUpdates,
  getPendingWorkOrderProofs,
  getPendingCash,
  getPendingInventory,
  removePendingCash,
  removePendingInventory,
  removePendingCustomer,
  removePendingVisit,
  removePendingVisitDelete,
  removePendingWorkOrderUpdate,
  removePendingWorkOrderProof,
  replaceOfflineCustomerId,
} from "@/lib/offlineSync";
import { CloudOff, CloudUpload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function OfflineSyncManager() {
  const { user } = useAuth();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const syncingRef = useRef(false);
  const utils = trpc.useUtils();
  const { mutateAsync: syncCustomer } = trpc.filters.customers.create.useMutation();
  const { mutateAsync: syncVisit } = trpc.filters.visits.create.useMutation();
  const { mutateAsync: deleteVisit } = trpc.filters.visits.delete.useMutation();
  const { mutateAsync: syncWorkOrderUpdate } = trpc.filters.workOrders.updateStatus.useMutation();
  const { mutateAsync: syncWorkOrderProof } = trpc.filters.workOrders.addProof.useMutation();
  const { mutateAsync: syncCash } = trpc.filters.cash.create.useMutation();
  const { mutateAsync: syncInventoryItem } = trpc.filters.inventory.createItem.useMutation();
  const { mutateAsync: syncInventoryMovement } = trpc.filters.inventory.createMovement.useMutation();
  const { mutateAsync: deleteCash } = trpc.filters.cash.delete.useMutation();
  const { mutateAsync: deleteInventoryItem } = trpc.filters.inventory.deleteItem.useMutation();
  const { mutateAsync: deleteInventoryMovement } = trpc.filters.inventory.deleteMovement.useMutation();

  const refreshCount = useCallback(() => {
    setPendingCount(user ? getPendingOperationCount(user.id) : 0);
  }, [user]);

  const syncPendingOperations = useCallback(async () => {
    if (!user || !navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncFailed(false);
    let syncedCount = 0;
    let batchFailed = false;
    const customerIdMap = new Map<number, number>();
    for (const customer of getPendingCustomers(user.id)) {
      try {
        const result = await syncCustomer({
          name: customer.name,
          phone: customer.phone,
          address: customer.address ?? null,
          latitude: customer.latitude ?? null,
          longitude: customer.longitude ?? null,
          notes: customer.notes ?? null,
          firstVisitType: customer.firstVisitType,
          firstVisitDate: customer.firstVisitDate ? new Date(customer.firstVisitDate) : undefined,
          firstTechnicianName: customer.firstTechnicianName ?? null,
          firstVisitNotes: customer.firstVisitNotes ?? null,
          firstCollectedAmount: customer.firstCollectedAmount ?? 0,
          firstCollectedCurrency: "SAR",
          items: customer.firstVisitItems ?? [],
          clientOperationId: customer.clientOperationId,
        });
        customerIdMap.set(customer.localId, result.id);
        replaceOfflineCustomerId(customer.localId, result.id);
        removePendingCustomer(user.id, customer.clientOperationId);
        syncedCount += 1;
      } catch {
        batchFailed = true;
        setSyncFailed(true);
        break;
      }
    }
    for (const visit of getPendingVisits(user.id)) {
      try {
        const customerId = customerIdMap.get(visit.customerId) ?? visit.customerId;
        if (customerId <= 0) break;
        await syncVisit({
          customerId,
          visitType: visit.visitType,
          visitDate: new Date(visit.visitDate),
          notes: visit.notes,
          technicianName: visit.technicianName ?? null,
          visitResult: visit.visitResult ?? null,
          collectedAmount: visit.collectedAmount ?? 0,
          collectedCurrency: visit.collectedCurrency ?? "SAR",
          items: visit.items ?? [],
          clientOperationId: visit.clientOperationId,
        });
        removePendingVisit(user.id, visit.clientOperationId);
        syncedCount += 1;
      } catch {
        batchFailed = true;
        setSyncFailed(true);
        break;
      }
    }
    for (const operation of getPendingVisitDeletes(user.id)) {
      try {
        await deleteVisit({ id: operation.id, pin: operation.pin });
        removePendingVisitDelete(user.id, operation.clientOperationId);
        syncedCount += 1;
      } catch {
        batchFailed = true;
        setSyncFailed(true);
        break;
      }
    }
    for (const operation of getPendingWorkOrderUpdates(user.id)) {
      try {
        await syncWorkOrderUpdate({
          id: operation.id,
          status: operation.status,
          visitResult: operation.visitResult ?? null,
          notes: operation.notes ?? null,
          collectedAmount: operation.collectedAmount ?? 0,
          collectedCurrency: operation.collectedCurrency ?? "SAR",
          items: operation.items ?? [],
        });
        removePendingWorkOrderUpdate(user.id, operation.clientOperationId);
        syncedCount += 1;
      } catch {
        batchFailed = true;
        setSyncFailed(true);
        break;
      }
    }
    for (const operation of getPendingWorkOrderProofs(user.id)) {
      try {
        await syncWorkOrderProof({ visitId: operation.visitId, kind: operation.kind, dataUrl: operation.dataUrl });
        removePendingWorkOrderProof(user.id, operation.clientOperationId);
        syncedCount += 1;
      } catch {
        batchFailed = true;
        setSyncFailed(true);
        break;
      }
    }
    const inventoryIdMap = new Map<number, number>();
    for (const operation of getPendingInventory(user.id)) {
      try {
        if (operation.entity === "item") {
          const result = await syncInventoryItem({ name: operation.name, category: operation.category ?? "عام", unit: operation.unit ?? "قطعة", reorderLevel: operation.reorderLevel ?? 2, defaultUnitCost: operation.defaultUnitCost ?? 0, openingQuantity: operation.openingQuantity, notes: operation.notes ?? null, clientOperationId: operation.clientOperationId });
          inventoryIdMap.set(operation.localId ?? -Date.now(), result.id);
        } else if (operation.entity === "movement") {
          const inventoryItemId = inventoryIdMap.get(operation.inventoryItemId) ?? operation.inventoryItemId;
          if (inventoryItemId <= 0) throw new Error("الصنف المحلي لم تتم مزامنته بعد");
          await syncInventoryMovement({ inventoryItemId, movementType: operation.movementType, quantity: operation.quantity, unitCost: operation.unitCost, currency: operation.currency, movementDate: new Date(operation.movementDate), technicianName: operation.technicianName ?? null, notes: operation.notes ?? null, clientOperationId: operation.clientOperationId });
        } else if (operation.entity === "inventoryItem" && operation.id > 0) {
          await deleteInventoryItem({ id: operation.id, pin: operation.pin });
        } else if (operation.entity === "inventoryMovement" && operation.id > 0) {
          await deleteInventoryMovement({ id: operation.id, pin: operation.pin });
        } else {
          removePendingInventory(user.id, operation.clientOperationId);
          continue;
        }
        removePendingInventory(user.id, operation.clientOperationId);
        syncedCount += 1;
      } catch {
        batchFailed = true;
        setSyncFailed(true);
        break;
      }
    }
    for (const operation of getPendingCash(user.id)) {
      try {
        if ("transactionType" in operation) await syncCash({ transactionType: operation.transactionType, currency: operation.currency, amount: operation.amount, category: operation.category, transactionDate: new Date(operation.transactionDate), recipientName: operation.recipientName ?? null, notes: operation.notes ?? null, clientOperationId: operation.clientOperationId });
        else await deleteCash({ id: operation.id, pin: operation.pin });
        removePendingCash(user.id, operation.clientOperationId);
        syncedCount += 1;
      } catch {
        batchFailed = true;
        setSyncFailed(true);
        break;
      }
    }
    setSyncing(false);
    syncingRef.current = false;
    refreshCount();
    if (syncedCount > 0 && !batchFailed) {
      toast.success(`تمت مزامنة ${syncedCount} ${syncedCount === 1 ? "عملية" : "عمليات"} بنجاح بعد عودة الإنترنت.`);
    }
    await Promise.all([
      utils.filters.dashboard.invalidate(),
      utils.filters.customers.list.invalidate(),
      utils.filters.customers.get.invalidate(),
      utils.filters.reminders.due.invalidate(),
      utils.filters.workOrders.list.invalidate(),
      utils.filters.cash.summary.invalidate(),
      utils.filters.inventory.summary.invalidate(),
    ]);
  }, [deleteCash, deleteInventoryItem, deleteInventoryMovement, deleteVisit, refreshCount, syncCash, syncCustomer, syncInventoryItem, syncInventoryMovement, syncVisit, syncWorkOrderUpdate, user, utils]);

  useEffect(() => {
    const goOnline = () => { setOnline(true); void syncPendingOperations(); };
    const goOffline = () => setOnline(false);
    refreshCount();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) void syncPendingOperations();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refreshCount, syncPendingOperations]);

  if (online && pendingCount === 0) return null;
  const message = !online
    ? pendingCount
      ? `${pendingCount} عملية محفوظة وستتزامن عند عودة الإنترنت`
      : "وضع دون إنترنت"
    : syncing
      ? `جارٍ مزامنة ${pendingCount} عملية محفوظة…`
      : syncFailed
        ? `تعذر مزامنة ${pendingCount} عملية. ستتم المحاولة لاحقًا.`
        : `${pendingCount} عملية بانتظار المزامنة`;
  return (
    <div className={`fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold shadow-lg ${!online ? "bg-amber-500 text-amber-950" : syncFailed ? "bg-red-600 text-white" : "bg-teal-700 text-white"}`} role="status" aria-live="polite" title="حالة المزامنة">
      {online ? <CloudUpload className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}
