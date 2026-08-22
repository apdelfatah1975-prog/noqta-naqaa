import React from "react";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

function BrokenPage(): ReactNode {
  throw new Error("render failure");
}

describe("ErrorBoundary", () => {
  it("يعرض رسالة استعادة واضحة بدل انهيار الصفحة", () => {
    const originalError = console.error;
    console.error = () => undefined;
    try {
      render(
        <ErrorBoundary pageName="العملاء">
          <BrokenPage />
        </ErrorBoundary>
      );
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("تعذر فتح هذه الصفحة")).toBeTruthy();
      expect(screen.getByRole("button", { name: "إعادة فتح الصفحة" })).toBeTruthy();
    } finally {
      console.error = originalError;
    }
  });
});

