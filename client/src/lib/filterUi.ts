export const visitTypeLabels = {
  installation: "تركيب فلتر",
  maintenance: "صيانة",
  cartridge_change: "تغيير شمعات",
  follow_up: "متابعة",
  other: "أخرى",
} as const;

export function labelVisitType(value: string | null | undefined) {
  if (!value) return "—";
  return visitTypeLabels[value as keyof typeof visitTypeLabels] ?? value;
}

export const reminderStatusLabels = {
  pending: "بانتظار المتابعة",
  completed: "تمت المتابعة",
  dismissed: "تم التجاوز",
} as const;

export function formatDate(value: Date | string | null | undefined, options: Intl.DateTimeFormatOptions = {}) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined) {
  return formatDate(value, { hour: "numeric", minute: "2-digit" });
}

export function toDateTimeLocal(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function customerMapUrl(customer: { address?: string | null; location?: string | null; latitude?: string | null; longitude?: string | null }) {
  const query = customer.latitude && customer.longitude
    ? `${customer.latitude},${customer.longitude}`
    : customer.location?.trim() || customer.address?.trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

export type WhatsAppReminderStage = "before" | "today" | "overdue";

export function normalizeEgyptianWhatsAppPhone(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

export function whatsappReminderStage(reminderDate: Date | string, now = new Date()): WhatsAppReminderStage | null {
  const due = new Date(reminderDate);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days === 1) return "before";
  if (days === 0) return "today";
  if (days < 0) return "overdue";
  return null;
}

export function buildWhatsAppReminderMessage(customerName: string, reminderDate: Date | string, stage: WhatsAppReminderStage) {
  const date = formatDate(reminderDate);
  if (stage === "before") {
    return `مرحبًا ${customerName}،\nنذكّركم بأن موعد الصيانة الدورية لفلتر المياه غدًا ${date}.\nيرجى الرد بالموافقة على الموعد أو التواصل معنا لتغييره.\nشركة نقطة نقاء`;
  }
  if (stage === "overdue") {
    return `مرحبًا ${customerName}،\nنلاحظ أن موعد متابعة فلتر المياه كان بتاريخ ${date} ولم تتم المتابعة بعد.\nنرجو التواصل معنا لتنسيق موعد مناسب لكم.\nشركة نقطة نقاء`;
  }
  return `مرحبًا ${customerName}،\nموعد الصيانة الدورية لفلتر المياه هو اليوم ${date}.\nنرجو تأكيد مناسبة الزيارة أو الرد لطلب تغيير الموعد.\nشركة نقطة نقاء`;
}

export function buildWhatsAppNextVisitMessage(customerName: string, nextVisitDate: Date | string) {
  return `مرحبًا ${customerName}،\nنود تذكيركم بأن موعد الصيانة الدورية القادم لفلتر المياه هو ${formatDate(nextVisitDate)}.\nيسعدنا خدمتكم والحفاظ على جودة مياهكم، ونرجو تأكيد الموعد أو التواصل معنا إذا احتجتم إلى تغييره.\nشركة نقطة نقاء`;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string) {
  const normalized = normalizeEgyptianWhatsAppPhone(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : null;
}

export function buildWhatsAppBulkReminderMessage(reminders: Array<{ customerName?: string | null; reminderDate: Date | string }>) {
  const rows = reminders.map((reminder, index) => `${index + 1}. ${reminder.customerName?.trim() || "عميلنا الكريم"} — ${formatDate(reminder.reminderDate)}`);
  return `مرحبًا، هذه قائمة العملاء المستحقين لمتابعة فلاتر المياه اليوم أو غدًا:\n${rows.join("\\n")}\n\nيرجى التواصل مع كل عميل لتأكيد الموعد أو تغييره.\nشركة نقطة نقاء`;
}

export function buildWhatsAppShareUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export const COMPANY_WHATSAPP_PHONE = "201008797774";
export const COMPANY_WHATSAPP_DISPLAY_PHONE = "01008797774";
