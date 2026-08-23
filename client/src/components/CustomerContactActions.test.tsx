import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { CustomerContactActions } from "./CustomerContactActions";

describe("CustomerContactActions", () => {
  it("يعرض الاتصال وواتساب وزر الموقع والخيار المنفصل لطلب الموقع", () => {
    render(<CustomerContactActions customer={{ phone: "01008797774", address: "القاهرة", latitude: null, longitude: null }} labels />);

    expect(screen.getByRole("link", { name: "اتصال بالعميل" }).getAttribute("href")).toBe("tel:01008797774");
    const whatsappButton = screen.getByRole("button", { name: "إرسال رسالة واتساب للعميل" });
    expect(whatsappButton).toBeTruthy();
    fireEvent.click(whatsappButton);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "في الطريق إليك" })).toBeTruthy();
    const mapLink = screen.getByRole("link", { name: "فتح موقع العميل على خرائط Google" });
    expect(mapLink.getAttribute("href")).toContain("google.com/maps");
    expect(mapLink.textContent).toContain("الموقع");
    const locationRequestLink = screen.getByRole("link", { name: "طلب موقع العميل عبر واتساب" });
    expect(locationRequestLink.getAttribute("href")).toContain("https://wa.me/201008797774?text=");
    expect(locationRequestLink.textContent).toContain("طلب الموقع");
  });

  it("يشارك موقع العميل عبر واتساب مع اسم العميل والرابط المسجل", () => {
    render(<CustomerContactActions customer={{ name: "أحمد محمد", phone: "01008797774", address: null, location: "https://maps.google.com/?q=30.0444,31.2357", latitude: null, longitude: null }} labels />);

    const shareLink = screen.getByRole("link", { name: "مشاركة موقع أحمد محمد عبر واتساب" });
    const href = shareLink.getAttribute("href") ?? "";
    expect(href).toContain("https://wa.me/201008797774?text=");
    expect(decodeURIComponent(href)).toContain("أحمد محمد");
    expect(decodeURIComponent(decodeURIComponent(href))).toContain("30.0444,31.2357");
  });

  it("يعرض الموقع عند وجود رابط محفوظ في حقل location", () => {
    render(<CustomerContactActions customer={{ phone: "01008797774", address: null, location: "https://maps.google.com/?q=30.0444,31.2357", latitude: null, longitude: null }} labels />);

    expect(screen.getByRole("link", { name: "طلب موقع العميل عبر واتساب" }).getAttribute("href")).toContain("https://wa.me/");
    expect(screen.getByRole("link", { name: "فتح موقع العميل على خرائط Google" }).getAttribute("href")).toContain("google.com/maps");
  });

  it("يعرض حالة الموقع غير المسجل عند طلب إظهار الزر", () => {
    render(<CustomerContactActions customer={{ phone: null, address: null, latitude: null, longitude: null }} labels showLocationPlaceholder />);

    const locationState = screen.getByLabelText("موقع العميل غير مسجل");
    expect(locationState).toBeTruthy();
    expect(locationState.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("الموقع غير مسجل")).toBeTruthy();
  });

  it("لا يعرض روابط فارغة عند غياب بيانات التواصل", () => {
    render(<CustomerContactActions customer={{ phone: null, address: null, latitude: null, longitude: null }} labels />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
