import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type FetchHandler = (event: { request: Request; respondWith: (response: Promise<unknown>) => void }) => void;

function loadServiceWorker(fetchImplementation: ReturnType<typeof vi.fn>, cachedRoot: unknown, offlinePage: unknown) {
  const handlers = new Map<string, FetchHandler>();
  const cache = { addAll: vi.fn(), put: vi.fn(), match: vi.fn(async (request: Request | string) => request === "/" ? cachedRoot : offlinePage) };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
    match: vi.fn(async (request: Request | string) => request === "/" ? cachedRoot : offlinePage),
  };
  const self = {
    addEventListener: (name: string, handler: FetchHandler) => handlers.set(name, handler),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    location: { origin: "https://purepoint.test" },
  };
  const source = readFileSync(path.resolve(import.meta.dirname, "../client/public/sw.js"), "utf8");
  runInNewContext(source, { self, caches, fetch: fetchImplementation, URL, Promise });
  return { fetchHandler: handlers.get("fetch")!, caches };
}

async function executeNavigation(handler: FetchHandler) {
  let responsePromise: Promise<unknown> | undefined;
  handler({
    request: { method: "GET", mode: "navigate", url: "https://purepoint.test/" } as Request,
    respondWith: response => { responsePromise = response; },
  });
  return responsePromise;
}

describe("عامل خدمة التطبيق القابل للتثبيت", () => {
  it("يجهز manifest الفني كنقطة تشغيل مستقلة لأوامر العمل", () => {
    const technicianManifest = readFileSync(path.resolve(import.meta.dirname, "../client/public/technician-manifest.webmanifest"), "utf8");
    const indexHtml = readFileSync(path.resolve(import.meta.dirname, "../client/index.html"), "utf8");
    const mainSource = readFileSync(path.resolve(import.meta.dirname, "../client/src/main.tsx"), "utf8");
    expect(technicianManifest).toContain('"start_url": "/technician-app/login"');
    expect(technicianManifest).toContain('"scope": "/technician-app/"');
    expect(technicianManifest).toContain('"sizes": "192x192"');
    expect(technicianManifest).toContain('"sizes": "512x512"');
    expect(technicianManifest).toContain('"display": "standalone"');
    expect(indexHtml).toContain("window.location.pathname.startsWith('/technician-')");
    expect(indexHtml).toContain("/technician-manifest.webmanifest");
  });

  it("يستقبل مشاركة موقع واتساب داخل صفحة العملاء", () => {
    const manifest = readFileSync(path.resolve(import.meta.dirname, "../client/public/manifest.webmanifest"), "utf8");
    const indexHtml = readFileSync(path.resolve(import.meta.dirname, "../client/index.html"), "utf8");
    const mainSource = readFileSync(path.resolve(import.meta.dirname, "../client/src/main.tsx"), "utf8");
    const customersSource = readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Customers.tsx"), "utf8");
    expect(manifest).toContain('"action": "/customers"');
    expect(manifest).toContain('"url": "url"');
    expect(indexHtml).toContain('/manifest.webmanifest?v=share-target-2');
    expect(mainSource).toContain('navigator.serviceWorker.getRegistrations()');
    expect(mainSource).not.toContain('register(serviceWorkerUrl');
    expect(customersSource).toContain('params.get("url") || params.get("text")');
    expect(customersSource).toContain("اختيار العميل للموقع المشارك");
  });

  it("يجهز جذر التطبيق داخل غلاف التخزين المحلي", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "../client/public/sw.js"), "utf8");
    expect(source).toContain('const APP_SHELL = ["/"');
    expect(source).toContain('if (requestUrl.pathname.startsWith("/api/")) return;');
  });

  it("يعرض نسخة الشبكة الحديثة لمسار التطبيق ويحدّث الكاش، ثم يستخدم المخزنة عند انقطاع الاتصال", async () => {
    const networkResponse = { ok: true, clone: () => networkResponse };
    const cachedRoot = { cached: true };
    const fetchImplementation = vi.fn(async () => networkResponse);
    const { fetchHandler, caches } = loadServiceWorker(fetchImplementation, cachedRoot, { offline: true });

    await expect(executeNavigation(fetchHandler)).resolves.toBe(networkResponse);
    await Promise.resolve();
    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(caches.match).toHaveBeenCalledWith("/");
  });

  it("يعرض صفحة عدم الاتصال عند فشل الشبكة وعدم وجود نسخة من المسار", async () => {
    const offlinePage = { offline: true };
    const fetchImplementation = vi.fn(async () => { throw new Error("offline"); });
    const { fetchHandler, caches } = loadServiceWorker(fetchImplementation, undefined, offlinePage);

    await expect(executeNavigation(fetchHandler)).resolves.toBe(offlinePage);
    expect(caches.match).toHaveBeenCalledWith("/");
    expect(caches.match).toHaveBeenCalledWith("/offline.html");
  });
});
