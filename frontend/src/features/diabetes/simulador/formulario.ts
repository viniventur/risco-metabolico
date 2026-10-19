import { z } from "zod";

import type { CampoFormulario } from "@/shared/api/endpoints/tipos";

import type { EntradaDiabetes } from "../api/tipos";

// A lógica do formulário do simulador (features/simulador/FormularioTriagem), aqui genérica sobre os
// campos de /diabetes/metadata: o schema, os padrões e a conversão para o JSON da API nascem todos da
// especificação da API — nenhuma regra de formulário mora no JSX.

export type Valores = Record<string, unknown>;

/** O schema zod nasce da especificação de /metadata: faixas dos números, opções fechadas das seleções. */
export function montarSchema(campos: CampoFormulario[]) {
  const forma: Record<string, z.ZodTypeAny> = {};
  for (const c of campos) {
    if (c.tipo === "numero") {
      forma[c.nome] = z.coerce
        .number({ message: "Informe um número" })
        .min(c.minimo ?? -Infinity, { message: `Mínimo ${c.minimo}` })
        .max(c.maximo ?? Infinity, { message: `Máximo ${c.maximo}` });
    } else {
      const valores = (c.opcoes ?? []).map((o) => String(o.valor));
      forma[c.nome] = z.string().refine((v) => valores.includes(v), { message: "Escolha uma opção" });
    }
  }
  return z.object(forma);
}

/** Padrões de /metadata; as seleções guardam SEMPRE string (o DOM devolve string e o schema confere string). */
export function padroes(campos: CampoFormulario[]): Valores {
  const v: Valores = {};
  for (const c of campos) {
    const padrao = c.padrao === null || c.padrao === undefined ? "" : c.padrao;
    v[c.nome] = c.tipo === "selecao" ? String(padrao) : padrao;
  }
  return v;
}

/** Converte os valores do formulário (strings das seleções) para o JSON de EntradaDiabetes (inteiros nas escalas). */
export function paraEntrada(valores: Valores, campos: CampoFormulario[]): EntradaDiabetes {
  const saida: Record<string, string | number> = {};
  for (const c of campos) {
    const v = valores[c.nome];
    if (c.tipo === "numero") saida[c.nome] = Number(v);
    else {
      const opcao = (c.opcoes ?? []).find((o) => String(o.valor) === String(v));
      saida[c.nome] = opcao ? opcao.valor : String(v);
    }
  }
  return saida as unknown as EntradaDiabetes;
}
