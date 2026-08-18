import { Droplets, MapPin, Phone, MessageCircle, ShieldCheck, Wrench, Clock3, CheckCircle2, ArrowLeft } from "lucide-react";

const whatsappNumber = "966500000000";

export default function PublicDemo() {
  const openWhatsApp = () => {
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("مرحبًا، أريد طلب خدمة فلاتر مياه في الرياض")}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-[#f5fbfa] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-teal-950/10 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20"><Droplets className="h-6 w-6" /></span>
            <span><strong className="block text-base font-black text-teal-950">نقطة نقاء</strong><small className="text-xs font-bold text-teal-700">فلاتر مياه في الرياض</small></span>
          </a>
          <a href="tel:+966500000000" className="hidden items-center gap-2 rounded-xl bg-teal-50 px-4 py-2.5 text-sm font-black text-teal-800 sm:flex"><Phone className="h-4 w-4" /> اتصل الآن</a>
        </div>
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden bg-[linear-gradient(120deg,#063c3a_0%,#087f79_56%,#39b9a7_100%)] text-white">
          <div className="absolute -left-28 -top-24 -z-10 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-24">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold"><MapPin className="h-4 w-4" /> خدمة منزلية داخل الرياض</p>
              <h1 className="max-w-2xl text-4xl font-black leading-[1.2] sm:text-6xl">مياه أنقى، وصيانة تصل إلى بابك</h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-teal-50 sm:text-lg">تركيب وصيانة فلاتر مياه الشرب وتغيير الشمعات والممبرين بخدمة واضحة وسريعة داخل أحياء الرياض.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button onClick={openWhatsApp} className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-black text-teal-900 shadow-xl transition hover:-translate-y-0.5"><MessageCircle className="h-5 w-5" /> اطلب الخدمة عبر واتساب</button><a href="#services" className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-6 font-black text-white transition hover:bg-white/15">شاهد خدماتنا <ArrowLeft className="h-5 w-5" /></a></div>
              <div className="mt-7 flex flex-wrap gap-5 text-sm font-bold text-teal-50"><span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> فنيون موثوقون</span><span className="flex items-center gap-2"><Clock3 className="h-5 w-5" /> مواعيد مرنة</span></div>
            </div>
            <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-sm sm:p-7"><p className="text-sm font-bold text-teal-50">تجربة العميل تبدأ من هنا</p><h2 className="mt-2 text-2xl font-black">احجز زيارة لفحص الفلتر</h2><form onSubmit={(event) => { event.preventDefault(); window.alert("تم استلام الطلب التجريبي، وسنتواصل معك."); }} className="mt-6 space-y-3"><input required className="h-12 w-full rounded-xl border-0 bg-white px-4 text-right text-slate-900 outline-none ring-teal-300 placeholder:text-slate-400 focus:ring-2" placeholder="اسم العميل" /><input required type="tel" className="h-12 w-full rounded-xl border-0 bg-white px-4 text-right text-slate-900 outline-none ring-teal-300 placeholder:text-slate-400 focus:ring-2" placeholder="رقم الجوال" /><select className="h-12 w-full rounded-xl border-0 bg-white px-4 text-right text-slate-900 outline-none ring-teal-300 focus:ring-2"><option>اختر نوع الخدمة</option><option>تركيب فلتر جديد</option><option>صيانة فلتر</option><option>تغيير شمعات</option><option>فحص واستشارة</option></select><button className="h-12 w-full rounded-xl bg-amber-400 font-black text-amber-950 transition hover:bg-amber-300">إرسال طلب مبدئي</button></form><p className="mt-4 flex items-center gap-2 text-xs leading-6 text-teal-50/75"><CheckCircle2 className="h-4 w-4 shrink-0" /> هذا نموذج تجريبي. في الموقع النهائي يمكن ربطه مباشرة بتطبيق إدارة الشركة.</p></div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><div className="max-w-2xl"><p className="font-black text-teal-700">خدماتنا</p><h2 className="mt-2 text-3xl font-black text-teal-950 sm:text-4xl">كل ما يحتاجه فلترك في مكان واحد</h2></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{icon: Wrench, title: "تركيب الفلاتر", text: "تركيب منظم وشرح طريقة الاستخدام."},{icon: Droplets, title: "تغيير الشمعات", text: "تغيير دوري للشموع والممبرين."},{icon: ShieldCheck, title: "صيانة وفحص", text: "تشخيص التسريب وضعف تدفق المياه."},{icon: Clock3, title: "متابعة دورية", text: "تذكير بمواعيد الخدمة القادمة."}].map((service) => <article key={service.title} className="rounded-3xl border border-teal-950/8 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"><service.icon className="h-6 w-6" /></div><h3 className="mt-5 text-lg font-black text-teal-950">{service.title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{service.text}</p></article>)}</div></section>

        <section className="border-y border-teal-950/8 bg-white"><div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3"><div><p className="text-3xl font-black text-teal-800">الرياض</p><p className="mt-2 text-sm text-slate-600">نخدم الأحياء القريبة حسب جدول المواعيد.</p></div><div><p className="text-3xl font-black text-teal-800">واتساب</p><p className="mt-2 text-sm text-slate-600">تواصل سريع لمعرفة السعر وتحديد الموعد.</p></div><div><p className="text-3xl font-black text-teal-800">120 يومًا</p><p className="mt-2 text-sm text-slate-600">متابعة مقترحة بعد التركيب أو الصيانة.</p></div></div></section>
      </main>

      <footer className="bg-[#063c3a] px-4 py-8 text-white sm:px-6"><div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">نقطة نقاء</p><p className="mt-1 text-sm text-teal-100/75">خدمات فلاتر مياه موثوقة في الرياض</p></div><button onClick={openWhatsApp} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-teal-900"><MessageCircle className="h-4 w-4" /> تواصل عبر واتساب</button></div></footer>
    </div>
  );
}
