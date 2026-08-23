import React from "react";
import { FileDown, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

export function BackupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const options = trpc.filters.backup.options.useQuery(undefined, { enabled: open });
  const status = trpc.filters.backup.status.useQuery(undefined, { enabled: open });
  const [selected, setSelected] = React.useState<string[]>([]);
  const createBackup = trpc.filters.backup.createNow.useMutation({
    onSuccess: data => {
      if (data.downloadUrl) window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      void status.refetch();
    },
  });
  React.useEffect(() => {
    if (options.data?.tables) setSelected(options.data.tables.map(table => table.key));
  }, [options.data]);
  const toggle = (key: string) => setSelected(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  const latest = status.data?.generatedAt ? new Date(status.data.generatedAt).toLocaleString("ar-EG") : "لم تُنشأ نسخة بعد";
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-h-[90dvh] max-w-lg overflow-y-auto">
      <DialogHeader><DialogTitle>النسخ الاحتياطي المتقدم</DialogTitle><DialogDescription>اختر الجداول المطلوبة ثم نزّل ملف Excel. تُسجّل كل عملية في سجل المراجعة.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">آخر نسخة: {latest}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(options.data?.tables ?? []).map(table => <label key={table.key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 text-sm font-semibold">
            <input type="checkbox" checked={selected.includes(table.key)} onChange={() => toggle(table.key)} className="h-4 w-4 accent-emerald-700" />{table.label}
          </label>)}
        </div>
        <Button type="button" className="w-full gap-2" disabled={createBackup.isPending || selected.length === 0} onClick={() => createBackup.mutate({ tables: selected })}>
          {createBackup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} تنزيل النسخة المختارة
        </Button>
        <section className="border-t pt-3"><h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold"><History className="h-4 w-4" /> سجل التصديرات</h3>
          <div className="space-y-2">{(status.data?.history ?? []).slice(0, 10).map(entry => <div key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><div className="font-bold">{new Date(entry.createdAt).toLocaleString("ar-EG")}</div><div className="text-muted-foreground">{Object.values(entry.counts as Record<string, number>).reduce((sum, count) => sum + Number(count || 0), 0)} سجلًا مُصدّرًا</div></div>)}{status.data?.history?.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد عمليات تصدير سابقة.</p> : null}</div>
        </section>
      </div>
    </DialogContent>
  </Dialog>;
}
