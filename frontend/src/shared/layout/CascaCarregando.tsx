import { Marca } from "@/shared/ui/Marca";
import { RodapeAviso } from "@/shared/ui/RodapeAviso";
import { Skeleton } from "@/shared/ui/skeleton";

/**
 * O primeiro quadro, enquanto a rota lazy da primeira tela carrega: o esqueleto da casca (barra
 * lateral, barra do topo, cabeçalho e blocos) em vez de um "Carregando…" solto no canto.
 */
export function CascaCarregando() {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="hidden h-screen border-r border-sidebar-border bg-sidebar lg:block">
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
          <Marca className="size-7" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <div className="flex min-h-screen flex-col">
        <div className="h-14 border-b" />
        <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="border-t px-4 py-4 sm:px-6 lg:px-8">
          <RodapeAviso />
        </div>
      </div>
    </div>
  );
}
