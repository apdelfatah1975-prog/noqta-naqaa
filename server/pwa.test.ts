import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type FetchHandler = (event: { request: Request; respondWith: (response: Promise<unknown>) => void }) => void;

function loadServiceWorker(fetchImplementation: ReturnType<typeof vi.fn>, cachedRoot: unknown, offlinePage: unknown) {
  const handlers = new Map<string, FetchHandler>();
  const cache = { addAll: vi.fn(), put: vi.fn() };
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
  it("يعيد استجابة الشبكة الجديدة أولًا لمسار التطبيق", async () => {
    const networkResponse = { ok: true, clone: () => networkResponse };
    const fetchImplementation = vi.fn(async () => networkResponse);
    const { fetchHandler, caches } = loadServiceWorker(fetchImplementation, { cached: true }, { offline: true });

    await expect(executeNavigation(fetchHandler)).resolves.toBe(networkResponse);
    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(caches.match).not.toHaveBeenCalled();
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
