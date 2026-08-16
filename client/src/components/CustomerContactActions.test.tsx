import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { CustomerContactActions } from "./CustomerContactActions";

describe("CustomerContactActions", () => {
  it("يعرض الاتصال وواتساب والموقع للعميل", () => {
    render(<CustomerContactActions customer={{ phone: "01008797774", address: "القاهرة", latitude: null, longitude: null }} labels />);

    expect(screen.getByRole("link", { name: "اتصال بالعميل" }).getAttribute("href")).toBe("tel:01008797774");
    expect(screen.getByRole("link", { name: "فتح واتساب مع العميل" }).getAttribute("href")).toContain("https://wa.me/201008797774?text=");
    expect(screen.getByRole("link", { name: "فتح موقع العميل" }).getAttribute("href")).toContain("google.com/maps");
  });

  it("لا يعرض روابط فارغة عند غياب بيانات التواصل", () => {
    render(<CustomerContactActions customer={{ phone: null, address: null, latitude: null, longitude: null }} labels />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
