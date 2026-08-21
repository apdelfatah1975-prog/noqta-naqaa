import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { CustomerContactActions } from "./CustomerContactActions";

describe("CustomerContactActions", () => {
  it("يعرض الاتصال وواتساب وزر طلب الموقع للعميل", () => {
    render(<CustomerContactActions customer={{ phone: "01008797774", address: "القاهرة", latitude: null, longitude: null }} labels />);

    expect(screen.getByRole("link", { name: "اتصال بالعميل" }).getAttribute("href")).toBe("tel:01008797774");
    expect(screen.getByRole("link", { name: "فتح واتساب مع العميل" }).getAttribute("href")).toContain("https://wa.me/201008797774?text=");
    const locationLink = screen.getByRole("link", { name: "طلب موقع العميل عبر واتساب" });
    expect(locationLink.getAttribute("href")).toContain("https://wa.me/201008797774?text=");
    expect(locationLink.textContent).toContain("الموقع");
  });

  it("يعرض الموقع عند وجود رابط محفوظ في حقل location", () => {
    render(<CustomerContactActions customer={{ phone: "01008797774", address: null, location: "https://maps.google.com/?q=30.0444,31.2357", latitude: null, longitude: null }} labels />);

    expect(screen.getByRole("link", { name: "طلب موقع العميل عبر واتساب" }).getAttribute("href")).toContain("https://wa.me/");
    expect(screen.getByRole("link", { name: "فتح الخريطة المحفوظة" }).getAttribute("href")).toContain("google.com/maps");
  });

  it("يعرض حالة الموقع غير المسجل عند طلب إظهار الزر", () => {
    render(<CustomerContactActions customer={{ phone: null, address: null, latitude: null, longitude: null }} labels showLocationPlaceholder />);

    const locationState = screen.getByLabelText("لا يمكن طلب موقع العميل");
    expect(locationState).toBeTruthy();
    expect(locationState.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("الموقع غير متاح")).toBeTruthy();
  });

  it("لا يعرض روابط فارغة عند غياب بيانات التواصل", () => {
    render(<CustomerContactActions customer={{ phone: null, address: null, latitude: null, longitude: null }} labels />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
