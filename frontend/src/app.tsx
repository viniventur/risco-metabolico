import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useSaude } from "@/shared/api/endpoints/saude";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { BotaoTema } from "@/shared/tema/BotaoTema";
import { IconeConsulta, IconeEstudos, IconeInicio, IconeLimpar, IconeMonitoramento, IconePainel, IconeSimulador } from "@/shared/ui/icones";
import { RodapeAviso } from "@/shared/ui/RodapeAviso";

const ROTAS = [
  { para: "/", rotulo: "Início", Icone: IconeInicio, fim: true },
  { para: "/painel", rotulo: "Visão Geral", Icone: IconePainel },
  { para: "/consulta", rotulo: "Consulta", Icone: IconeConsulta },
  { para: "/simulador", rotulo: "Simulador", Icone: IconeSimulador },
  { para: "/monitoramento", rotulo: "Monitoramento", Icone: IconeMonitoramento },
  { para: "/estudos", rotulo: "Estudos", Icone: IconeEstudos },
];

function BotaoLimparFiltros() {
  const { vazio, limpar } = useFiltros();
  const local = useLocation();
  const mostrar = local.pathname === "/painel" || local.pathname === "/consulta";
  // Atalho Esc: limpa os 6 filtros (7.4).
  useEffect(() => {
    if (!mostrar) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape" && !vazio) limpar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [mostrar, vazio, limpar]);
  if (!mostrar) return null;
  return (
    <button
      type="button"
      onClick={limpar}
      disabled={vazio}
      className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-card border border-borda bg-superficie px-2 text-xs text-texto hover:bg-superficie-alta disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Limpar filtros (Esc)"
      title="Limpar filtros (Esc)"
    >
      <IconeLimpar />
      <span className="hidden lg:inline">Limpar filtros</span>
    </button>
  );
}

function AvisoAcordando() {
  // Aquecimento no mount: GET /health. Enquanto não responde, o estado "acordando o modelo" é
  // visível — honestidade sobre o cold start do plano gratuito (§12/#9).
  const saude = useSaude();
  if (saude.isSuccess && saude.data.artefato_carregado) return null;
  if (saude.isError) {
    return (
      <div className="bg-alerta/15 px-4 py-2 text-sm text-texto" role="status">
        A API não respondeu ainda. Se o serviço estiver hibernando, a primeira chamada pode levar até 60 s.
      </div>
    );
  }
  return (
    <div className="bg-primaria/10 px-4 py-2 text-sm text-texto" role="status" aria-live="polite">
      Acordando o modelo… a primeira chamada pode levar até 60 s.
    </div>
  );
}

export function App() {
  return (
    <NuqsAdapter>
      <div className="flex min-h-screen flex-col sm:flex-row">
        <nav
          className="trilho flex shrink-0 flex-row items-center gap-1 border-b border-borda bg-superficie px-2 py-2 sm:w-24 sm:flex-col sm:border-b-0 sm:border-r sm:py-4"
          aria-label="Navegação principal"
        >
          {ROTAS.map(({ para, rotulo, Icone, fim }) => (
            <NavLink
              key={para}
              to={para}
              end={fim}
              className={({ isActive }) =>
                `flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-card px-2 py-1 text-[11px] ${isActive ? "bg-primaria text-primaria-contraste" : "text-texto hover:bg-superficie-alta"}`
              }
              aria-label={rotulo}
            >
              <Icone />
              <span className="hidden sm:inline">{rotulo}</span>
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-1 sm:ml-0 sm:mt-auto sm:flex-col">
            <BotaoLimparFiltros />
            <BotaoTema />
          </div>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <AvisoAcordando />
          <main className="flex-1 px-4 py-4 sm:px-6">
            <Outlet />
          </main>
          <footer className="nao-imprimir border-t border-borda px-4 py-3 sm:px-6">
            <RodapeAviso />
          </footer>
        </div>
      </div>
    </NuqsAdapter>
  );
}
