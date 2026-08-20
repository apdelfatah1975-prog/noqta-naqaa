import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { InstallAppButton } from "@/components/InstallAppButton";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function TechnicianLogin() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previousHref = manifest?.getAttribute("href") ?? "/manifest.webmanifest";
    const previousTitle = document.title;
    if (manifest) manifest.href = "/technician-manifest.webmanifest";
    document.title = "دخول الفني | نقطة نقاء";
    return () => {
      if (manifest) manifest.href = previousHref;
      document.title = previousTitle;
    };
  }, []);
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.filters.technicianAuth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("تم تسجيل الدخول بنجاح");
      navigate("/technician-preview");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-white to-sky-100 px-4 py-8">
      <Card className="w-full max-w-md overflow-hidden rounded-3xl border-cyan-100 shadow-xl">
        <CardHeader className="bg-gradient-to-l from-sky-700 to-cyan-600 p-7 text-white">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><ShieldCheck className="h-8 w-8" /></div>
          <CardTitle className="text-2xl font-black">دخول الفني</CardTitle>
          <p className="mt-2 text-sm leading-6 text-cyan-50">استخدم البريد وكلمة السر اللذين أعطاك إياهما مدير الشركة.</p>
        </CardHeader>
          <CardContent className="p-6 sm:p-7">
            <div className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-sky-950">ثبّت واجهة الفني على الهاتف</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-sky-800">افتح الرابط مرة، ثم اضغط التثبيت لتظهر الواجهة مثل أي تطبيق.</p>
                </div>
                <InstallAppButton />
              </div>
              <ol className="mt-3 grid gap-1 text-[11px] font-bold text-sky-800">
                <li>١. افتح الرابط من Chrome.</li>
                <li>٢. اضغط «تثبيت التطبيق».</li>
                <li>٣. افتح الرمز من شاشة الهاتف لاحقًا.</li>
              </ol>
            </div>
          <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); login.mutate({ email, password }); }}>
            <div className="space-y-2"><Label htmlFor="technician-login-email">البريد الإلكتروني</Label><div className="relative"><UserRound className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-slate-400" /><Input id="technician-login-email" className="pr-10" type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="technician@example.com" autoComplete="username" required /></div></div>
            <div className="space-y-2"><Label htmlFor="technician-login-password">كلمة السر</Label><div className="relative"><KeyRound className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-slate-400" /><Input id="technician-login-password" className="pr-10" type="password" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="أدخل كلمة السر" autoComplete="current-password" required minLength={8} /></div></div>
            <Button type="submit" disabled={login.isPending} className="h-12 w-full bg-sky-700 text-base font-bold hover:bg-sky-800">{login.isPending ? "جارٍ التحقق..." : "دخول إلى أوامر العمل"}</Button>
          </form>
          <p className="mt-5 text-center text-xs font-semibold leading-6 text-slate-500">هذه الواجهة مخصصة للفني وأوامر العمل فقط.</p>
        </CardContent>
      </Card>
    </main>
  );
}
