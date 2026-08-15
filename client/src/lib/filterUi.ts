export const visitTypeLabels = {
  installation: "تركيب فلتر",
  maintenance: "صيانة",
  cartridge_change: "تغيير شمعات",
  follow_up: "متابعة",
  other: "أخرى",
} as const;

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

export function customerMapUrl(customer: { address?: string | null; latitude?: string | null; longitude?: string | null }) {
  const query = customer.latitude && customer.longitude
    ? `${customer.latitude},${customer.longitude}`
    : customer.address;
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}
