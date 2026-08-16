import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPins, setShowPins] = useState(false);
  const setPin = trpc.filters.notifications.setPin.useMutation({
    onSuccess: () => {
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      toast.success("تم تغيير الرقم السري بنجاح");
    },
    onError: error => toast.error(error.message || "تعذر تغيير الرقم السري."),
  });

  function savePin(event: React.FormEvent) {
    event.preventDefault();
    const current = currentPin.trim();
    const next = newPin.trim();
    if (next.length < 4) {
      toast.error("اكتب رقمًا سريًا من 4 أحرف أو أرقام على الأقل.");
      return;
    }
    if (next !== confirmPin.trim()) {
      toast.error("تأكيد الرقم السري غير مطابق.");
      return;
    }
    setPin.mutate({ newPin: next, currentPin: current || undefined });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6" dir="rtl">
      <div>
        <h1 className="page-heading">الإعدادات</h1>
        <p className="page-subheading">إعدادات الحماية والتحكم الأساسية في التطبيق.</p>
      </div>

      <section className="soft-card overflow-hidden">
        <div className="flex items-start gap-3 border-b border-teal-950/6 p-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-extrabold">الرقم السري للحماية</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">يُستخدم لحماية تعديل وحذف العملاء والزيارات والخزينة والمخزن والتذكيرات.</p>
          </div>
        </div>
        <form onSubmit={savePin} className="space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              <span className="field-label">الرقم السري الحالي</span>
              <input type={showPins ? "text" : "password"} className="field-input" value={currentPin} onChange={event => setCurrentPin(event.target.value)} placeholder="اتركه فارغًا عند الإعداد لأول مرة" autoComplete="current-password" />
            </label>
            <label>
              <span className="field-label">الرقم السري الجديد</span>
              <input type={showPins ? "text" : "password"} className="field-input" value={newPin} onChange={event => setNewPin(event.target.value)} placeholder="4 أحرف أو أرقام على الأقل" autoComplete="new-password" minLength={4} required />
            </label>
            <label>
              <span className="field-label">تأكيد الرقم السري الجديد</span>
              <input type={showPins ? "text" : "password"} className="field-input" value={confirmPin} onChange={event => setConfirmPin(event.target.value)} placeholder="أعد كتابة الرقم السري" autoComplete="new-password" minLength={4} required />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setShowPins(value => !value)} className="rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50">
              {showPins ? <EyeOff className="ml-1 h-4 w-4" /> : <Eye className="ml-1 h-4 w-4" />}
              {showPins ? "إخفاء الأرقام" : "إظهار الأرقام"}
            </Button>
            <Button type="submit" disabled={setPin.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">
              <KeyRound className="ml-1 h-4 w-4" />
              {setPin.isPending ? "جارٍ الحفظ…" : "حفظ الرقم السري"}
            </Button>
          </div>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">إذا كان هذا أول إعداد للرقم السري، اترك خانة الرقم الحالي فارغة. لا تشارك الرقم السري مع غير المصرح لهم.</p>
        </form>
      </section>
    </div>
  );
}
