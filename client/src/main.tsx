import { createRoot } from "react-dom/client";
import PublicDemo from "./pages/PublicDemo";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("لم يتم العثور على عنصر التطبيق الرئيسي");
}

const isPublicDemo = window.location.pathname === "/demo";

if (isPublicDemo) {
  createRoot(root).render(<PublicDemo />);
} else {
  void Promise.all([
    import("@/lib/trpc"),
    import("@shared/const"),
    import("@tanstack/react-query"),
    import("@trpc/client"),
    import("superjson"),
    import("./App"),
    import("./const"),
  ]).then(([{ trpc }, { COOKIE_NAME, UNAUTHED_ERR_MSG }, { QueryClient, QueryClientProvider }, { httpBatchLink, TRPCClientError }, superjsonModule, { default: App }, { startLogin }]) => {
    const superjson = superjsonModule.default;
    const queryClient = new QueryClient();

    const redirectToLoginIfUnauthorized = (error: unknown) => {
      if (!(error instanceof TRPCClientError)) return;
      const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
      if (!isUnauthorized) return;
      startLogin();
    };

    queryClient.getQueryCache().subscribe(event => {
      if (event.type === "updated" && event.action.type === "error") {
        const error = event.query.state.error;
        redirectToLoginIfUnauthorized(error);
        console.error("[API Query Error]", error);
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
            try {
              const raw = sessionStorage.getItem("manus-cookie");
              if (raw) {
                const prefix = `${COOKIE_NAME}=`;
                const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
                const token = pair?.trim().slice(prefix.length);
                if (token) return { Authorization: `Bearer ${token}` };
              }
            } catch {
              // sessionStorage may be unavailable in restricted browsers.
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

    createRoot(root).render(
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </trpc.Provider>,
    );
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js?version=12").then(registration => {
      const update = () => void registration.update();
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(update, { timeout: 3000 });
      } else {
        globalThis.setTimeout(update, 1500);
      }
    });
  });
}
