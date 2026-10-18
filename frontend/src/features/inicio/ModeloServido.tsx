import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { useModelInfo } from "@/shared/api/endpoints/modelo";
import { URL_DOCS } from "@/shared/api/http";
import { ErroInline } from "@/shared/estados/ErroInline";
import { fmtDataHora } from "@/shared/format/ptBR";
import { Revelar } from "@/shared/movimento/Revelar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

import { seguirOPonteiro } from "./seguirOPonteiro";

function Par({ rotulo, children, mono }: { rotulo: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{rotulo}</dt>
      <dd className={mono ? "truncate font-mono text-[13px]" : "text-sm font-medium"}>{children}</dd>
    </div>
  );
}

/** O artefato em produção, lido de GET /model/info: algoritmo, versão, data do treino, largura e hiperparâmetros. */
export function ModeloServido() {
  const info = useModelInfo();
  const d = info.data;
  const hp = d?.hiperparametros ?? {};
  const chaves = ["n_estimators", "max_depth", "learning_rate", "subsample", "colsample_bytree"].filter((k) => k in hp);
  return (
    <Revelar>
      <Card onPointerMove={seguirOPonteiro} className="cartao-holofote rounded-2xl">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Modelo servido</CardTitle>
            <CardDescription>
              Lido de <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">GET /model/info</code>, que lê o manifest do treino — nenhum número
              deste cartão é escrito à mão.
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0 text-muted-foreground">
            <a href={URL_DOCS} target="_blank" rel="noreferrer">
              Documentação da API
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          {info.isError ? (
            <ErroInline erro={info.error} titulo="Não foi possível ler o manifest do modelo" aoTentarNovamente={() => void info.refetch()} />
          ) : !d ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-5">
                <Par rotulo="Algoritmo">{d.algoritmo}</Par>
                <Par rotulo="Versão">v{d.versao}</Par>
                <Par rotulo="Treinado em">{fmtDataHora(d.treinado_em)}</Par>
                <Par rotulo="Features">
                  {d.n_features_entrada} de entrada → {d.n_features_modelo} no modelo
                </Par>
                <Par rotulo="Dados (versão)" mono>
                  {d.versao_dados}
                </Par>
              </dl>
              {chaves.length ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Hiperparâmetros</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {chaves.map((k) => (
                      <li key={k}>
                        <Badge variant="secondary" className="font-mono text-[12px] font-normal">
                          {k}={String(hp[k])}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </Revelar>
  );
}
