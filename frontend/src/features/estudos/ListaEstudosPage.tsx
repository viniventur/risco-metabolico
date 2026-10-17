import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { buscarEstatico } from "@/shared/api/http";
import { chaves } from "@/shared/api/queryKeys";
import { fmtDataHora, fmtInt } from "@/shared/format/ptBR";
import { IconeEstudos } from "@/shared/ui/icones";
import { QueryState } from "@/shared/ui/QueryState";

import type { EntradaManifesto } from "./tipos";

/** Rota /estudos — lê public/study/manifest.json e lista os notebooks renderizados. */
export function ListaEstudosPage() {
  const q = useQuery({
    queryKey: chaves.estudos,
    queryFn: () => buscarEstatico<EntradaManifesto[]>("/study/manifest.json"),
    staleTime: Infinity,
  });
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Estudos</h1>
        <p className="text-sm text-texto-fraco">
          Os notebooks que sustentam as decisões de modelagem, renderizados com as saídas salvas — os gráficos Plotly continuam vivos.
        </p>
      </header>
      <QueryState carregando={q.isPending} erro={q.error} vazio={q.data?.length === 0} mensagemVazio="Nenhum notebook publicado.">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(q.data ?? []).map((e) => (
            <li key={e.slug}>
              <Link to={`/estudos/${e.slug}`} className="cartao flex min-h-24 flex-col gap-1 p-4 text-texto hover:bg-superficie-alta">
                <span className="flex items-center gap-2 text-base font-semibold">
                  <IconeEstudos /> {e.titulo}
                </span>
                <span className="text-sm text-texto-fraco">
                  {fmtInt(e.n_celulas)} células · {fmtInt(e.n_figuras)} figuras · executado em {fmtDataHora(e.atualizado_em)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}
