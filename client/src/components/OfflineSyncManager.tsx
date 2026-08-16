import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  getPendingCustomers,
  getPendingOperationCount,
  getPendingVisits,
  removePendingCustomer,
  removePendingVisit,
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
    ]);
  }, [refreshCount, syncCustomer, syncVisit, user, utils]);

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
