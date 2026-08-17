import { Badge } from "@/components/ui/badge";
import { PinVerificationDialog } from "@/components/PinVerificationDialog";
import { CustomerContactActions } from "@/components/CustomerContactActions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatDateTime, visitTypeLabels } from "@/lib/filterUi";
import { customerExcelHeaders, customerRowsForExcel, downloadRowsAsExcel, withArabicHeaders } from "@/lib/excelExport";
import { printArabicPdf } from "@/lib/pdfExport";
import { cacheOfflineCustomers, cacheOfflineInventory, cacheOfflineServiceCatalog, getOfflineCustomers, getOfflineInventory, getOfflineServiceCatalog, getOfflineSession, hasOfflineCustomerName, queueOfflineCustomer, queueOfflineVisit } from "@/lib/offlineSync";
import { moveToTrash } from "@/lib/trashBin";
import { AlertCircle, CheckCircle2, Clock3, Download, Loader2, Pencil, Plus, Search, UsersRound } from "lucide-react";
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type VisitType = "installation" | "maintenance" | "cartridge_change" | "follow_up" | "other";
type OfflineInventorySnapshot = { items: Array<{ id: number; name: string; currentBalance: number }>; movements: Array<{ id: number; inventoryItemId: number; inventoryItemName: string; movementType: "incoming" | "outgoing"; quantity: number; movementDate: string; technicianName?: string | null; notes?: string | null }> };
type CustomerForm = { id?: number; manualCode: string; name: string; phone: string; address: string; location: string; notes: string; firstVisitType: VisitType; firstVisitDate: string; firstTechnicianName: string; firstVisitResult: string; firstVisitNotes: string; firstCollectedAmount: string };
function toDateTimeLocal() { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
function parseLocation(value: string) { const trimmed = value.trim(); const match = trimmed.match(/(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)/); return { latitude: match?.[1] ?? null, longitude: match?.[2] ?? null }; }
function followUpBadge(daysRemaining: number) { if (daysRemaining < 0) return { label: "متأخر", className: "border-rose-200 bg-rose-100 text-rose-800 hover:bg-rose-100", ariaLabel: "العميل متأخر عن موعد المتابعة" }; if (daysRemaining <= 5) return { label: daysRemaining === 0 ? "قريب · اليوم" : "قريب", className: "border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100", ariaLabel: daysRemaining === 0 ? "موعد متابعة العميل قريب وهو اليوم" : "موعد متابعة العميل قريب" }; return { label: "منتظم", className: "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100", ariaLabel: "تمت متابعة العميل ولا توجد متابعة مستحقة حاليًا" }; }
const emptyCustomer: CustomerForm = { manualCode: "", name: "", phone: "", address: "", location: "", notes: "", firstVisitType: "installation", firstVisitDate: toDateTimeLocal(), firstTechnicianName: "", firstVisitResult: "", firstVisitNotes: "", firstCollectedAmount: "" };

export function buildPartsConfirmation(items: Array<{ inventoryItemId: number; quantity: number }>, catalogItems: Array<{ id: number; name: string }>) {
  const summary = items.map(item => {
    const catalogItem = catalogItems.find(entry => entry.id === item.inventoryItemId);
    return `• ${catalogItem?.name ?? `صنف رقم ${item.inventoryItemId}`}: ${item.quantity}`;
  }).join("\\n");
  return `قطع الغيار التي سيتم صرفها:\\n${summary}\\n\\nهل تريد حفظ الزيارة وخصم هذه الكميات من المخزن؟`;
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState<"all" | "overdue" | "today" | "upcoming" | "regular">("all");
  const [sortBy, setSortBy] = useState<"created_desc" | "next_asc" | "next_desc" | "status" | "collected_desc" | "collected_asc">("created_desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyCustomer);
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [visitCustomer, setVisitCustomer] = useState<NonNullable<typeof customers>[number] | null>(null);
  const [visitPickerOpen, setVisitPickerOpen] = useState(false);
  const [visitPickerCustomerId, setVisitPickerCustomerId] = useState("");
  const [visitType, setVisitType] = useState<keyof typeof visitTypeLabels>("maintenance");
  const [visitDate, setVisitDate] = useState(toDateTimeLocal());
  const [visitNotes, setVisitNotes] = useState("");
  const [visitResult, setVisitResult] = useState("");
  const [visitTechnicianName, setVisitTechnicianName] = useState("");
  const [visitCollectedAmount, setVisitCollectedAmount] = useState("");
  const [visitItems, setVisitItems] = useState<Array<{ inventoryItemId: number; quantity: number; source: "default" | "manual" }>>([]);
  const [manualItemName, setManualItemName] = useState("");
  const [manualItemQuantity, setManualItemQuantity] = useState("1");
  const input = useMemo(() => ({ search: search || undefined, followUpStatus, sortBy }), [search, followUpStatus, sortBy]);
  const statusInput = useMemo(() => ({ search: search || undefined, followUpStatus: "all" as const, sortBy }), [search, sortBy]);
  const { data: customers, isLoading, isError } = trpc.filters.customers.list.useQuery(input);
  const { data: statusCustomers } = trpc.filters.customers.list.useQuery(statusInput);
  const serviceCatalogQuery = trpc.filters.serviceTypes?.list?.useQuery?.();
  const serviceCatalog = serviceCatalogQuery?.data;
  const [offlineServiceCatalog, setOfflineServiceCatalog] = useState(() => getOfflineServiceCatalog());
  const effectiveServiceCatalog = serviceCatalog ?? offlineServiceCatalog;
  const [offlineCustomers, setOfflineCustomers] = useState(() => getOfflineCustomers());
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();
  const createCustomer = trpc.filters.customers.create.useMutation({ onSuccess: () => { utils.filters.customers.list.invalidate(); utils.filters.dashboard.invalidate(); toast.success("تمت إضافة العميل بنجاح"); setDialogOpen(false); }, onError: error => toast.error(error.message || "تعذر إضافة العميل. يرجى المحاولة مرة أخرى.") });
  const deleteCustomer = trpc.filters.customers.delete.useMutation({ onSuccess: () => { utils.filters.customers.list.invalidate(); utils.filters.dashboard.invalidate(); setDeleteId(null); toast.success("تم حذف العميل وسجلاته المرتبطة"); }, onError: error => toast.error(error.message || "تعذر حذف العميل.") });

  const createVisit = trpc.filters.visits.create.useMutation({
    onSuccess: result => {
      utils.filters.customers.list.invalidate();
      utils.filters.dashboard.invalidate();
      utils.filters.reminders.due.invalidate();
      utils.filters.inventory.summary.invalidate();
      setVisitCustomer(null);
      setVisitNotes("");
      setVisitResult("");
      setVisitTechnicianName("");
      setVisitCollectedAmount("");
      toast.success(result.reminderCreated ? "تم تسجيل الزيارة وإنشاء تذكير بعد 120 يومًا" : "تم تسجيل الزيارة بنجاح");
    },
    onError: error => toast.error(error.message || "تعذر تسجيل الزيارة. يرجى المحاولة مرة أخرى."),
  });

  const updateCustomer = trpc.filters.customers.update.useMutation({ onSuccess: () => { utils.filters.customers.list.invalidate(); utils.filters.customers.get.invalidate(); utils.filters.dashboard.invalidate(); utils.filters.reminders.due.invalidate(); toast.success("تم تعديل بيانات العميل"); setDialogOpen(false); }, onError: error => toast.error(error.message || "تعذر تعديل بيانات العميل. يرجى المحاولة مرة أخرى.") });
  const saving = createCustomer.isPending || updateCustomer.isPending;
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const displayedCustomers = customers ?? offlineCustomers.map(customer => ({
    ...customer,
    address: customer.address ?? null,
    latitude: customer.latitude ?? null,
    longitude: customer.longitude ?? null,
    notes: customer.notes ?? null,
    manualCode: customer.manualCode ?? null,
    customerCode: customer.manualCode || "",
    followUp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerId: getOfflineSession()?.id ?? 0,
    clientOperationId: null,
    lastVisitDate: new Date(0),
    latestTechnicianName: null,
    collectedAmount: 0,
    totalCollectedAmount: 0,
    collectedCurrency: "SAR" as const,
  }));
  const activeFilterLabel = ({ all: "كل العملاء", overdue: "العملاء المتأخرون", today: "عملاء موعد اليوم", upcoming: "التواصل خلال ٥ أيام", regular: "العملاء المنتظمون" } as const)[followUpStatus];
  const statusCards = useMemo(() => {
    const source = statusCustomers ?? (followUpStatus === "all" ? displayedCustomers : offlineCustomers);
    const counts = { all: source.length, overdue: 0, today: 0, upcoming: 0 };
    source.forEach(customer => {
      const followUp = (customer as { followUp?: { daysRemaining: number } | null }).followUp;
      if (!followUp) return;
      const days = followUp.daysRemaining;
      if (days < 0) counts.overdue += 1;
      else if (days === 0) counts.today += 1;
      else if (days <= 5) counts.upcoming += 1;
    });
    return counts;
  }, [statusCustomers, displayedCustomers, offlineCustomers, followUpStatus]);

  useEffect(() => { if (customers) { cacheOfflineCustomers(customers); setOfflineCustomers(getOfflineCustomers()); } }, [customers]);
  useEffect(() => { if (serviceCatalog) { cacheOfflineServiceCatalog(serviceCatalog); setOfflineServiceCatalog(serviceCatalog); } }, [serviceCatalog]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedStatus = params.get("followUpStatus");
    if (["all", "overdue", "today", "upcoming", "regular"].includes(requestedStatus || "")) {
      setFollowUpStatus(requestedStatus as "all" | "overdue" | "today" | "upcoming" | "regular");
    }
    const queryRequestsNew = params.get("new") === "1";
    const queryRequestsVisit = params.get("visit") === "1";
    const requestedCustomerId = params.get("customerId");
    if (queryRequestsNew || location.includes("new=1")) {
      setForm(emptyCustomer);
      setDialogOpen(true);
      window.history.replaceState({}, "", "/customers");
    } else if (queryRequestsVisit || location.includes("visit=1")) {
      const requestedCustomer = requestedCustomerId ? displayedCustomers?.find(item => String(item.id) === requestedCustomerId) : null;
      if (requestedCustomer) {
        openVisit(requestedCustomer);
        setVisitPickerOpen(false);
      } else {
        setVisitPickerCustomerId(requestedCustomerId || "");
        setVisitPickerOpen(true);
      }
      window.history.replaceState({}, "", "/customers");
    }
  }, [location]);

  function chooseVisitCustomer() {
    const customer = displayedCustomers?.find(item => String(item.id) === visitPickerCustomerId);
    if (!customer) {
      toast.error("اختر العميل أولًا");
      return;
    }
    setVisitPickerOpen(false);
    openVisit(customer);
  }

  if (isError && !displayedCustomers) return <div className="soft-card p-8 text-center"><p className="font-bold text-teal-950">تعذر تحميل قائمة العملاء من الخادم.</p><p className="mt-2 text-sm text-muted-foreground">لا توجد نسخة محلية محفوظة على هذا الجهاز بعد. افتح التطبيق مرة واحدة مع الإنترنت لمزامنة البيانات ثم يمكنك استخدامه دون اتصال.</p><Button onClick={() => window.location.reload()} variant="outline" className="mt-4 rounded-xl">إعادة المحاولة</Button></div>;

  function openNew() { setForm(emptyCustomer); setDialogOpen(true); }
  function openVisit(customer: NonNullable<typeof customers>[number]) { setVisitCustomer(customer); setVisitType("maintenance"); setVisitDate(toDateTimeLocal()); setVisitNotes(""); setVisitResult(""); setVisitTechnicianName(""); setVisitCollectedAmount(""); setManualItemName(""); setManualItemQuantity("1"); setVisitItems(getDefaultVisitItems("maintenance")); }
  function getDefaultVisitItems(type: keyof typeof visitTypeLabels) { const catalog = effectiveServiceCatalog; if (!catalog) return []; const service = catalog.types.find(item => item.code === type); if (!service) return []; return catalog.mappings.filter(mapping => mapping.serviceTypeId === service.id).map(mapping => ({ inventoryItemId: mapping.inventoryItemId, quantity: mapping.defaultQuantity, source: "default" as const })); }
  function updateVisitType(type: keyof typeof visitTypeLabels) { setVisitType(type); setVisitItems(getDefaultVisitItems(type)); }
  function addManualVisitItem() {
    const name = manualItemName.trim();
    const catalogItem = effectiveServiceCatalog?.items.find(item => item.name.trim() === name);
    const quantity = Number.parseInt(manualItemQuantity, 10);
    if (!catalogItem) return toast.error("الصنف غير موجود في المخزن؛ أضفه أولًا من صفحة المخزن ثم اختره هنا.");
    if (!Number.isInteger(quantity) || quantity <= 0) return toast.error("أدخل كمية صحيحة أكبر من صفر.");
    setVisitItems(current => {
      const existing = current.find(item => item.inventoryItemId === catalogItem.id);
      if (existing) return current.map(item => item.inventoryItemId === catalogItem.id ? { ...item, quantity: item.quantity + quantity, source: "manual" as const } : item);
      return [...current, { inventoryItemId: catalogItem.id, quantity, source: "manual" as const }];
    });
    setManualItemName(""); setManualItemQuantity("1");
  }
  function submitVisit(event: FormEvent) {
    event.preventDefault();
    if (!visitCustomer) return;
    const collectedAmount = Math.round((Number.parseFloat(visitCollectedAmount) || 0) * 100);
    const payload = { customerId: visitCustomer.id, visitType, visitDate: new Date(visitDate), technicianName: visitTechnicianName || null, visitResult: visitResult || null, collectedAmount, collectedCurrency: "SAR" as const, notes: visitNotes || null, items: visitItems.filter(item => item.quantity > 0) };
    if (payload.items.length > 0) {
      const confirmed = window.confirm(buildPartsConfirmation(payload.items, effectiveServiceCatalog?.items ?? []));
      if (!confirmed) return;
    }
    if (isOffline) {
      const offlineUser = getOfflineSession();
      if (!offlineUser) return toast.error("افتح التطبيق مرة واحدة مع الإنترنت أولًا لتفعيل العمل دون اتصال.");
      const offlineInventory = getOfflineInventory<OfflineInventorySnapshot>(offlineUser.id);
      if (offlineInventory) {
        for (const usedItem of payload.items) {
          const localItem = offlineInventory.items.find(item => item.id === usedItem.inventoryItemId);
          if (!localItem) return toast.error("تعذر العثور على أحد الأصناف في المخزن المحلي.");
          if (usedItem.quantity > localItem.currentBalance) return toast.error(`الرصيد غير كافٍ من صنف ${localItem.name}؛ المتاح ${localItem.currentBalance} والمطلوب ${usedItem.quantity}.`);
        }
        const movementDate = new Date(visitDate).toISOString();
        cacheOfflineInventory(offlineUser.id, { ...offlineInventory, items: offlineInventory.items.map(item => { const used = payload.items.filter(entry => entry.inventoryItemId === item.id).reduce((sum, entry) => sum + entry.quantity, 0); return used ? { ...item, currentBalance: item.currentBalance - used } : item; }), movements: [...(offlineInventory.movements ?? []), ...payload.items.map((entry, index) => ({ id: -Date.now() - index, inventoryItemId: entry.inventoryItemId, inventoryItemName: offlineInventory.items.find(item => item.id === entry.inventoryItemId)?.name ?? "صنف", movementType: "outgoing" as const, quantity: entry.quantity, movementDate, technicianName: visitTechnicianName || null, notes: "منصرف تلقائي من زيارة محفوظة دون اتصال" }))] });
      }
      queueOfflineVisit(offlineUser.id, { ...payload, visitDate: new Date(visitDate).toISOString() });
      toast.success("تم حفظ الزيارة وخصم الأصناف محليًا، وستتم المزامنة تلقائيًا عند عودة الإنترنت.");
      setVisitCustomer(null);
      return;
    }
    createVisit.mutate(payload);
  }
  function openEdit(customer: NonNullable<typeof customers>[number]) { const serviceDate = customer.followUp?.lastServiceVisitDate ? new Date(customer.followUp.lastServiceVisitDate) : new Date(); serviceDate.setMinutes(serviceDate.getMinutes() - serviceDate.getTimezoneOffset()); const location = customer.latitude && customer.longitude ? `${customer.latitude}, ${customer.longitude}` : ""; setForm({ ...emptyCustomer, id: customer.id, manualCode: customer.manualCode || "", name: customer.name, phone: customer.phone, address: customer.address || "", location, notes: customer.notes || "", firstVisitDate: serviceDate.toISOString().slice(0, 16) }); setDialogOpen(true); }
  function submit(event: FormEvent) {
    event.preventDefault();
    const location = parseLocation(form.location);
    if (!form.id && hasOfflineCustomerName(form.name)) {
      toast.error("اسم العميل موجود بالفعل، استخدم اسمًا مختلفًا.");
      return;
    }
    const payload = { manualCode: form.manualCode.trim() || null, name: form.name, phone: form.phone, address: form.address || null, latitude: location.latitude, longitude: location.longitude, notes: form.notes || null, ...(form.id ? {} : { firstVisitType: form.firstVisitType, firstVisitDate: new Date(form.firstVisitDate), firstTechnicianName: form.firstTechnicianName || null, firstVisitResult: form.firstVisitResult || null, firstVisitNotes: form.firstVisitNotes || null, firstCollectedAmount: Math.round(Number(form.firstCollectedAmount || 0) * 100), firstCollectedCurrency: "SAR" as const }) };
    if (form.id) {
      if (isOffline) return toast.error("تعديل البيانات يحتاج اتصالًا بالإنترنت حاليًا.");
      setPendingUpdate({ id: form.id, manualCode: form.manualCode.trim() || null, name: form.name, phone: form.phone, address: form.address || null, latitude: location.latitude, longitude: location.longitude, notes: form.notes || null, serviceDate: new Date(form.firstVisitDate), ...(form.firstCollectedAmount.trim() ? { collectedAmount: Math.round(Number(form.firstCollectedAmount) * 100) } : {}) });
      setPinOpen(true);
      return;
    }
    if (isOffline) {
      const offlineUser = getOfflineSession();
      if (!offlineUser) return toast.error("افتح التطبيق مرة واحدة مع الإنترنت أولًا لتفعيل العمل دون اتصال.");
      try {
        queueOfflineCustomer(offlineUser.id, { ...payload, firstVisitDate: new Date(form.firstVisitDate).toISOString() });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "اسم العميل موجود بالفعل، استخدم اسمًا مختلفًا.");
        return;
      }
      setOfflineCustomers(getOfflineCustomers());
      toast.success("تم حفظ العميل على الجهاز وسيتزامن تلقائيًا عند عودة الإنترنت.");
      setForm(emptyCustomer);
      setDialogOpen(false);
      return;
    }
    createCustomer.mutate(payload);
  }
  function exportCustomers() { if (!displayedCustomers?.length) { toast.info("لا توجد بيانات مطابقة للتصدير"); return; } downloadRowsAsExcel(`عملاء-نقطة-نقاء-${new Date().toISOString().slice(0, 10)}.xlsx`, "العملاء", withArabicHeaders(customerRowsForExcel(displayedCustomers), customerExcelHeaders)); toast.success("تم تجهيز ملف العملاء للتنزيل"); }
  function exportCustomersPdf() { if (!displayedCustomers?.length) { toast.info("لا توجد بيانات مطابقة للتصدير"); return; } const rows = customerRowsForExcel(displayedCustomers); const opened = printArabicPdf("تقرير العملاء", rows, Object.entries(customerExcelHeaders).map(([key, label]) => ({ key, label }))); if (opened) toast.success("تم فتح تقرير PDF للطباعة أو الحفظ"); else toast.error("تعذر فتح نافذة PDF. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى"); }

  return (
    <div className="-mx-4 -mt-2 w-[calc(100%+2rem)] max-w-none space-y-4 px-0 sm:-mx-6 sm:-mt-2 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)]">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="page-heading">إدارة العملاء</h1><p className="page-subheading">احتفظ ببيانات العملاء ومواقعهم وسجل خدماتهم بصورة مرتبة.</p></div><div className="flex flex-wrap gap-2"><Button onClick={exportCustomers} variant="outline" className="h-11 rounded-xl"><Download className="ml-2 h-4 w-4" />تصدير Excel</Button><Button onClick={exportCustomersPdf} variant="outline" className="h-11 rounded-xl"><Download className="ml-2 h-4 w-4" />تصدير PDF</Button><Button onClick={openNew} className="h-11 rounded-xl bg-teal-700 px-5 font-bold hover:bg-teal-800"><Plus className="ml-2 h-5 w-5" />إضافة عميل</Button></div></div>
      <div className="soft-card overflow-hidden"><div className="border-b border-teal-950/6 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className="field-input pr-10" value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث باسم العميل أو هاتفه أو كوده" aria-label="البحث في العملاء" /></div><div className="flex flex-wrap items-center gap-1.5" aria-label="فلاتر حالات العملاء"><button type="button" onClick={() => setFollowUpStatus("all")} className={`min-w-[58px] rounded-lg border px-2 py-1.5 text-[11px] font-extrabold transition ${followUpStatus === "all" ? "border-slate-600 bg-slate-200 text-slate-950 ring-2 ring-slate-400 ring-offset-1 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} data-testid="customer-filter-all" aria-label="فلترة حالة العميل: الكل" aria-pressed={followUpStatus === "all"}>الكل <span className="mr-1">{statusCards.all}</span></button><button type="button" onClick={() => setFollowUpStatus("overdue")} className={`min-w-[62px] rounded-lg border px-2 py-1.5 text-[11px] font-extrabold transition ${followUpStatus === "overdue" ? "border-rose-600 bg-rose-200 text-rose-950 ring-2 ring-rose-400 ring-offset-1 shadow-sm" : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"}`} data-testid="customer-filter-overdue" aria-label="فلترة حالة العميل: متأخر" aria-pressed={followUpStatus === "overdue"}>متأخر <span className="mr-1">{statusCards.overdue}</span></button><button type="button" onClick={() => setFollowUpStatus("today")} className={`min-w-[58px] rounded-lg border px-2 py-1.5 text-[11px] font-extrabold transition ${followUpStatus === "today" ? "border-amber-600 bg-amber-200 text-amber-950 ring-2 ring-amber-400 ring-offset-1 shadow-sm" : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"}`} data-testid="customer-filter-today" aria-label="فلترة حالة العميل: اليوم" aria-pressed={followUpStatus === "today"}>اليوم <span className="mr-1">{statusCards.today}</span></button><button type="button" onClick={() => setFollowUpStatus("upcoming")} className={`min-w-[82px] rounded-lg border px-2 py-1.5 text-[11px] font-extrabold transition ${followUpStatus === "upcoming" ? "border-orange-600 bg-orange-200 text-orange-950 ring-2 ring-orange-400 ring-offset-1 shadow-sm" : "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100"}`} data-testid="customer-filter-upcoming" aria-label="فلترة حالة العميل: خلال ٥ أيام" aria-pressed={followUpStatus === "upcoming"}>خلال ٥ أيام <span className="mr-1">{statusCards.upcoming}</span></button></div><label className="flex items-center gap-2 text-xs font-bold text-teal-900"><span className="whitespace-nowrap">ترتيب</span><select className="field-input min-w-40" value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)} aria-label="ترتيب العملاء"><option value="created_desc">الأحدث إضافة</option><option value="next_asc">أقرب متابعة</option><option value="status">الأولوية</option><option value="collected_desc">الأعلى تحصيلًا</option><option value="collected_asc">الأقل تحصيلًا</option></select></label><Button type="button" variant="outline" className="rounded-xl" onClick={() => { setSearch(""); setFollowUpStatus("all"); setSortBy("created_desc"); }}>مسح</Button></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">ابحث بسرعة، ثم اختر الحالة التي تريد متابعتها اليوم.</span><span className="rounded-full bg-teal-100 px-3 py-1.5 font-extrabold text-teal-900" aria-live="polite">{activeFilterLabel}: {displayedCustomers?.length ?? 0}</span></div></div>
        {isError && displayedCustomers ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">تعذر الوصول إلى الخادم حاليًا؛ تُعرض آخر قائمة عملاء محفوظة على هذا الجهاز، وستتزامن التغييرات عند عودة الاتصال.</div> : null}<div className="max-h-[calc(100vh-18rem)] overflow-auto"><table className="w-full min-w-[560px] table-fixed border border-teal-200/80 text-right text-[13px] sm:text-sm md:min-w-[1040px] [&_td]:border [&_td]:border-teal-100 [&_th]:border [&_th]:border-teal-200/80"><colgroup><col className="w-[160px]" /><col className="w-[102px]" /><col className="w-[145px]" /><col className="w-[115px]" /><col className="w-[92px]" /><col className="w-[92px]" /><col className="w-[105px]" /><col className="w-[140px]" /><col className="w-[190px]" /></colgroup><thead className="sticky top-0 z-10 bg-teal-50 text-xs text-teal-950/65 shadow-[0_2px_8px_rgba(15,118,110,0.08)]"><tr><th className="sticky top-0 z-10 whitespace-nowrap bg-teal-50 px-4 py-3 font-bold">العميل</th><th className="sticky top-0 z-10 whitespace-nowrap bg-teal-50 px-2 py-2 font-bold">الهاتف</th><th className="sticky top-0 z-10 whitespace-nowrap bg-teal-50 px-4 py-3 font-bold">المتابعة القادمة</th><th className="sticky top-0 z-10 hidden bg-teal-50 px-3 py-2 font-bold md:table-cell">آخر زيارة</th><th className="sticky top-0 z-10 hidden whitespace-nowrap bg-teal-50 px-2 py-2 font-bold md:table-cell">الفني</th><th className="sticky top-0 z-10 hidden whitespace-nowrap bg-teal-50 px-2 py-2 font-bold md:table-cell">آخر تحصيل</th><th className="sticky top-0 z-10 hidden whitespace-nowrap bg-teal-50 px-2 py-2 font-bold md:table-cell">إجمالي المحصل</th><th className="sticky top-0 z-10 hidden bg-teal-50 px-3 py-2 font-bold md:table-cell">العنوان</th><th className="sticky top-0 z-10 bg-teal-50 px-3 py-2 font-bold">إجراءات</th></tr></thead><tbody className="divide-y divide-teal-950/6">{isLoading && !displayedCustomers ? <tr><td colSpan={9} className="p-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : displayedCustomers?.length ? displayedCustomers.map(customer => { const followUp = customer.followUp; return <tr key={customer.id} className="h-14 align-middle hover:bg-teal-50/45"><td className="px-2 py-1"><div className="flex items-start gap-1.5"><button type="button" onClick={event => { event.stopPropagation(); if (!followUp) return; setFollowUpStatus(followUp.daysRemaining < 0 ? "overdue" : followUp.daysRemaining === 0 ? "today" : followUp.daysRemaining <= 5 ? "upcoming" : "regular"); }} className={`mt-0.5 inline-flex shrink-0 items-center rounded-full transition ${followUp ? "cursor-pointer hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" : "cursor-default"}`} title={followUp ? "اضغط لفلترة العملاء حسب هذه الحالة" : "لا توجد متابعة مسجلة"} aria-label={followUp ? `حالة متابعة العميل: ${followUp.daysRemaining < 0 ? "متأخر" : followUp.daysRemaining === 0 ? "اليوم" : followUp.daysRemaining <= 5 ? "خلال ٥ أيام" : "منتظم"}` : "لا توجد متابعة مسجلة"}>{followUp && followUp.daysRemaining < 0 ? <AlertCircle className="h-4 w-4 text-rose-600" /> : followUp && followUp.daysRemaining <= 5 ? <Clock3 className="h-4 w-4 text-amber-600" /> : followUp ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}</button><button type="button" onClick={() => setLocation(`/customers/${customer.id}`)} className="min-w-0 flex-1 whitespace-normal break-words text-right font-extrabold leading-5 text-teal-900 hover:text-teal-600" title={customer.name}><span>{customer.name}</span></button></div><p className="mt-0.5 text-xs font-bold tracking-wide text-teal-700" dir="ltr">{customer.customerCode}</p></td><td className="whitespace-nowrap px-2 py-1 text-sm" dir="ltr">{customer.phone}</td><td className="px-3 py-1 text-sm">{followUp ? <><p className="font-bold text-teal-950">{formatDateTime(followUp.nextVisitDate)}</p><p className={`mt-0.5 text-xs font-bold ${followUp.daysRemaining < 0 ? "text-rose-700" : "text-teal-700"}`}>{followUp.daysRemaining < 0 ? `متأخر ${Math.abs(followUp.daysRemaining)} يوم` : followUp.daysRemaining === 0 ? "موعده اليوم" : `متبقي ${followUp.daysRemaining} يوم`}</p>{(() => { const badge = followUpBadge(followUp.daysRemaining); return <Badge className={`mt-1 ${badge.className}`} aria-label={badge.ariaLabel}>{badge.label}</Badge>; })()}</> : <span className="text-muted-foreground">لا يوجد موعد</span>}</td><td className="hidden px-3 py-1 text-sm md:table-cell">{customer.lastVisitDate && customer.lastVisitDate.getTime() > 0 ? formatDateTime(customer.lastVisitDate) : "—"}</td><td className="hidden whitespace-nowrap px-2 py-1 text-sm font-bold text-teal-900 md:table-cell">{customer.latestTechnicianName || "—"}</td><td className="hidden whitespace-nowrap px-2 py-1 text-sm font-bold text-teal-800 md:table-cell">{customer.collectedAmount && customer.collectedAmount > 0 ? `${(customer.collectedAmount / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</td><td className="hidden whitespace-nowrap px-2 py-1 text-sm font-extrabold text-emerald-700 md:table-cell">{customer.totalCollectedAmount > 0 ? (customer.totalCollectedAmount / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</td><td className="hidden max-w-64 truncate px-3 py-1 text-sm text-muted-foreground md:table-cell">{customer.address || "—"}</td><td className="px-3 py-1"><div className="flex flex-wrap items-center gap-2"><CustomerContactActions customer={customer} compact /><button onClick={() => openVisit(customer)} className="inline-flex h-9 items-center gap-1 rounded-lg bg-teal-100 px-2.5 text-xs font-extrabold text-teal-800 hover:bg-teal-200" title="تسجيل زيارة جديدة"><Plus className="h-3.5 w-3.5" />زيارة</button><button onClick={() => setLocation(`/customers/${customer.id}`)} className="inline-flex h-9 items-center gap-1 rounded-lg bg-sky-50 px-2.5 text-xs font-extrabold text-sky-800 hover:bg-sky-100" title="فتح سجل الزيارات">السجل</button><button onClick={() => openEdit(customer)} className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100" title="تعديل"><Pencil className="h-4 w-4" /></button><button onClick={() => setDeleteId(customer.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100" title="حذف">حذف</button></div></td></tr>; }) : <tr><td colSpan={9} className="p-12 text-center"><UsersRound className="mx-auto h-7 w-7 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">لا توجد بيانات عملاء مطابقة.</p></td></tr>}</tbody></table></div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir="rtl"><DialogHeader><DialogTitle>{form.id ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle><DialogDescription>أدخل بيانات العميل والخدمة الأولى، ثم احفظها لتحديث الزيارات والتذكيرات والخزينة تلقائيًا.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4 py-2 sm:grid-cols-2"><div className="rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3 sm:col-span-2"><span className="field-label">كود العميل</span><p className="mt-1 text-lg font-extrabold tracking-wide text-teal-900" dir="ltr">{form.id ? (customers?.find(customer => customer.id === form.id)?.customerCode || "—") : "سيُنشأ تلقائيًا بعد الحفظ"}</p><p className="mt-1 text-xs text-teal-700">يمكنك إدخال الكود يدويًا، وإذا تركته فارغًا يُنشئه النظام تلقائيًا بالتسلسل.</p></div><div className="flex items-end gap-2"><div className="min-w-0 flex-1"><Field label="كود العميل (اختياري)" value={form.manualCode} onChange={value => setForm({ ...form, manualCode: value })} dir="ltr" placeholder="مثال: ١٠٠ أو 100" /></div><button type="button" className="mb-0 h-10 shrink-0 rounded-xl border border-teal-200 bg-white px-3 text-xs font-bold text-teal-800 transition hover:bg-teal-50" onClick={() => setForm({ ...form, manualCode: "" })}>تلقائي</button></div><Field label="اسم العميل" value={form.name} onChange={value => setForm({ ...form, name: value })} required /><Field label="رقم الهاتف" value={form.phone} onChange={value => setForm({ ...form, phone: value })} dir="ltr" required /><div className="sm:col-span-2"><Field label="العنوان" value={form.address} onChange={value => setForm({ ...form, address: value })} /></div><div className="sm:col-span-2 mt-2 rounded-2xl border border-teal-100 bg-teal-50/60 p-4"><p className="mb-3 text-sm font-extrabold text-teal-900">بيانات أول خدمة والتحصيل</p><div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">نوع أمر الخدمة</span><select className="field-input" value={form.firstVisitType} disabled={Boolean(form.id)} onChange={event => setForm({ ...form, firstVisitType: event.target.value as VisitType })}><option value="installation">تركيب فلتر</option><option value="maintenance">صيانة</option><option value="cartridge_change">تغيير شمعات</option><option value="follow_up">متابعة</option><option value="other">أخرى</option></select></label><Field label="اسم الفني" value={form.firstTechnicianName} onChange={value => setForm({ ...form, firstTechnicianName: value })} placeholder="مثال: أحمد" /><label><span className="field-label">نتيجة الزيارة</span><textarea className="field-textarea min-h-20" value={form.firstVisitResult} onChange={event => setForm({ ...form, firstVisitResult: event.target.value })} placeholder="ما الذي تم تنفيذه؟" /></label><label><span className="field-label">تاريخ ووقت الخدمة</span><input type="datetime-local" className="field-input" value={form.firstVisitDate} onChange={event => setForm({ ...form, firstVisitDate: event.target.value })} /></label><label><span className="field-label">المبلغ المحصل</span><input type="number" min="0" step="0.01" className="field-input" value={form.firstCollectedAmount} onChange={event => setForm({ ...form, firstCollectedAmount: event.target.value })} placeholder="مثال: 250" /></label></div><p className="mt-3 text-xs text-teal-800">سيُنشئ النظام الزيارة وسجل التحصيل في الخزينة تلقائيًا، وسيضيف تذكيرًا بعد 120 يومًا للتركيب أو الصيانة. عند التعديل، يُحدّث تاريخ آخر خدمة وموعد المتابعة المرتبط بها.</p></div><div className="sm:col-span-2"><Field label="الموقع" value={form.location} onChange={value => setForm({ ...form, location: value })} dir="ltr" placeholder="رابط الخريطة أو الإحداثيات: 24.7136, 46.6753" /><p className="mt-1 text-xs text-muted-foreground">أدخل رابط الموقع أو خط العرض والطول في خانة واحدة.</p></div><div className="sm:col-span-2"><label className="field-label">ملاحظات</label><textarea className="field-textarea" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="أي ملاحظات مفيدة للفني" /></div><div className="flex justify-end gap-3 pt-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">إلغاء</Button><Button disabled={saving} type="submit" className="rounded-xl bg-teal-700 hover:bg-teal-800">{saving ? "جارٍ الحفظ…" : "حفظ البيانات"}</Button></div></form></DialogContent>      </Dialog>
      <Dialog open={visitPickerOpen} onOpenChange={setVisitPickerOpen}><DialogContent dir="rtl" className="sm:max-w-lg"><DialogHeader><DialogTitle>تسجيل زيارة جديدة</DialogTitle><DialogDescription>اختر العميل لفتح بطاقة التسجيل وإضافة الفني والمبلغ المحصل.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><label><span className="field-label">العميل</span><select className="field-input" value={visitPickerCustomerId} onChange={event => setVisitPickerCustomerId(event.target.value)}><option value="">اختر العميل</option>{displayedCustomers?.map(customer => <option key={customer.id} value={customer.id}>{customer.name} {customer.customerCode ? `— ${customer.customerCode}` : ""}</option>)}</select></label><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setVisitPickerOpen(false)} className="rounded-xl">إلغاء</Button><Button type="button" onClick={chooseVisitCustomer} className="rounded-xl bg-teal-700 hover:bg-teal-800">فتح بطاقة التسجيل</Button></div></div></DialogContent></Dialog>
      <Dialog open={visitCustomer !== null} onOpenChange={open => { if (!open) setVisitCustomer(null); }}><DialogContent dir="rtl"><DialogHeader><DialogTitle>تسجيل زيارة جديدة</DialogTitle><DialogDescription>{visitCustomer ? `للعميل: ${visitCustomer.name} — ${visitCustomer.customerCode}` : ""}</DialogDescription></DialogHeader><form onSubmit={submitVisit} className="space-y-4 py-2"><label><span className="field-label">نوع الزيارة</span><select className="field-input" value={visitType} onChange={event => updateVisitType(event.target.value as keyof typeof visitTypeLabels)}>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="field-label">تاريخ ووقت الزيارة</span><input type="datetime-local" className="field-input" value={visitDate} onChange={event => setVisitDate(event.target.value)} required /></label><label><span className="field-label">اسم الفني</span><input className="field-input" value={visitTechnicianName} onChange={event => setVisitTechnicianName(event.target.value)} placeholder="مثال: أحمد" /></label><label><span className="field-label">المبلغ المحصل</span><input type="number" min="0" step="0.01" className="field-input" value={visitCollectedAmount} onChange={event => setVisitCollectedAmount(event.target.value)} placeholder="مثال: 250" /></label><label><span className="field-label">نتيجة الزيارة</span><textarea className="field-textarea" value={visitResult} onChange={event => setVisitResult(event.target.value)} placeholder="ما الذي تم تنفيذه؟" /></label><label className="sm:col-span-2"><span className="field-label">ملاحظات الزيارة</span><textarea className="field-textarea" value={visitNotes} onChange={event => setVisitNotes(event.target.value)} placeholder="اكتب تفاصيل مختصرة عن الخدمة" /></label><div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-extrabold text-teal-950">الأصناف المستخدمة</p><p className="mt-1 text-xs text-teal-800">تظهر الأصناف الافتراضية تلقائيًا، ويمكنك تعديلها أو إضافة صنف آخر من المخزن.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-teal-700">{visitItems.length}</span></div><div className="mt-3 space-y-2">{visitItems.map((item, index) => { const catalogItem = effectiveServiceCatalog?.items.find(entry => entry.id === item.inventoryItemId); return <div key={item.inventoryItemId} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2"><span className="min-w-32 flex-1 text-sm font-bold text-teal-950">{catalogItem?.name ?? `صنف رقم ${item.inventoryItemId}`}</span><input aria-label={`كمية ${catalogItem?.name ?? item.inventoryItemId}`} type="number" min="1" className="field-input h-9 w-24" value={item.quantity} onChange={event => { const quantity = Number.parseInt(event.target.value, 10); setVisitItems(current => current.map((entry, rowIndex) => rowIndex === index ? { ...entry, quantity: Number.isFinite(quantity) ? quantity : 1 } : entry)); }} /><button type="button" className="rounded-lg px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50" onClick={() => setVisitItems(current => current.filter((_, rowIndex) => rowIndex !== index))}>إزالة</button></div>; })}</div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input list="visit-inventory-items" className="field-input flex-1" value={manualItemName} onChange={event => setManualItemName(event.target.value)} placeholder="اكتب اسم صنف موجود في المخزن" aria-label="إضافة صنف مستخدم" /><datalist id="visit-inventory-items">{effectiveServiceCatalog?.items.map(item => <option key={item.id} value={item.name} />)}</datalist><input type="number" min="1" className="field-input w-full sm:w-24" value={manualItemQuantity} onChange={event => setManualItemQuantity(event.target.value)} aria-label="كمية الصنف الإضافي" /><Button type="button" variant="outline" onClick={addManualVisitItem} className="rounded-xl whitespace-nowrap"><Plus className="ml-1 h-4 w-4" />إضافة صنف</Button></div></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setVisitCustomer(null)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createVisit.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createVisit.isPending ? "جارٍ التسجيل…" : "حفظ الزيارة"}</Button></div></form></DialogContent></Dialog>
      <PinVerificationDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }} busy={deleteCustomer.isPending} title="تأكيد حذف العميل" description="سيتم حذف العميل وجميع الزيارات والتذكيرات والعمليات المرتبطة به نهائيًا." onConfirm={pin => { if (deleteId !== null) { const customer = displayedCustomers.find(item => item.id === deleteId); if (customer) moveToTrash({ entityType: "customer", entityLabel: `العميل: ${customer.name}`, payload: customer }); deleteCustomer.mutate({ id: deleteId, pin }); } }} />
      <PinVerificationDialog open={pinOpen} onOpenChange={open => { if (!open) { setPinOpen(false); setPendingUpdate(null); } }} busy={updateCustomer.isPending} title="تأكيد تعديل بيانات العميل" onConfirm={pin => { if (pendingUpdate) updateCustomer.mutate({ ...pendingUpdate, pin }); }} />
    </div>
  );
}

function Field({ label, value, onChange, required, dir, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; dir?: "ltr" | "rtl"; placeholder?: string }) { return <label><span className="field-label">{label}</span><input className="field-input" value={value} dir={dir} placeholder={placeholder} required={required} onChange={event => onChange(event.target.value)} /></label>; }
