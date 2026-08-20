import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  getPendingCustomers,
  getPendingVisits,
  getPendingVisitDeletes,
  getPendingWorkOrderUpdates,
  getPendingWorkOrderProofs,
  getPendingCash,
  getPendingInventory,
  getPendingOperationCount,
  removePendingCustomer,
  removePendingVisit,
  removePendingVisitDelete,
  removePendingWorkOrderUpdate,
  removePendingWorkOrderProof,
  removePendingCash,
  removePendingInventory,
} from "@/lib/offlineSync";
import { CloudOff, RefreshCw, Trash2, Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type Operation = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  remove: () => void;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

export default function PendingOperations() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const ownerId = user?.id ?? 0;

  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const onChange = () => refresh();
    const onOnline = () => { setOnline(true); refresh(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("purepoint-offline-queue-changed", onChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("purepoint-offline-queue-changed", onChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  const operations = useMemo<Operation[]>(() => {
    if (!ownerId) return [];
    const rows: Operation[] = [];
    getPendingCustomers(ownerId).forEach(item => rows.push({ id: item.clientOperationId, title: "إضافة عميل", detail: item.name, createdAt: item.createdAt, remove: () => removePendingCustomer(ownerId, item.clientOperationId) }));
    getPendingVisits(ownerId).forEach(item => rows.push({ id: item.clientOperationId, title: "تسجيل زيارة", detail: item.visitResult || item.visitType, createdAt: item.createdAt, remove: () => removePendingVisit(ownerId, item.clientOperationId) }));
    getPendingVisitDeletes(ownerId).forEach(item => rows.push({ id: item.clientOperationId, title: "حذف زيارة", detail: `رقم الزيارة ${item.id}`, createdAt: item.createdAt, remove: () => removePendingVisitDelete(ownerId, item.clientOperationId) }));
    getPendingWorkOrderUpdates(ownerId).forEach(item => rows.push({ id: item.clientOperationId, title: "تحديث أمر فني", detail: `الأمر ${item.id} — ${item.status}`, createdAt: item.createdAt, remove: () => removePendingWorkOrderUpdate(ownerId, item.clientOperationId) }));
    getPendingWorkOrderProofs(ownerId).forEach(item => rows.push({ id: item.clientOperationId, title: item.kind === "photo" ? "صورة إثبات عمل" : "توقيع عميل", detail: `أمر الزيارة ${item.visitId}`, createdAt: item.createdAt, remove: () => removePendingWorkOrderProof(ownerId, item.clientOperationId) }));
    getPendingCash(ownerId).forEach(item => rows.push({ id: item.clientOperationId, title: "عملية خزينة", detail: "transactionType" in item ? `${item.transactionType === "income" ? "إيراد" : "مصروف"} — ${item.amount} ر.س` : `حذف العملية ${item.id}`, createdAt: item.createdAt, remove: () => removePendingCash(ownerId, item.clientOperationId) }));
    getPendingInventory(ownerId).forEach(item => rows.push({ id: item.clientOperationId, title: item.entity === "item" ? "إضافة صنف مخزن" : item.entity === "movement" ? "حركة مخزن" : "حذف من المخزن", detail: item.entity === "item" ? item.name : item.entity === "movement" ? `${item.movementType === "incoming" ? "وارد" : "منصرف"} — ${item.quantity}` : `رقم السجل ${item.id}`, createdAt: item.createdAt, remove: () => removePendingInventory(ownerId, item.clientOperationId) }));
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [ownerId, version]);

  const remove = (operation: Operation) => {
    if (!window.confirm("هل تريد حذف هذه العملية؟ لن تُرسل إلى الخادم بعد حذفها.")) return;
    operation.remove();
    window.dispatchEvent(new Event("purepoint-offline-queue-changed"));
    refresh();
  };

  const retry = () => window.dispatchEvent(new Event("purepoint-offline-sync-request"));
  const count = ownerId ? getPendingOperationCount(ownerId) : 0;

  return (
    <main dir="rtl" className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-3xl bg-teal-800 p-6 text-white shadow-lg sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold text-teal-100">المزامنة المحلية</p>
          <h1 className="mt-1 text-2xl font-black">العمليات المعلقة</h1>
          <p className="mt-2 text-sm text-teal-100">راجع ما تم حفظه دون إنترنت قبل إرساله إلى قاعدة البيانات.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold">
          {online ? <Wifi className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
          {online ? "متصل" : "دون اتصال"}
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
        <div><p className="text-sm text-slate-500">إجمالي العمليات</p><p className="text-2xl font-black text-slate-900">{count}</p></div>
        <div className="flex gap-2"><Button onClick={retry} className="gap-2 bg-teal-700 hover:bg-teal-800"><RefreshCw className="h-4 w-4" />إعادة المحاولة</Button><Link href={user?.role === "user" ? "/technician-preview" : "/"}><Button variant="outline">{user?.role === "user" ? "العودة إلى أوامر الفني" : "العودة للرئيسية"}</Button></Link></div>
      </div>
      {operations.length === 0 ? <div className="rounded-3xl border border-dashed border-teal-200 bg-teal-50 p-12 text-center"><p className="text-lg font-black text-teal-900">لا توجد عمليات معلقة</p><p className="mt-2 text-sm text-teal-800/70">كل التعديلات المحلية تمت مزامنتها أو لا توجد تغييرات بانتظار الإرسال.</p></div> : <div className="space-y-3">{operations.map(operation => <article key={operation.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-900">{operation.title}</h2><p className="mt-1 text-sm text-slate-600">{operation.detail}</p><p className="mt-1 text-xs text-slate-400">حُفظت في {formatDate(operation.createdAt)}</p></div><div className="flex gap-2"><Button onClick={retry} size="sm" variant="outline" className="gap-1"><RefreshCw className="h-4 w-4" />إعادة المحاولة</Button><Button onClick={() => remove(operation)} size="sm" variant="destructive" className="gap-1"><Trash2 className="h-4 w-4" />حذف</Button></div></article>)}</div>}
    </main>
  );
}

export function pendingOperationsCountForTest(ownerId: number) { return getPendingOperationCount(ownerId); }
