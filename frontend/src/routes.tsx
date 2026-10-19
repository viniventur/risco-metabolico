import { createBrowserRouter } from "react-router-dom";

import { App } from "./app";
import { CascaCarregando } from "./shared/layout/CascaCarregando";

// As 7 rotas de §7.1, com `lazy()` por rota: o Plotly (1,4 MB) só entra em /estudos/:slug.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    // Rotas lazy no primeiro render: sem isto o react-router avisa sobre a falta de HydrateFallback.
    hydrateFallbackElement: <CascaCarregando />,
    children: [
      { index: true, lazy: () => import("./features/inicio/InicioPage").then((m) => ({ Component: m.InicioPage })) },
      { path: "painel", lazy: () => import("./features/painel/PainelPage").then((m) => ({ Component: m.PainelPage })) },
      { path: "consulta", lazy: () => import("./features/consulta/ConsultaPage").then((m) => ({ Component: m.ConsultaPage })) },
      { path: "simulador", lazy: () => import("./features/simulador/SimuladorPage").then((m) => ({ Component: m.SimuladorPage })) },
      {
        path: "monitoramento",
        lazy: () => import("./features/monitoramento/MonitoramentoPage").then((m) => ({ Component: m.MonitoramentoPage })),
      },
      // A vertente diabetes (decisão D5): as mesmas quatro telas, sob /diabetes, com código próprio.
      { path: "diabetes", lazy: () => import("./features/diabetes/painel/PainelDiabetesPage").then((m) => ({ Component: m.PainelDiabetesPage })) },
      {
        path: "diabetes/consulta",
        lazy: () => import("./features/diabetes/consulta/ConsultaDiabetesPage").then((m) => ({ Component: m.ConsultaDiabetesPage })),
      },
      {
        path: "diabetes/simulador",
        lazy: () => import("./features/diabetes/simulador/SimuladorDiabetesPage").then((m) => ({ Component: m.SimuladorDiabetesPage })),
      },
      {
        path: "diabetes/monitoramento",
        lazy: () => import("./features/diabetes/monitoramento/MonitoramentoDiabetesPage").then((m) => ({ Component: m.MonitoramentoDiabetesPage })),
      },
      { path: "estudos", lazy: () => import("./features/estudos/ListaEstudosPage").then((m) => ({ Component: m.ListaEstudosPage })) },
      { path: "estudos/:slug", lazy: () => import("./features/estudos/NotebookPage").then((m) => ({ Component: m.NotebookPage })) },
      // Fora do menu: o rodapé de toda tela e o Início linkam para ela.
      { path: "privacidade", lazy: () => import("./features/legal/PrivacidadePage").then((m) => ({ Component: m.PrivacidadePage })) },
      { path: "*", lazy: () => import("./features/inicio/NaoEncontrada").then((m) => ({ Component: m.NaoEncontrada })) },
    ],
  },
]);
