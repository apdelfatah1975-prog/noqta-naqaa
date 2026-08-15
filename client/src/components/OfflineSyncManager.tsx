import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getPendingVisits, removePendingVisit } from "@/lib/offlineSync";
import { CloudOff, CloudUpload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function OfflineSyncManager() {
  const { user } = useAuth();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const utils = trpc.useUtils();
  const { mutateAsync: syncVisit } = trpc.filters.visits.create.useMutation();

  const refreshCount = useCallback(() => {
    setPendingCount(user ? getPendingVisits(user.id).length : 0);
  }, [user]);

  const syncPendingVisits = useCallback(async () => {
    if (!user || !navigator.onLine) return;
    for (const visit of getPendingVisits(user.id)) {
      try {
        await syncVisit({
          customerId: visit.customerId,
          visitType: visit.visitType,
          visitDate: new Date(visit.visitDate),
          notes: visit.notes,
          clientOperationId: visit.clientOperationId,
        });
        removePendingVisit(user.id, visit.clientOperationId);
      } catch {
        break;
      }
    }
    refreshCount();
    await Promise.all([
      utils.filters.dashboard.invalidate(),
      utils.filters.customers.list.invalidate(),
      utils.filters.reminders.due.invalidate(),
    ]);
  }, [refreshCount, syncVisit, user, utils]);

  useEffect(() => {
    const goOnline = () => { setOnline(true); void syncPendingVisits(); };
    const goOffline = () => setOnline(false);
    refreshCount();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) void syncPendingVisits();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refreshCount, syncPendingVisits]);

  if (online && pendingCount === 0) return null;
  return (
    <div className={`fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold shadow-lg ${online ? "bg-teal-700 text-white" : "bg-amber-500 text-amber-950"}`}>
      {online ? <CloudUpload className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
      <span>{online ? `جارٍ مزامنة ${pendingCount} عملية محفوظة…` : pendingCount ? `${pendingCount} زيارة محفوظة وستتزامن عند عودة الإنترنت` : "وضع دون إنترنت"}</span>
    </div>
  );
}
