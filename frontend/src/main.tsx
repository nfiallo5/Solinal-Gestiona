import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import App from "./App";

/**
 * Single react-query client for the whole app. Server state (documents,
 * templates, users, config, audit trail, comments) is cached here instead of
 * living in the reducer — see src/lib/queries.ts.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The API is authoritative; a stale read after a mutation would show the
      // user the wrong document state, so refetch rather than serve cache.
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
