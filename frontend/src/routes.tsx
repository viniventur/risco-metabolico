import { createBrowserRouter } from "react-router-dom";

import { App } from "./app";

// As 7 rotas de §7.1, com `lazy()` por rota: o Plotly (1,4 MB) só entra em /estudos/:slug.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    // Rotas lazy no primeiro render: sem isto o react-router avisa sobre a falta de HydrateFallback.
    hydrateFallbackElement: <p className="p-4 text-sm">Carregando…</p>,
    children: [
      { index: true, lazy: () => import("./features/inicio/InicioPage").then((m) => ({ Component: m.InicioPage })) },
      { path: "painel", lazy: () => import("./features/painel/PainelPage").then((m) => ({ Component: m.PainelPage })) },
      { path: "consulta", lazy: () => import("./features/consulta/ConsultaPage").then((m) => ({ Component: m.ConsultaPage })) },
      { path: "simulador", lazy: () => import("./features/simulador/SimuladorPage").then((m) => ({ Component: m.SimuladorPage })) },
      {
        path: "monitoramento",
        lazy: () => import("./features/monitoramento/MonitoramentoPage").then((m) => ({ Component: m.MonitoramentoPage })),
      },
      { path: "estudos", lazy: () => import("./features/estudos/ListaEstudosPage").then((m) => ({ Component: m.ListaEstudosPage })) },
      { path: "estudos/:slug", lazy: () => import("./features/estudos/NotebookPage").then((m) => ({ Component: m.NotebookPage })) },
      { path: "*", lazy: () => import("./features/inicio/NaoEncontrada").then((m) => ({ Component: m.NaoEncontrada })) },
    ],
  },
]);
