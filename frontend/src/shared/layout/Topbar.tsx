import { ChevronRight, Menu } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Button } from "@/shared/ui/button";
import { Marca } from "@/shared/ui/Marca";
import { SheetTrigger } from "@/shared/ui/sheet";

import { EstadoApi } from "./EstadoApi";
import { localDaRota } from "./navegacao";
import { SeletorDeTema } from "./SeletorDeTema";

/**
 * Barra do topo, com a mesma altura (h-14) e a mesma borda do topo da barra lateral. No celular traz
 * o botão da gaveta e a marca; no desktop, a trilha "grupo › tela". À direita, o estado da API e o tema.
 */
export function Topbar() {
  const { pathname } = useLocation();
  const local = localDaRota(pathname);
  return (
    <header className="nao-imprimir sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4 lg:px-6">
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu de navegação">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <div className="flex items-center gap-2 lg:hidden">
        <Marca className="size-6" />
        <span className="text-sm font-semibold tracking-tight">Triagem Metabólica</span>
      </div>
      {local ? (
        <p className="hidden items-center gap-1.5 text-sm lg:flex">
          <span className="text-muted-foreground">{local.grupo}</span>
          {local.grupo !== local.item ? (
            <>
              <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{local.item}</span>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="ml-auto flex items-center gap-1">
        <EstadoApi />
        <SeletorDeTema />
      </div>
    </header>
  );
}
