import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import { getOfflineSession } from "@/lib/offlineSync";
import { getOfflineSnapshots, saveOfflineSnapshot, type OfflineDomain } from "@/lib/offlineDatabase";
import "./index.css";

if (!import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) void registration.unregister();
      return caches.keys();
    }).then(cacheNames => {
      for (const cacheName of cacheNames) void caches.delete(cacheName);
    }).catch(() => {});
  });
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const technicianStandalone = window.location.pathname.startsWith("/technician-app");
    const serviceWorkerUrl = technicianStandalone
      ? "/technician-app/sw.js?version=1-orders-only"
      : "/sw.js?version=20-share-target";
    void navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: technicianStandalone ? "/technician-app/" : "/",
    }).then(registration => {
      const update = () => void registration.update();
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(update, { timeout: 3000 });
      } else {
        globalThis.setTimeout(update, 1500);
      }
    });
  });
}

const offlineDomainFromQueryKey = (queryKey: readonly unknown[]): OfflineDomain | null => {
  const key = queryKey.map(part => typeof part === "string" ? part : JSON.stringify(part)).join(" ").toLowerCase();
  if (key.includes("customer")) return "customers";
  if (key.includes("visit")) return "visits";
  if (key.includes("workorder") || key.includes("work-order")) return "workOrders";
  if (key.includes("reminder")) return "reminders";
  if (key.includes("inventory") || key.includes("stock")) return "inventory";
  if (key.includes("cash") || key.includes("treasury") || key.includes("transaction")) return "cash";
  if (key.includes("report")) return "reports";
  if (key.includes("activity")) return "activity";
  return null;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Read cached data immediately and avoid retry delays while offline.
      networkMode: "offlineFirst",
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: (failureCount) => typeof navigator !== "undefined" && navigator.onLine && failureCount < 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: false,
    },
  },
});


const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  const isTechnicianPath =
    window.location.pathname === "/technician-login" ||
    window.location.pathname === "/technician-preview" ||
    window.location.pathname.startsWith("/technician-app");

  if (!isUnauthorized || isTechnicianPath) return;

  startLogin();
};

const hydrateOfflineQueries = async () => {
  const userId = getOfflineSession()?.id;
  if (!userId) return;
  try {
    const snapshots = await getOfflineSnapshots(userId);
    for (const snapshot of snapshots) {
      if (snapshot.queryKey) queryClient.setQueryData(snapshot.queryKey, snapshot.records.length === 1 && !Array.isArray(snapshot.records[0]) ? snapshot.records[0] : snapshot.records);
    }
  } catch (error) {
    console.warn("[Offline] تعذر استعادة البيانات المحلية", error);
  }
};

void hydrateOfflineQueries();

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
  if (event.type === "updated" && event.action.type === "success") {
    const userId = getOfflineSession()?.id;
    const domain = offlineDomainFromQueryKey(event.query.queryKey);
    if (userId && domain && event.query.state.data !== undefined) {
      const value = event.query.state.data;
      void saveOfflineSnapshot({ userId, domain, queryKey: event.query.queryKey, records: Array.isArray(value) ? value : [value], updatedAt: Date.now() }).catch(() => undefined);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Preview auto-login fallback: when the browser blocks iframe cookies
        // (Safari ITP / private browsing / WebView), the runtime mirrors the
        // session into sessionStorage so we can forward it as a Bearer token.
        // The regular OAuth cookie flow keeps working and takes priority server-side.
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
