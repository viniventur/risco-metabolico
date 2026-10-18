import { Skeleton } from "@/shared/ui/skeleton";

// Esqueletos com a forma do gráfico que vai chegar: barras deitadas, colunas ou rosca. Só na
// primeira carga — refetch mantém o quadro anterior em opacidade (§7.3).

const LARGURAS = ["72%", "78%", "80%", "80%", "92%", "82%", "88%"];
const ALTURAS = ["70%", "62%", "66%", "54%", "60%", "48%", "58%", "52%"];

export function EsqueletoBarras({ barras = 4, horizontal = false }: { barras?: number; horizontal?: boolean }) {
  if (horizontal) {
    return (
      <div className="flex h-full flex-col justify-around gap-2 py-1">
        {Array.from({ length: barras }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-20 shrink-0" />
            <Skeleton className="h-5" style={{ width: LARGURAS[i % LARGURAS.length] }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full items-end justify-around gap-3 px-6 pb-6">
      {Array.from({ length: barras }, (_, i) => (
        <Skeleton key={i} className="w-full max-w-14" style={{ height: ALTURAS[i % ALTURAS.length] }} />
      ))}
    </div>
  );
}

export function EsqueletoRosca() {
  return (
    <div className="flex h-full items-center justify-center">
      <Skeleton className="aspect-square h-[78%] rounded-full" />
    </div>
  );
}
