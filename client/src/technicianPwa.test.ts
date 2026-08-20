import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("تثبيت تطبيق الفني المعزول", () => {
  it("يستخدم manifest بمعرّف ونطاق ورابط بدء خاصين بالفني", async () => {
    const manifest = JSON.parse(readProjectFile("../public/technician-manifest.webmanifest")) as {
      id: string;
      start_url: string;
      scope: string;
      short_name: string;
    };

    expect(manifest.id).toBe("/technician-pwa");
    expect(manifest.start_url).toContain("/technician-preview");
    expect(manifest.scope).toBe("/technician-preview");
    expect(manifest.short_name).toBe("أوامر الفني");
  });

  it("يرفع إصدار الكاش ويشغّل العامل الخدمي المعزول", async () => {
    const serviceWorker = readProjectFile("../public/sw.js");
    const main = readProjectFile("./main.tsx");

    expect(serviceWorker).toContain("purepoint-shell-v17-technician-isolated");
    expect(main).toContain("version=17-technician-isolated");
  });
});
