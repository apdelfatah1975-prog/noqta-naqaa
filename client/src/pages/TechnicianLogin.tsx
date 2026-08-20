import React, { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LogIn, ShieldCheck, UserRound, Wifi } from "lucide-react";
import { InstallAppButton } from "@/components/InstallAppButton";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function TechnicianLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previousHref = manifest?.getAttribute("href") ?? "/manifest.webmanifest";
    const previousTitle = document.title;
    if (manifest) manifest.href = "/technician-app/technician-manifest.webmanifest";
    document.title = "دخول الفني | نقطة نقاء";
    return () => {
      if (manifest) manifest.href = previousHref;
      document.title = previousTitle;
    };
  }, []);

  const utils = trpc.useUtils();
  const login = trpc.filters.technicianAuth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("تم تسجيل الدخول بنجاح");
      navigate("/technician-app");
    },
    onError: error => toast.error(error.message || "بيانات الدخول غير صحيحة"),
  });

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4faf9] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-teal-100 bg-white shadow-[0_24px_70px_rgba(15,118,110,0.14)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative flex min-h-[230px] flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#075e59,#0f766e_58%,#14b8a6)] p-7 text-white sm:p-10 lg:min-h-[610px]">
            <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
            <div className="absolute -bottom-20 -right-12 h-60 w-60 rounded-full border-[28px] border-white/10" />
            <div className="relative">
              <div className="mb-8 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><ShieldCheck className="h-6 w-6" /></div>
                <div><p className="text-xs font-bold text-teal-100">نقطة نقاء</p><p className="text-lg font-black">مساحة الفني</p></div>
              </div>
              <p className="max-w-sm text-3xl font-black leading-[1.25] sm:text-4xl">أنجز أوامر شغلك من مكان واحد.</p>
              <p className="mt-4 max-w-sm text-sm font-semibold leading-7 text-teal-50">شاشة سريعة تعرض المهام المسندة إليك فقط، وتساعدك على تحديث الحالة وإرسال نتيجة الزيارة.</p>
            </div>
            <div className="relative mt-8 grid gap-3 text-sm font-bold text-teal-50 sm:grid-cols-2 lg:grid-cols-1">
              {['أوامر العمل المسندة إليك', 'تحديث الحالة خطوة بخطوة', 'تعمل مع ضعف الإنترنت'].map(item => <div key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-teal-200" />{item}</div>)}
            </div>
          </section>

          <section className="p-6 sm:p-10 lg:p-14">
            <div className="mb-8"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-800"><Wifi className="h-3.5 w-3.5" /> واجهة مستقلة للفني</div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">تسجيل الدخول</h1><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">استخدم بريدك ورمز الدخول اللذين أعطاك إياهما مدير الشركة. لا تحتاج إلى حساب Manus.</p></div>
            <form className="space-y-5" onSubmit={event => { event.preventDefault(); login.mutate({ email: email.trim(), password }); }}>
              <div className="space-y-2"><Label htmlFor="technician-login-email" className="font-black">البريد الإلكتروني</Label><div className="relative"><UserRound className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-slate-400" /><Input id="technician-login-email" className="h-12 rounded-xl border-slate-200 bg-slate-50 pr-10 font-semibold focus-visible:ring-teal-500" type="email" dir="ltr" value={email} onChange={event => setEmail(event.target.value)} placeholder="technician@example.com" autoComplete="username" required /></div></div>
              <div className="space-y-2"><Label htmlFor="technician-login-password" className="font-black">رمز دخول الفني</Label><div className="relative"><KeyRound className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-slate-400" /><Input id="technician-login-password" className="h-12 rounded-xl border-slate-200 bg-slate-50 pr-10 font-semibold focus-visible:ring-teal-500" type="password" dir="ltr" value={password} onChange={event => setPassword(event.target.value)} placeholder="أدخل رمز الدخول" autoComplete="one-time-code" required minLength={8} /></div></div>
              <Button type="submit" disabled={login.isPending} className="h-12 w-full rounded-xl bg-teal-700 text-base font-black shadow-lg shadow-teal-700/20 hover:bg-teal-800"><LogIn className="ml-2 h-5 w-5" />{login.isPending ? "جارٍ التحقق..." : "دخول إلى أوامر العمل"}</Button>
            </form>
            <div className="mt-7 rounded-2xl border border-sky-100 bg-sky-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-sky-950">تثبيت التطبيق</p><p className="mt-1 text-xs font-semibold leading-5 text-sky-800">بعد فتح الصفحة من Chrome اضغط زر التثبيت ليظهر التطبيق على هاتفك.</p></div><InstallAppButton technician /></div></div>
            <p className="mt-6 text-center text-xs font-bold leading-6 text-slate-400">هذه الواجهة مستقلة عن تطبيق المدير، وتحتاج فقط بريد الفني ورمز الدخول. لا تعرض الخزينة أو التقارير أو إعدادات الإدارة.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
