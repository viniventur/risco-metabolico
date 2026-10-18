import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

// Source Serif 4, a fonte da marca Visor, servida do próprio site (a CSP é font-src 'self'): o eixo de
// tamanho óptico (opsz) deixa o texto miúdo da interface mais aberto e os títulos mais finos.
import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/source-serif-4/opsz-italic.css";

import { router } from "./routes";
import "./shared/tema/tokens.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // 429 nunca vira laço (6.8.3): nenhuma retentativa automática no front.
      retry: 0,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
