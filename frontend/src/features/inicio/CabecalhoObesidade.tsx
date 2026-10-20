import { useModelInfo } from "@/shared/api/endpoints/modelo";
import { OBESIDADE } from "@/shared/projetos";

import { CabecalhoDoProjeto } from "./CabecalhoDoProjeto";
import { ComoFunciona } from "./ComoFunciona";

/**
 * O cabeçalho do projeto da obesidade no Início: o que o modelo faz e, ao lado, "como funciona" — os
 * três números (respostas, colunas do pipeline e probabilidades) vêm de GET /model/info e contam até o
 * valor.
 */
export function CabecalhoObesidade() {
  const info = useModelInfo();
  const d = info.data;
  const passos = [
    { chave: "entrada", valor: d?.n_features_entrada, texto: "respostas sobre medidas corporais e hábitos" },
    { chave: "modelo", valor: d?.n_features_modelo, texto: "colunas que o pipeline monta: o IMC e o one-hot de domínio fechado" },
    { chave: "saida", valor: d?.ordem_clinica.length, texto: "probabilidades em ordem clínica e um risco acumulado" },
  ];
  const descricao = d
    ? `${d.n_features_entrada} respostas sobre medidas corporais e hábitos viram, em milissegundos, a distribuição de probabilidade entre ${d.ordem_clinica.length} faixas de composição corporal e um risco metabólico acumulado.`
    : "As respostas sobre medidas corporais e hábitos viram, em milissegundos, a distribuição de probabilidade entre as faixas de composição corporal e um risco metabólico acumulado.";
  return (
    <CabecalhoDoProjeto
      projeto={OBESIDADE}
      id="obesidade-titulo"
      titulo="Triagem de obesidade: o modelo em teste"
      descricao={descricao}
      versao={d?.versao}
      lado={<ComoFunciona rotulo="Como funciona" passos={passos} carregando={info.isPending} />}
    />
  );
}
