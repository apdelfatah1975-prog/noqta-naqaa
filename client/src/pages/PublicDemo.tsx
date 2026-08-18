import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Award,
  HeartHandshake,
  MapPinned,
  Navigation,
  Instagram,
  Facebook,
  Droplets,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShieldCheck,
  Star,
  Sparkles,
  Wrench,
} from "lucide-react";

const whatsappNumber = "201008797774";
const heroImage = "/manus-storage/purepoint-hero-installation_f76e76d6.jpg";
const cartridgesImage = "/manus-storage/purepoint-cartridges_5a1dea2a.jpg";
const maintenanceImage = "/manus-storage/purepoint-maintenance_c1ab05d9.jpg";
const premiumFilterImage = "/manus-storage/purepoint-filter-product-premium_c8d56987.jpg";
const premiumCartridgesImage = "/manus-storage/purepoint-cartridges-premium_bb7f6bb4.jpg";
const premiumServiceImage = "/manus-storage/purepoint-home-service-premium_5959776a.jpg";
const coolerImage = "/manus-storage/purepoint-water-cooler-premium_b2e5b2e8.jpg";
const installationDetailImage = "/manus-storage/purepoint-installation-detail_bf77cd2e.jpg";
const technicianTrustImage = "/manus-storage/purepoint-technician-trust_0ccc8957.jpg";
const clearWaterImage = "/manus-storage/purepoint-clear-water_8de6dc28.jpg";
const sevenStageImage = "/manus-storage/purepoint-seven-stage-kitchen_58810bce.jpg";
const membraneDetailImage = "/manus-storage/purepoint-membrane-detail_9a3637d1.jpg";
const dispenserHomeImage = "/manus-storage/purepoint-dispenser-home_a1449f66.jpg";
const serviceKitImage = "/manus-storage/purepoint-service-kit_47211cc7.jpg";

const products = [
  { name: "فلتر 7 مراحل", description: "حل متكامل للاستخدام المنزلي مع متابعة التركيب والصيانة.", image: sevenStageImage, tone: "bg-teal-50" },
  { name: "شمعات وممبرين", description: "قطع غيار أصلية وخدمة تغيير مناسبة لمراحل الفلتر المختلفة.", image: membraneDetailImage, tone: "bg-cyan-50" },
  { name: "صيانة منزلية", description: "فحص الوصلات والتسريب والخزان مع فني يصل إلى بابك.", image: serviceKitImage, tone: "bg-amber-50" },
  { name: "مبردات مياه", description: "اختيارات عملية للمطبخ والمكتب مع توضيح المواصفات قبل الطلب.", image: dispenserHomeImage, tone: "bg-sky-50" },
];

type SavedRequest = {
  number: string;
  followUpDate: string;
  appointmentDate: string;
  appointmentPeriod: string;
  status: "new" | "contacted" | "scheduled";
};

const statusLabels: Record<SavedRequest["status"], string> = {
  new: "تم استلام الطلب",
  contacted: "تم التواصل مع العميل",
  scheduled: "تم تحديد موعد الزيارة",
};

export default function PublicDemo() {
  const [requestSent, setRequestSent] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingResult, setTrackingResult] = useState<"found" | "missing" | null>(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentPeriod, setAppointmentPeriod] = useState("الفترة المسائية");
  const [savedRequest, setSavedRequest] = useState<SavedRequest | null>(() => {
    try {
      const raw = window.localStorage.getItem("purepoint_demo_request");
      return raw ? (JSON.parse(raw) as SavedRequest) : null;
    } catch {
      return null;
    }
  });

  const [reviewName, setReviewName] = useState("");
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewConsent, setReviewConsent] = useState(false);
  const approvedReviews = { isLoading: false, data: [] as Array<{ id: number; customerName: string; stars: number; comment: string }> };
  const submitReview = { isPending: false };

  const submitReviewForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReviewName("");
    setReviewStars(5);
    setReviewComment("");
    setReviewConsent(false);
    window.alert("شكرًا لك. تم استلام تقييمك للمراجعة. سيتم تفعيل الإرسال العام في النسخة التالية.");
  };

  const followUpDate = new Intl.DateTimeFormat("ar-SA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));

  const shareUrl = () => window.location.href;
  const shareText = "نقطة نقاء - خدمات فلاتر مياه في الرياض";

  const shareSite = async () => {
    if (navigator.share) {
      await navigator.share({ title: shareText, text: "تركيب وصيانة فلاتر مياه وخدمة منزلية داخل الرياض", url: shareUrl() });
    } else {
      await navigator.clipboard?.writeText(shareUrl());
      window.alert("تم نسخ رابط الموقع، ويمكنك مشاركته في أي تطبيق.");
    }
  };

  const copySiteLink = async () => {
    await navigator.clipboard?.writeText(shareUrl());
    window.alert("تم نسخ رابط الموقع.");
  };

  const copyOrderNumber = async () => {
    await navigator.clipboard?.writeText(orderNumber);
    window.alert("تم نسخ رقم الطلب.");
  };

  const openWhatsApp = (message = "مرحبًا، أريد طلب خدمة فلاتر مياه في الرياض") => {
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const trackRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = trackingNumber.trim().toUpperCase();
    setTrackingResult(savedRequest?.number === normalized ? "found" : "missing");
  };

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const generatedNumber = `PP-${Date.now().toString().slice(-6)}`;
    const request: SavedRequest = {
      number: generatedNumber,
      followUpDate,
      appointmentDate: appointmentDate || "سيتم تحديده بالتواصل مع العميل",
      appointmentPeriod,
      status: appointmentDate ? "scheduled" : "new",
    };
    window.localStorage.setItem("purepoint_demo_request", JSON.stringify(request));
    setSavedRequest(request);
    setOrderNumber(generatedNumber);
    setRequestSent(true);
  };

  if (requestSent) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#063c3a_0%,#087f79_60%,#d9f7f1_100%)] px-4 py-10 text-slate-900">
        <main className="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl sm:p-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-9 w-9" /></div>
          <p className="mt-5 text-center text-sm font-black text-teal-700">نقطة نقاء · الرياض</p>
          <h1 className="mt-2 text-center text-3xl font-black text-teal-950">تم استلام طلبك بنجاح</h1>
          <p className="mt-3 text-center leading-7 text-slate-600">احتفظ برقم الطلب لمتابعة حالته والتواصل مع فريق الخدمة.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-teal-50 p-4"><p className="text-sm font-bold text-teal-700">رقم الطلب</p><p className="mt-2 text-xl font-black tracking-wide text-teal-950">{orderNumber}</p><button onClick={copyOrderNumber} type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-700"><Copy className="h-3.5 w-3.5" /> نسخ الرقم</button></div>
            <div className="rounded-2xl bg-amber-50 p-4"><p className="text-sm font-bold text-amber-700">موعد المتابعة المتوقع</p><p className="mt-2 text-base font-black leading-7 text-amber-950">{followUpDate}</p></div>
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700"><p><span className="font-black">الموعد المطلوب:</span> {savedRequest?.appointmentDate}</p><p><span className="font-black">الفترة:</span> {savedRequest?.appointmentPeriod}</p></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={shareSite} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 font-black text-white"><Share2 className="h-4 w-4" /> مشاركة الموقع</button><button type="button" onClick={copySiteLink} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-50 px-4 font-black text-teal-800"><Copy className="h-4 w-4" /> نسخ الرابط</button></div>
          <button type="button" onClick={() => { setRequestSent(false); setOrderNumber(""); }} className="mt-5 w-full text-sm font-bold text-teal-700 underline underline-offset-4">إرسال طلب جديد</button>
        </main>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-[#f5fbfa] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-teal-950/10 bg-white/90 backdrop-blur-lg"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6"><a href="#top" className="flex shrink-0 items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20"><Droplets className="h-6 w-6" /></span><span><strong className="block text-base font-black text-teal-950">نقطة نقاء</strong><small className="text-xs font-bold text-teal-700">فلاتر مياه في الرياض</small></span></a><nav className="hidden items-center gap-5 text-sm font-black text-slate-600 lg:flex" aria-label="التنقل الرئيسي"><a href="#services" className="transition hover:text-teal-700">خدماتنا</a><a href="#catalog" className="transition hover:text-teal-700">المنتجات</a><a href="#offers" className="transition hover:text-teal-700">العروض</a><a href="#gallery" className="transition hover:text-teal-700">المعرض</a><a href="#contact" className="transition hover:text-teal-700">تواصل معنا</a></nav><a href="tel:+201008797774" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-sm font-black text-teal-800 sm:px-4"><Phone className="h-4 w-4" /> <span className="hidden sm:inline">اتصل الآن</span></a></div></header>

      <main id="top">
        <section className="relative isolate overflow-hidden bg-[linear-gradient(120deg,#063c3a_0%,#087f79_56%,#39b9a7_100%)] text-white"><div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-20"><div><p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold"><MapPin className="h-4 w-4" /> خدمة منزلية داخل الرياض</p><h1 className="max-w-2xl text-4xl font-black leading-[1.2] sm:text-6xl">مياه أنقى، وصيانة تصل إلى بابك</h1><p className="mt-5 max-w-xl text-base leading-8 text-teal-50 sm:text-lg">تركيب وصيانة فلاتر مياه الشرب وتغيير الشمعات والممبرين بخدمة واضحة وسريعة داخل أحياء الرياض.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button onClick={() => openWhatsApp()} className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-black text-teal-900 shadow-xl transition hover:-translate-y-0.5"><MessageCircle className="h-5 w-5" /> اطلب الخدمة عبر واتساب</button><a href="#catalog" className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-6 font-black text-white transition hover:bg-white/15">شاهد المنتجات <ArrowLeft className="h-5 w-5" /></a></div><div className="mt-7 flex flex-wrap gap-5 text-sm font-bold text-teal-50"><span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> فنيون موثوقون</span><span className="flex items-center gap-2"><Clock3 className="h-5 w-5" /> مواعيد مرنة</span></div></div><div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur-sm"><img src={heroImage} alt="فني يركب فلتر مياه منزلي في الرياض" className="h-64 w-full object-cover sm:h-80" /><div className="p-5 sm:p-7"><p className="text-sm font-bold text-teal-50">خدمة منزلية واضحة</p><h2 className="mt-2 text-2xl font-black">احجز زيارة لفحص الفلتر</h2><form onSubmit={submitRequest} className="mt-6 space-y-3"><input required className="h-12 w-full rounded-xl border-0 bg-white px-4 text-right text-slate-900 outline-none ring-teal-300 placeholder:text-slate-400 focus:ring-2" placeholder="اسم العميل" /><input required type="tel" className="h-12 w-full rounded-xl border-0 bg-white px-4 text-right text-slate-900 outline-none ring-teal-300 placeholder:text-slate-400 focus:ring-2" placeholder="رقم الجوال" /><select className="h-12 w-full rounded-xl border-0 bg-white px-4 text-right text-slate-900 outline-none ring-teal-300 focus:ring-2"><option>اختر نوع الخدمة</option><option>تركيب فلتر جديد</option><option>صيانة فلتر</option><option>تغيير شمعات</option><option>فحص واستشارة</option></select><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-teal-50">اليوم المطلوب<input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} className="mt-1 h-11 w-full rounded-xl bg-white px-3 text-right text-slate-900" /></label><label className="text-xs font-bold text-teal-50">الفترة<select value={appointmentPeriod} onChange={(event) => setAppointmentPeriod(event.target.value)} className="mt-1 h-11 w-full rounded-xl bg-white px-3 text-right text-slate-900"><option>الفترة الصباحية</option><option>الفترة المسائية</option></select></label></div><button className="h-12 w-full rounded-xl bg-amber-400 font-black text-amber-950 transition hover:bg-amber-300">إرسال طلب وحجز موعد مبدئي</button></form></div></div></div></section>

        <section id="why-us" className="mx-auto max-w-6xl px-4 py-14 sm:px-6"><div className="grid gap-6 overflow-hidden rounded-[2rem] bg-teal-950 p-7 text-white sm:p-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="font-black text-teal-200">لماذا نقطة نقاء؟</p><h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">خبرة واضحة، خدمة نظيفة، واهتمام يستمر بعد التركيب</h2><p className="mt-4 max-w-lg text-sm leading-8 text-teal-100">نشرح لك ما يحتاجه جهازك قبل التنفيذ، ونرتب الزيارة بما يناسب وقتك، مع متابعة عملية تساعدك على الحفاظ على جودة المياه.</p><button onClick={() => openWhatsApp()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-black text-amber-950 transition hover:bg-amber-300"><MessageCircle className="h-4 w-4" /> تحدث مع فريقنا</button></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/10 p-5"><Award className="h-7 w-7 text-amber-300" /><h3 className="mt-4 font-black">تركيب احترافي</h3><p className="mt-2 text-sm leading-7 text-teal-100">تنظيم الوصلات وشرح الاستخدام بعد انتهاء الزيارة.</p></div><div className="rounded-2xl bg-white/10 p-5"><ShieldCheck className="h-7 w-7 text-amber-300" /><h3 className="mt-4 font-black">جودة ووضوح</h3><p className="mt-2 text-sm leading-7 text-teal-100">نعرض التكلفة والخطوات قبل التنفيذ دون مفاجآت.</p></div><div className="rounded-2xl bg-white/10 p-5"><Clock3 className="h-7 w-7 text-amber-300" /><h3 className="mt-4 font-black">مواعيد مرنة</h3><p className="mt-2 text-sm leading-7 text-teal-100">اختر اليوم والفترة المناسبة لزيارة المنزل.</p></div><div className="rounded-2xl bg-white/10 p-5"><HeartHandshake className="h-7 w-7 text-amber-300" /><h3 className="mt-4 font-black">متابعة بعد الخدمة</h3><p className="mt-2 text-sm leading-7 text-teal-100">نترك لك فهمًا أفضل لما يحتاجه الفلتر لاحقًا.</p></div></div></div></section>

        <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><div className="max-w-2xl"><p className="font-black text-teal-700">خدماتنا</p><h2 className="mt-2 text-3xl font-black text-teal-950 sm:text-4xl">حلول كاملة لمياه البيت</h2><p className="mt-3 leading-8 text-slate-600">من التركيب الأول إلى تغيير الشمعات والمتابعة الدورية، نساعدك في الحفاظ على أداء الفلتر ونظافة المياه.</p></div><div className="mt-8 grid gap-5 md:grid-cols-3"><article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-teal-950/8"><img src={cartridgesImage} alt="شموع وقطع غيار فلاتر المياه" className="h-52 w-full object-cover" /><div className="p-6"><div className="flex items-center gap-2 text-teal-700"><Sparkles className="h-5 w-5" /><h3 className="text-lg font-black text-teal-950">تغيير الشمعات والممبرين</h3></div><p className="mt-2 text-sm leading-7 text-slate-600">قطع مناسبة للفلتر وخدمة تغيير منظمة تساعد على عودة تدفق المياه بشكل أفضل.</p></div></article><article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-teal-950/8"><img src={maintenanceImage} alt="فني صيانة فلتر مياه منزلي" className="h-52 w-full object-cover" /><div className="p-6"><div className="flex items-center gap-2 text-teal-700"><Wrench className="h-5 w-5" /><h3 className="text-lg font-black text-teal-950">صيانة وفحص منزلي</h3></div><p className="mt-2 text-sm leading-7 text-slate-600">فحص التسريب، الخزان، الوصلات، والمراحل مع شرح واضح لما يحتاجه جهازك.</p></div></article><article className="rounded-3xl bg-teal-900 p-6 text-white shadow-sm"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><ShieldCheck className="h-6 w-6" /></div><h3 className="mt-5 text-lg font-black">تركيب ومتابعة</h3><p className="mt-2 text-sm leading-7 text-teal-50">تركيب مرتب وشرح للاستخدام، مع تذكير مقترح بالخدمة القادمة بعد التركيب أو الصيانة.</p><button onClick={() => openWhatsApp()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-amber-950">اسأل عن الخدمة <ArrowLeft className="h-4 w-4" /></button></article></div></section>

        <section id="catalog" className="bg-white px-4 py-16 sm:px-6"><div className="mx-auto max-w-6xl"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-black text-teal-700">كتالوج المنتجات</p><h2 className="mt-2 text-3xl font-black text-teal-950">اختيارات تناسب احتياج منزلك</h2></div><p className="max-w-md text-sm leading-7 text-slate-600">اسألنا عن النوع المناسب قبل الشراء، وسنوضح لك المواصفات والتكلفة قبل التنفيذ.</p></div><div className="mt-8 grid gap-5 md:grid-cols-3">{products.map((product) => <article key={product.name} className={`overflow-hidden rounded-3xl ${product.tone} ring-1 ring-teal-950/8`}><img src={product.image} alt={product.name} className="h-48 w-full object-cover" /><div className="p-5"><h3 className="text-xl font-black text-teal-950">{product.name}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{product.description}</p><button onClick={() => openWhatsApp()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-black text-white">استفسر عن المنتج <MessageCircle className="h-4 w-4" /></button></div></article>)}</div></div></section>

        <section id="offers" className="mx-auto max-w-6xl px-4 py-14 sm:px-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-black text-teal-700">عروض تجريبية</p><h2 className="mt-2 text-3xl font-black text-teal-950">اختار عرضك واطلبه بسهولة</h2></div><span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-900">الأسعار للتجربة وقابلة للتعديل</span></div><div className="mt-7 grid gap-5 lg:grid-cols-2"><article className="group overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-teal-950/8 transition hover:-translate-y-1 hover:shadow-xl"><div className="relative"><img src={premiumFilterImage} alt="عرض فلتر مياه منزلي" className="h-56 w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute right-4 top-4 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-amber-950">الأكثر طلبًا</span></div><div className="p-6"><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-black text-teal-950">عرض تركيب فلتر 7 مراحل</h3><p className="mt-2 text-sm leading-7 text-slate-600">فلتر منزلي متعدد المراحل مع تركيب وفحص أولي وتوضيح طريقة الاستخدام.</p></div><div className="shrink-0 text-left"><p className="text-xs font-bold text-slate-500">يبدأ من</p><p className="text-2xl font-black text-teal-700">٧٩٩ <span className="text-sm">ر.س</span></p></div></div><button onClick={() => openWhatsApp("مرحبًا، أريد حجز عرض تركيب فلتر 7 مراحل بالسعر التجريبي 799 ريال") } className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 font-black text-white transition hover:bg-teal-800"><MessageCircle className="h-4 w-4" /> احجز العرض عبر واتساب</button></div></article><article className="group overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-teal-950/8 transition hover:-translate-y-1 hover:shadow-xl"><div className="relative"><img src={premiumCartridgesImage} alt="عرض تغيير شمعات فلتر المياه" className="h-56 w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute right-4 top-4 rounded-full bg-teal-700 px-3 py-1.5 text-xs font-black text-white">صيانة دورية</span></div><div className="p-6"><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-black text-teal-950">عرض تغيير الشمعات</h3><p className="mt-2 text-sm leading-7 text-slate-600">تغيير مجموعة الشمعات الأساسية مع فحص الوصلات والتأكد من جودة التدفق.</p></div><div className="shrink-0 text-left"><p className="text-xs font-bold text-slate-500">سعر تجريبي</p><p className="text-2xl font-black text-teal-700">١٤٩ <span className="text-sm">ر.س</span></p></div></div><button onClick={() => openWhatsApp("مرحبًا، أريد حجز عرض تغيير الشمعات بالسعر التجريبي 149 ريال") } className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 font-black text-amber-950 transition hover:bg-amber-300"><MessageCircle className="h-4 w-4" /> احجز العرض عبر واتساب</button></div></article><article className="group overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-teal-950/8 transition hover:-translate-y-1 hover:shadow-xl"><div className="relative"><img src={serviceKitImage} alt="عرض فحص وصيانة فلتر المياه" className="h-56 w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute right-4 top-4 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-amber-950">عرض محدود</span></div><div className="p-6"><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-black text-teal-950">عرض الفحص والصيانة</h3><p className="mt-2 text-sm leading-7 text-slate-600">فحص شامل للوصلات والخزان والتسريب مع تقرير مبسط بما يحتاجه الفلتر.</p></div><div className="shrink-0 text-left"><p className="text-xs font-bold text-slate-500">سعر تجريبي</p><p className="text-2xl font-black text-teal-700">٩٩ <span className="text-sm">ر.س</span></p></div></div><button onClick={() => openWhatsApp("مرحبًا، أريد حجز عرض فحص وصيانة الفلتر بالسعر التجريبي 99 ريال") } className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 font-black text-white transition hover:bg-teal-800"><MessageCircle className="h-4 w-4" /> احجز العرض عبر واتساب</button></div></article></div></section>

        <section className="bg-white px-4 py-14 sm:px-6"><div className="mx-auto max-w-6xl"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-black text-teal-700">من قلب الخدمة</p><h2 className="mt-2 text-3xl font-black text-teal-950">صور توضح جودة اهتمامنا</h2></div><p className="max-w-md text-sm leading-7 text-slate-600">من المنتج إلى التركيب، نرتب لك التجربة بصورة واضحة قبل الحجز.</p></div><div className="mt-7 grid gap-4 sm:grid-cols-2"><figure className="group overflow-hidden rounded-3xl"><img src={premiumServiceImage} alt="خدمة منزلية لفلاتر المياه" className="h-64 w-full object-cover transition duration-500 group-hover:scale-105" /><figcaption className="bg-teal-950 p-4 text-sm font-black text-white">خدمة منزلية منظمة</figcaption></figure><figure className="group overflow-hidden rounded-3xl"><img src={coolerImage} alt="مبرد مياه للاستخدام اليومي" className="h-64 w-full object-cover transition duration-500 group-hover:scale-105" /><figcaption className="bg-amber-500 p-4 text-sm font-black text-amber-950">حلول مياه للمنزل والمكتب</figcaption></figure></div></div></section>

        <section id="gallery" className="mx-auto max-w-6xl px-4 py-14 sm:px-6"><div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><div className="grid gap-4 sm:grid-cols-2"><img src={installationDetailImage} alt="تفاصيل تركيب فلتر مياه تحت الحوض" className="h-64 w-full rounded-3xl object-cover sm:h-72" /><img src={technicianTrustImage} alt="فني نقطة نقاء أثناء الخدمة" className="h-64 w-full rounded-3xl object-cover sm:h-72" /></div><div className="relative overflow-hidden rounded-3xl bg-teal-900 p-7 text-white sm:p-9"><img src={clearWaterImage} alt="مياه نقية بجانب فلتر المياه" className="absolute inset-0 h-full w-full object-cover opacity-35" /><div className="relative"><p className="font-black text-teal-100">معرض نقطة نقاء</p><h2 className="mt-2 text-3xl font-black leading-tight">تفاصيل صغيرة تصنع فرقًا كبيرًا في جودة الخدمة</h2><p className="mt-4 text-sm leading-8 text-teal-50">نشاركك صورًا من المنتجات والتركيبات والخدمة المنزلية لتعرف ما تتوقعه قبل الحجز.</p><a href="#contact" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-teal-900">اطلب استشارة <ArrowLeft className="h-4 w-4" /></a></div></div></div></section>

        <section id="contact" className="mx-auto max-w-6xl px-4 py-14 sm:px-6"><div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]"><div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-teal-950/8 sm:p-9"><p className="font-black text-teal-700">تواصل معنا</p><h2 className="mt-2 text-3xl font-black text-teal-950">نصل إليك داخل الرياض</h2><p className="mt-3 text-sm leading-8 text-slate-600">للحجز والاستفسار عن المنتجات والأسعار التجريبية، تواصل معنا مباشرة عبر الهاتف أو واتساب.</p><div className="mt-6 space-y-4"><a href="tel:+201008797774" className="flex items-center gap-3 rounded-2xl bg-teal-50 p-4 font-black text-teal-900"><Phone className="h-5 w-5 text-teal-700" /> 01008797774</a><button onClick={() => openWhatsApp()} className="flex w-full items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-right font-black text-emerald-900"><MessageCircle className="h-5 w-5 text-emerald-600" /> تواصل عبر واتساب</button><div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700"><MapPinned className="mt-1 h-5 w-5 shrink-0 text-teal-700" /><span><strong className="block text-teal-950">الرياض، المملكة العربية السعودية</strong>خدمة منزلية حسب نطاق التغطية والمواعيد المتاحة.</span></div><div className="flex items-center gap-4 text-teal-700"><a href="#" aria-label="إنستغرام" className="rounded-xl bg-teal-50 p-3"><Instagram className="h-5 w-5" /></a><a href="#" aria-label="فيسبوك" className="rounded-xl bg-teal-50 p-3"><Facebook className="h-5 w-5" /></a><span className="text-sm font-bold text-slate-500">مواعيد العمل: يوميًا حسب الحجز</span></div></div></div><div className="overflow-hidden rounded-3xl bg-teal-100 min-h-[360px]"><iframe title="خريطة موقع نقطة نقاء في الرياض" src="https://www.google.com/maps?q=Riyadh%20Saudi%20Arabia&output=embed" className="h-full min-h-[360px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></div></section>

        <section id="track" className="mx-auto max-w-6xl px-4 py-14 sm:px-6"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-7 shadow-sm ring-1 ring-teal-950/8 sm:p-9"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-700"><CheckCircle2 className="h-6 w-6" /></div><div><p className="font-black text-teal-700">متابعة الطلب</p><h2 className="mt-1 text-2xl font-black text-teal-950">اعرف آخر حالة لطلبك</h2><p className="mt-2 text-sm leading-7 text-slate-600">أدخل رقم الطلب الذي ظهر لك بعد إرسال الطلب. في هذه النسخة التجريبية، يمكن تتبع الطلب المحفوظ على هذا الجهاز.</p></div></div><form onSubmit={trackRequest} className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={trackingNumber} onChange={(event) => { setTrackingNumber(event.target.value); setTrackingResult(null); }} className="h-12 min-w-0 flex-1 rounded-xl border border-teal-100 bg-teal-50 px-4 text-left font-bold text-teal-950 outline-none placeholder:text-right placeholder:text-slate-400 focus:ring-2 focus:ring-teal-300" placeholder="مثال: PP-123456" aria-label="رقم الطلب" /><button className="h-12 rounded-xl bg-teal-700 px-6 font-black text-white transition hover:bg-teal-800">تتبع الطلب</button></form>{trackingResult === "found" && savedRequest ? <div className="mt-5 grid gap-3 rounded-2xl bg-emerald-50 p-5 sm:grid-cols-3"><div><p className="text-sm font-bold text-emerald-700">حالة الطلب</p><p className="mt-1 font-black text-emerald-950">{statusLabels[savedRequest.status]}</p></div><div><p className="text-sm font-bold text-emerald-700">موعد المتابعة</p><p className="mt-1 font-black text-emerald-950">{savedRequest.followUpDate}</p></div><div><p className="text-sm font-bold text-emerald-700">الموعد المطلوب</p><p className="mt-1 font-black text-emerald-950">{savedRequest.appointmentDate}</p></div></div> : null}{trackingResult === "missing" ? <div className="mt-5 rounded-2xl bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">لم نعثر على هذا الرقم في النسخة التجريبية. راجع الرقم أو أرسل طلبًا جديدًا عبر واتساب.</div> : null}</div></section>

        <section className="mx-auto max-w-6xl px-4 pb-2 pt-4 sm:px-6"><div className="flex flex-col gap-4 rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 text-sm font-black text-amber-800"><Sparkles className="h-4 w-4" /> عرض هذا الشهر</p><h2 className="mt-2 text-2xl font-black text-amber-950">فحص فلتر المنزل مع خصم 15٪ على أجرة الخدمة</h2><p className="mt-2 text-sm leading-7 text-amber-900/80">نحدد لك ما يحتاجه الفلتر من صيانة أو تغيير شمعات، ثم نوضح التكلفة قبل التنفيذ.</p></div><button onClick={() => openWhatsApp()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-amber-950 transition hover:bg-amber-300"><MessageCircle className="h-4 w-4" /> احجز العرض عبر واتساب</button></div></section>

        <section id="reviews" className="mx-auto max-w-6xl px-4 py-14 sm:px-6"><div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-teal-950/8 sm:p-8"><p className="font-black text-teal-700">رأيك يهمنا</p><h2 className="mt-2 text-2xl font-black text-teal-950">شاركنا تجربتك مع نقطة نقاء</h2><p className="mt-2 text-sm leading-7 text-slate-600">اكتب تقييمك بعد الخدمة. لن يظهر للزوار إلا بعد المراجعة والموافقة.</p><form onSubmit={submitReviewForm} className="mt-6 space-y-4"><label className="block"><span className="field-label">الاسم</span><input required minLength={2} value={reviewName} onChange={event => setReviewName(event.target.value)} className="field-input" placeholder="اسمك الكريم" /></label><div><span className="field-label">التقييم</span><div className="mt-2 flex gap-1" role="radiogroup" aria-label="عدد النجوم">{[1, 2, 3, 4, 5].map(star => <button key={star} type="button" role="radio" aria-checked={reviewStars === star} aria-label={`${star} نجوم`} onClick={() => setReviewStars(star)} className={`rounded-lg p-1 transition ${reviewStars >= star ? "text-amber-500" : "text-slate-300"}`}><Star className="h-7 w-7 fill-current" /></button>)}</div></div><label className="block"><span className="field-label">التعليق</span><textarea required minLength={8} maxLength={1200} value={reviewComment} onChange={event => setReviewComment(event.target.value)} className="field-input min-h-28 resize-y" placeholder="ما الذي أعجبك في الخدمة؟" /></label><label className="flex items-start gap-2 text-sm leading-6 text-slate-600"><input required type="checkbox" checked={reviewConsent} onChange={event => setReviewConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-teal-700" />أوافق على نشر اسمي وتقييمي على الموقع بعد المراجعة.</label><button disabled={submitReview.isPending} className="h-12 w-full rounded-xl bg-teal-700 font-black text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60">{submitReview.isPending ? "جارٍ إرسال التقييم..." : "إرسال التقييم للمراجعة"}</button></form></div><div className="rounded-3xl bg-teal-50 p-6 sm:p-8"><div className="flex items-center justify-between gap-3"><div><p className="font-black text-teal-700">تقييمات منشورة</p><h2 className="mt-2 text-2xl font-black text-teal-950">تجارب العملاء بعد الاعتماد</h2></div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-amber-500 shadow-sm"><Star className="h-6 w-6 fill-current" /></div></div><div className="mt-6 space-y-3">{approvedReviews.isLoading ? <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">جارٍ تحميل التقييمات...</p> : approvedReviews.data?.length ? approvedReviews.data.map(review => <article key={review.id} className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-teal-950">{review.customerName}</h3><span className="flex items-center gap-0.5 text-amber-500" aria-label={`${review.stars} نجوم`}>{Array.from({ length: review.stars }, (_, index) => <Star key={index} className="h-4 w-4 fill-current" />)}</span></div><p className="mt-3 text-sm leading-7 text-slate-600">{review.comment}</p></article>) : <p className="rounded-2xl bg-white p-5 text-sm leading-7 text-slate-600">لا توجد تقييمات منشورة بعد. كن أول من يشارك تجربته.</p>}</div></div></div></section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6"><div className="rounded-3xl bg-teal-950 p-7 text-white sm:p-10"><div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-teal-200">شارك الموقع</p><h2 className="mt-2 text-2xl font-black">ساعد من يحتاج خدمة فلاتر في الرياض</h2><p className="mt-2 max-w-xl text-sm leading-7 text-teal-100">يمكنك مشاركة الموقع مباشرة من الهاتف أو نسخ الرابط وإرساله لمن يحتاج الخدمة.</p></div><div className="flex flex-wrap gap-3"><button onClick={shareSite} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-teal-900"><Share2 className="h-4 w-4" /> مشاركة</button><button onClick={copySiteLink} className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-sm font-black text-white"><Copy className="h-4 w-4" /> نسخ الرابط</button></div></div></div></section>
      </main>

      <a href="tel:+201008797774" className="fixed bottom-5 left-5 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-amber-400 px-5 font-black text-amber-950 shadow-xl shadow-amber-900/20 transition hover:scale-105 sm:hidden"><Phone className="h-5 w-5" /> اتصل الآن</a>
      <footer className="border-t border-teal-950/10 bg-white px-4 py-8 text-center text-sm text-slate-500"><p className="font-bold text-teal-900">نقطة نقاء · تركيب وصيانة فلاتر مياه في الرياض</p><p className="mt-2">للاستفسار والحجز: 01008797774</p></footer>
    </div>
  );
}
