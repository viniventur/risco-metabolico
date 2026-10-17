import type { UseQueryResult } from "@tanstack/react-query";

import type { Resumo } from "@/shared/api/endpoints/tipos";
import type { ErroApi } from "@/shared/api/http";
import { fmtInt, fmtNum } from "@/shared/format/ptBR";
import { Marca } from "@/shared/ui/icones";
import { KpiCard } from "@/shared/ui/KpiCard";

const CELULA = "min-[1100px]:col-span-2";

/**
 * Os 6 cartões da linha 1-2 (§7.3), sem Recharts. Correções em relação ao painel de referência:
 * COUNT(*) do recorte (o original contava uma coluna), médias de verdade (o original somava com
 * um TopN parasita) e a MODA explícita para o nível predominante (era Max + TopN).
 */
export function FaixaKpis({ resumo }: { resumo: UseQueryResult<Resumo, ErroApi> }) {
  const d = resumo.data;
  const carregando = resumo.isPending;
  return (
    <>
      <div className={CELULA}>
        <KpiCard
          rotulo="Qtd. de registros"
          valor={fmtInt(d?.total_registros)}
          carregando={carregando}
          detalhe={d ? `de ${fmtInt(d.total_global)} na base` : undefined}
        />
      </div>
      <div className={CELULA}>
        <KpiCard rotulo="Idade média" valor={fmtNum(d?.idade_media, 1)} unidade="anos" carregando={carregando} />
      </div>
      <div className={CELULA}>
        <KpiCard rotulo="Altura média" valor={fmtNum(d?.altura_media, 2)} unidade="m" carregando={carregando} />
      </div>
      <div className={CELULA}>
        <KpiCard rotulo="Peso médio" valor={fmtNum(d?.peso_medio, 1)} unidade="kg" carregando={carregando} />
      </div>
      <div className={CELULA}>
        <KpiCard
          rotulo="Nível predominante"
          variante="texto"
          valor={d?.nivel_predominante ?? "—"}
          carregando={carregando}
          detalhe={d ? `n = ${fmtInt(d.n_predominante)}` : undefined}
        />
      </div>
      <div className={`${CELULA} cartao flex items-center justify-center p-4 text-primaria`} aria-hidden="true">
        <Marca />
      </div>
    </>
  );
}
