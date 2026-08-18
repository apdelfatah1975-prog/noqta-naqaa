import { useState } from "react";
import { ShieldCheck, UserPlus, UserX, Users } from "lucide-react";
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
  const utils = trpc.useUtils();
  const accounts = trpc.filters.allowedTechnicians.list.useQuery();
  const create = trpc.filters.allowedTechnicians.create.useMutation({
    onSuccess: (result) => {
      toast.success(result.linked ? "تم اعتماد الحساب وربطه مباشرة" : "تمت إضافة البريد، وسيُربط عند أول دخول ناجح");
      setDisplayName("");
      setEmail("");
      utils.filters.allowedTechnicians.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const setActive = trpc.filters.allowedTechnicians.setActive.useMutation({
    onSuccess: () => utils.filters.allowedTechnicians.list.invalidate(),
    onError: (error) => toast.error(error.message),
  });

  return (
    <main dir="rtl" className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="rounded-3xl bg-gradient-to-l from-sky-700 to-cyan-600 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8" /><div><h1 className="text-2xl font-bold">الحسابات المسموح لها بالدخول</h1><p className="mt-1 text-sm text-cyan-50">اعتمد حسابات الفنيين من داخل النظام دون تخزين كلمات المرور.</p></div></div>
      </header>
      <Card className="border-sky-100 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5 text-sky-600" />إضافة حساب فني</CardTitle></CardHeader><CardContent>
        <form className="grid gap-4 md:grid-cols-[1fr_1.3fr_auto] md:items-end" onSubmit={(event) => { event.preventDefault(); create.mutate({ displayName, email }); }}>
          <div className="space-y-2"><Label htmlFor="technician-name">اسم الفني</Label><Input id="technician-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="مثال: محمد أحمد" required /></div>
          <div className="space-y-2"><Label htmlFor="technician-email">بريد الدخول</Label><Input id="technician-email" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="technician@example.com" required /></div>
          <Button type="submit" disabled={create.isPending} className="bg-sky-700 hover:bg-sky-800">{create.isPending ? "جارٍ الحفظ..." : "إضافة الحساب"}</Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">لا تكتب كلمة المرور هنا. الفني يستخدم تسجيل الدخول الرسمي بالبريد المعتمد، ثم يظهر له أمر العمل المسند فقط.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-sky-600" />الحسابات المسجلة</CardTitle></CardHeader><CardContent>
        {accounts.isLoading ? <p className="py-8 text-center text-muted-foreground">جارٍ التحميل...</p> : accounts.data?.length ? <div className="space-y-3">{accounts.data.map((account) => <div key={account.id} className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{account.displayName}</p><p className="text-sm text-muted-foreground" dir="ltr">{account.email}</p><p className="mt-1 text-xs text-muted-foreground">{account.linkedUserId ? "مرتبط بحساب مسجل" : "سيتم الربط عند أول دخول بالبريد"}</p></div><div className="flex items-center gap-3"><span className={account.isActive ? "text-sm text-emerald-700" : "text-sm text-muted-foreground"}>{account.isActive ? "مسموح" : "موقوف"}</span><Switch checked={account.isActive} onCheckedChange={(checked) => setActive.mutate({ id: account.id, isActive: checked })} aria-label={`تفعيل ${account.displayName}`} />{!account.isActive && <UserX className="h-4 w-4 text-rose-500" />}</div></div>)}</div> : <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">لم تتم إضافة حسابات فنيين بعد.</div>}
      </CardContent></Card>
    </main>
  );
}
