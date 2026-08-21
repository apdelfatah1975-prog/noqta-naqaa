import React, { type ReactNode } from "react";
import { customerMapUrl, buildWhatsAppNextVisitMessage, buildWhatsAppUrl } from "@/lib/filterUi";
import { MapPinned, MessageCircle, Phone } from "lucide-react";

type CustomerContact = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  location?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  followUp?: { nextVisitDate?: Date | string | null } | null;
};

export function CustomerContactActions({ customer, compact = false, labels = false, className = "" }: { customer: CustomerContact; compact?: boolean; labels?: boolean; className?: string }) {
  const phone = customer.phone?.trim();
  const nextVisitDate = customer.followUp?.nextVisitDate;
  const whatsappMessage = nextVisitDate
    ? buildWhatsAppNextVisitMessage(customer.name?.trim() || "عميلنا العزيز", nextVisitDate)
    : "مرحبًا، معكم شركة نقطة نقاء. يسعدنا خدمتكم والإجابة عن أي استفسار يخص فلتر المياه لديكم.";
  const whatsappUrl = buildWhatsAppUrl(phone, whatsappMessage);
  const mapUrl = customerMapUrl(customer);
  const sizeClass = compact ? (labels ? "min-h-9 px-3" : "h-9 w-9") : "h-10 px-3";
  const iconClass = compact && !labels ? "h-4 w-4" : "ml-2 h-4 w-4";
  const baseClass = `inline-flex items-center justify-center rounded-lg font-bold transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${sizeClass}`;
  const title = labels ? "" : undefined;
  const content = (icon: ReactNode, text: string) => <>{icon}{labels ? text : null}</>;

  return <div className={`flex flex-wrap items-center gap-2.5 ${className}`} aria-label="إجراءات التواصل مع العميل">
    {phone ? <a href={`tel:${phone}`} className={`${baseClass} bg-teal-50 text-teal-800`} title={title || "اتصال بالعميل"} aria-label="اتصال بالعميل">{content(<Phone className={iconClass} />, "اتصال")}</a> : null}
    {whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noreferrer" className={`${baseClass} bg-emerald-50 text-emerald-800`} title={title || (nextVisitDate ? "إرسال تذكير بموعد الصيانة القادمة عبر واتساب" : "فتح واتساب مع العميل")} aria-label={nextVisitDate ? "إرسال تذكير بموعد الصيانة القادمة عبر واتساب" : "فتح واتساب مع العميل"}>{content(<MessageCircle className={iconClass} />, "واتساب")}</a> : null}
    {mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer" className={`${baseClass} bg-sky-50 text-sky-800`} title={title || "فتح موقع العميل"} aria-label="فتح موقع العميل">{content(<MapPinned className={iconClass} />, labels ? "الموقع" : "")}</a> : null}
  </div>;
}
