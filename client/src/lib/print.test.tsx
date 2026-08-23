import { describe, expect, it, vi } from "vitest";
import { printCurrentPage } from "./print";

describe("printCurrentPage", () => {
  it("يفتح نافذة الطباعة للصفحة الحالية", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);

    printCurrentPage();

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});
