import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { useState } from "react";
import { Outlet, useLocation, useNavigation } from "react-router-dom";

import { useAtalhoEsc } from "@/shared/filtros/useAtalhoEsc";
import { useMenuLateral } from "@/shared/layout/menuLateral";
import { Sidebar } from "@/shared/layout/Sidebar";
import { Topbar } from "@/shared/layout/Topbar";
import { cn } from "@/shared/lib/utils";
import { RodapeAviso } from "@/shared/ui/RodapeAviso";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/shared/ui/sheet";
import { Toaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";

const ID_DO_MENU = "menu-lateral";
const TELAS_COM_FILTRO = ["/painel", "/consulta"];

/** Barra fina no topo do conteúdo enquanto uma rota lazy carrega: a troca de tela não fica muda. */
function ProgressoDeRota() {
  const carregando = useNavigation().state === "loading";
  if (!carregando) return null;
  return (
    <div className="nao-imprimir pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden" role="progressbar" aria-label="Carregando a tela">
      <div className="h-full w-1/3 bg-primary motion-safe:animate-progresso" />
    </div>
  );
}

function Casca() {
  const { pathname } = useLocation();
  const { recolhido, alternar } = useMenuLateral();
  const [gavetaAberta, setGavetaAberta] = useState(false);
  // Fechar a gaveta na troca de rota é ajuste de estado DURANTE o render, não efeito: com efeito, a
  // tela nova chegaria a ser pintada uma vez com o menu ainda aberto por cima.
  const [caminhoAtual, setCaminhoAtual] = useState(pathname);
  if (caminhoAtual !== pathname) {
    setCaminhoAtual(pathname);
    if (gavetaAberta) setGavetaAberta(false);
  }
  useAtalhoEsc(TELAS_COM_FILTRO.includes(pathname));

  return (
    <Sheet open={gavetaAberta} onOpenChange={setGavetaAberta}>
      <div className="min-h-screen bg-background">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Pular para o conteúdo
        </a>
        <div
          className={cn(
            "lg:grid lg:motion-safe:transition-[grid-template-columns] lg:motion-safe:duration-200",
            recolhido ? "lg:grid-cols-[3.5rem_minmax(0,1fr)]" : "lg:grid-cols-[15rem_minmax(0,1fr)]",
          )}
        >
          {/* Desktop: coluna fixa que recolhe. O conteúdo do menu tem largura fixa dentro de uma coluna
              com overflow-hidden: o texto nunca é espremido durante a animação. */}
          <aside className="nao-imprimir sticky top-0 hidden h-screen overflow-hidden border-r border-sidebar-border lg:block">
            <div className={recolhido ? "h-full w-14" : "h-full w-60"}>
              <Sidebar recolhido={recolhido} aoAlternarRecolhido={alternar} idDoMenu={ID_DO_MENU} />
            </div>
          </aside>

          <div className="relative flex min-h-screen min-w-0 flex-col">
            <Topbar />
            <ProgressoDeRota />
            <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
              <Outlet />
            </main>
            <footer className="nao-imprimir border-t px-4 py-4 sm:px-6 lg:px-8">
              <RodapeAviso className="max-w-4xl" />
            </footer>
          </div>
        </div>
      </div>

      {/* Celular: a mesma navegação numa gaveta modal (Radix Dialog). */}
      <SheetContent className="lg:hidden">
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <SheetDescription className="sr-only">As telas do painel, do modelo e dos estudos.</SheetDescription>
        <Sidebar aoNavegar={() => setGavetaAberta(false)} />
      </SheetContent>
      <Toaster />
    </Sheet>
  );
}

export function App() {
  return (
    <NuqsAdapter>
      <TooltipProvider delayDuration={200}>
        <Casca />
      </TooltipProvider>
    </NuqsAdapter>
  );
}
