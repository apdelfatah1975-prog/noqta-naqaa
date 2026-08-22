import React from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { countOfflineQueue, type OfflineConnectionState } from "@/lib/offlineDatabase";
import { useAuth } from "@/_core/hooks/useAuth";

export function OfflineStatusIndicator() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<OfflineConnectionState>(() => typeof navigator === "undefined" || navigator.onLine ? "online" : "offline");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const refresh = () => { if (user) void countOfflineQueue(user.id).then(setPendingCount).catch(() => undefined); };
    const online = () => { setConnection("online"); refresh(); };
    const offline = () => setConnection("offline");
    const syncing = () => setConnection("syncing");
    const queueChanged = () => refresh();
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("purepoint-offline-sync-start", syncing);
    window.addEventListener("purepoint-offline-sync-finished", online);
    window.addEventListener("purepoint-offline-queue-changed", queueChanged);
    refresh();
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("purepoint-offline-sync-start", syncing);
      window.removeEventListener("purepoint-offline-sync-finished", online);
      window.removeEventListener("purepoint-offline-queue-changed", queueChanged);
    };
  }, [user]);

  if (!user) return null;
  const isOffline = connection === "offline";
  const isSyncing = connection === "syncing";
  const label = isSyncing ? "جارٍ المزامنة" : isOffline ? "غير متصل - يعمل محليًا" : pendingCount ? `متصل - ${pendingCount} عملية بانتظار المزامنة` : "متصل";
  return (
    <div className={`inline-flex max-w-[min(72vw,22rem)] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold sm:text-xs ${isOffline ? "border-amber-200 bg-amber-50 text-amber-800" : isSyncing ? "border-sky-200 bg-sky-50 text-sky-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} role="status" aria-live="polite" aria-busy={isSyncing} title={label}>
      {isSyncing ? <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none" /> : isOffline ? <CloudOff className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
      <span className="truncate">{label}</span>
    </div>
  );
}
