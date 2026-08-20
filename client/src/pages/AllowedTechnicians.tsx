import { useState } from "react";
import { KeyRound, ShieldCheck, UserPlus, UserX, Users, ClipboardList, ContactRound, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function AllowedTechnicians() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const utils = trpc.useUtils();
  const accounts = trpc.filters.allowedTechnicians.list.useQuery();
  const create = trpc.filters.allowedTechnicians.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء حساب الفني بنجاح");
      setDisplayName("");
      setEmail("");
      setPassword("");
      utils.filters.allowedTechnicians.list.invalidate();
      utils.filters.technicians.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const setPasswordMutation = trpc.filters.allowedTechnicians.setPassword.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث كلمة سر الفني");
      setResetId(null);
      setResetPassword("");
      utils.filters.allowedTechnicians.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateMenuPermissions = trpc.filters.allowedTechnicians.updateMenuPermissions.useMutation({
    onSuccess: () => { toast.success("تم تحديث القوائم الظاهرة للفني"); utils.filters.allowedTechnicians.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const setActive = trpc.filters.allowedTechnicians.setActive.useMutation({
    onSuccess: () => {
      utils.filters.allowedTechnicians.list.invalidate();
      utils.filters.technicians.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <main dir="rtl" className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="rounded-3xl bg-gradient-to-l from-sky-700 to-cyan-600 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8" /><div><h1 className="text-2xl font-bold">حسابات الفنيين</h1><p className="mt-1 text-sm text-cyan-50">أنشئ للفني بريدًا وكلمة سر للدخول مباشرة من داخل التطبيق.</p></div></div>
      </header>
      <Card className="border-sky-100 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5 text-sky-600" />إضافة حساب فني</CardTitle></CardHeader><CardContent>
        <form className="grid gap-4 md:grid-cols-[1fr_1.2fr_1fr_auto] md:items-end" onSubmit={(event) => { event.preventDefault(); create.mutate({ displayName, email, password }); }}>
          <div className="space-y-2"><Label htmlFor="technician-name">اسم الفني</Label><Input id="technician-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="مثال: محمد أحمد" required /></div>
          <div className="space-y-2"><Label htmlFor="technician-email">بريد الدخول</Label><Input id="technician-email" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="technician@example.com" required /></div>
          <div className="space-y-2"><Label htmlFor="technician-password">كلمة السر</Label><Input id="technician-password" type="password" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} placeholder="8 أحرف أو أرقام على الأقل" required /></div>
          <Button type="submit" disabled={create.isPending} className="bg-sky-700 hover:bg-sky-800">{create.isPending ? "جارٍ الحفظ..." : "إنشاء الحساب"}</Button>
        </form>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">احتفظ بكلمة السر وأرسلها للفني بأمان. الفني يفتح رابط التطبيق ثم يختار «دخول الفني» ولا يحتاج إلى حساب منصة Manus.</p>
      </CardContent></Card>
      <Card className="border-cyan-100 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-cyan-600" />لوحة صلاحيات الفنيين</CardTitle><p className="text-sm text-muted-foreground">نظرة سريعة على القوائم المفعلة لكل فني. استخدم مفاتيح التعديل في الصف نفسه أو من البطاقة التفصيلية أسفل الجدول.</p></CardHeader><CardContent>{accounts.isLoading ? <p className="py-6 text-center text-muted-foreground">جارٍ تحميل ملخص الصلاحيات...</p> : accounts.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-right text-muted-foreground"><th className="px-3 py-3 font-semibold">الفني</th><th className="px-3 py-3 font-semibold">حالة الحساب</th><th className="px-3 py-3 font-semibold">أوامر الشغل</th><th className="px-3 py-3 font-semibold">العملاء</th><th className="px-3 py-3 font-semibold">سجل الزيارات</th><th className="px-3 py-3 font-semibold">العمليات المعلقة</th></tr></thead><tbody>{accounts.data.map((account) => <tr key={account.id} className="border-b last:border-0"><td className="px-3 py-3"><p className="font-bold text-slate-800">{account.displayName}</p><p className="text-xs text-muted-foreground" dir="ltr">{account.email}</p></td><td className="px-3 py-3"><span className={account.isActive ? "font-semibold text-emerald-700" : "font-semibold text-rose-600"}>{account.isActive ? "مفعل" : "موقوف"}</span></td>{(["workOrders", "pendingOperations", "customers", "visits"] as const).map((permission) => <td key={permission} className="px-3 py-3"><Switch checked={account.menuPermissions.includes(permission)} disabled={permission === "workOrders" || updateMenuPermissions.isPending} onCheckedChange={(checked) => { const next = new Set(account.menuPermissions); checked ? next.add(permission) : next.delete(permission); updateMenuPermissions.mutate({ id: account.id, menuPermissions: Array.from(next) }); }} aria-label={`${permission} - ${account.displayName}`} /></td>)}</tr>)}</tbody></table></div> : <p className="py-6 text-center text-muted-foreground">لا توجد حسابات فنيين لعرضها.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-sky-600" />الحسابات المسجلة والتعديل التفصيلي</CardTitle></CardHeader><CardContent>
        {accounts.isLoading ? <p className="py-8 text-center text-muted-foreground">جارٍ التحميل...</p> : accounts.data?.length ? <div className="space-y-3">{accounts.data.map((account) => <div key={account.id} className="rounded-2xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{account.displayName}</p><p className="text-sm text-muted-foreground" dir="ltr">{account.email}</p><p className="mt-1 text-xs text-muted-foreground">{account.hasPassword ? "دخول داخلي بكلمة سر مفعل" : "لم يتم تعيين كلمة سر"}</p></div><div className="flex items-center gap-3"><span className={account.isActive ? "text-sm text-emerald-700" : "text-sm text-muted-foreground"}>{account.isActive ? "مسموح" : "موقوف"}</span><Switch checked={account.isActive} onCheckedChange={(checked) => setActive.mutate({ id: account.id, isActive: checked })} aria-label={`تفعيل ${account.displayName}`} />{!account.isActive && <UserX className="h-4 w-4 text-rose-500" />}<Button type="button" variant="outline" size="sm" onClick={() => { setResetId(resetId === account.id ? null : account.id); setResetPassword(""); }}><KeyRound className="ml-1 h-4 w-4" />تغيير كلمة السر</Button></div></div><div className="mt-4 border-t pt-4"><p className="text-sm font-bold text-slate-800">القوائم الظاهرة لهذا الفني</p><p className="mt-1 text-xs text-muted-foreground">أوامر الشغل مفعلة دائمًا. فعّل ما يحتاجه الفني فقط.</p><div className="mt-3 flex flex-wrap gap-2">{[{ key: "workOrders", label: "أوامر الشغل", icon: ClipboardList, locked: true }, { key: "pendingOperations", label: "العمليات المعلقة", icon: ClipboardList, locked: false }, { key: "customers", label: "العملاء", icon: ContactRound, locked: false }, { key: "visits", label: "سجل الزيارات", icon: History, locked: false }].map(option => { const enabled = account.menuPermissions.includes(option.key as "workOrders" | "pendingOperations" | "customers" | "visits"); const Icon = option.icon; return <label key={option.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${enabled ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-500"}`}><input type="checkbox" checked={enabled} disabled={option.locked || updateMenuPermissions.isPending} onChange={(event) => { const next = new Set(account.menuPermissions); event.target.checked ? next.add(option.key as "workOrders" | "pendingOperations" | "customers" | "visits") : next.delete(option.key as "workOrders" | "pendingOperations" | "customers" | "visits"); updateMenuPermissions.mutate({ id: account.id, menuPermissions: Array.from(next) as Array<"workOrders" | "pendingOperations" | "customers" | "visits"> }); }} /><Icon className="h-4 w-4" />{option.label}</label>; })}</div></div>{resetId === account.id && <form className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); setPasswordMutation.mutate({ id: account.id, password: resetPassword }); }}><div className="flex-1 space-y-2"><Label htmlFor={`reset-password-${account.id}`}>كلمة السر الجديدة</Label><Input id={`reset-password-${account.id}`} type="password" dir="ltr" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} minLength={8} required /></div><Button type="submit" disabled={setPasswordMutation.isPending}>{setPasswordMutation.isPending ? "جارٍ التحديث..." : "حفظ كلمة السر"}</Button></form>}</div>)}</div> : <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">لم تتم إضافة حسابات فنيين بعد.</div>}
      </CardContent></Card>
    </main>
  );
}
