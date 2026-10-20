import { Database, TriangleAlert } from "lucide-react";

import { LIMITES_DO_SERVICO } from "@/features/inicio/limites";
import { Cartao, Estatistica, LinkDoCartao, ListaDeLimites } from "@/features/inicio/SobreOProjeto";
import { ROTA_DA_PRIVACIDADE } from "@/features/legal/rota";
import { URL_REPO } from "@/shared/api/http";
import { fmtInt, fmtPct } from "@/shared/format/ptBR";

import { useModelInfoDiabetes } from "../api/modelo";

const LIMITES = [
  LIMITES_DO_SERVICO.triagem,
  "Base de diabetes real, mas autodeclarada e sem pesos amostrais: associação, não causa, e uma prevalência que não é a da população.",
  LIMITES_DO_SERVICO.semLogin,
];

/**
 * Os dados e os limites do projeto da diabetes no Início, nos mesmos cartões do "Sobre o projeto" da
 * obesidade (ADR 0016): a base real e anonimizada, com as respostas e o % com diabetes do split de
 * /diabetes/model/info, e os limites, com o da base no meio.
 */
export function SobreADiabetes() {
  const info = useModelInfoDiabetes();
  const split = info.data?.split;
  const treino = Number(split?.linhas_treino);
  const teste = Number(split?.linhas_teste);
  const linhas = split ? treino + teste : undefined;
  // O % com diabetes da base inteira: a média das prevalências do treino e do teste, pesada pelas linhas.
  const media = (Number(split?.prevalencia_treino) * treino + Number(split?.prevalencia_teste) * teste) / (treino + teste);
  const prevalencia = Number.isFinite(media) ? media : undefined;
  return (
    <ul aria-label="Dados e limites da triagem de diabetes" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Cartao icone={Database} sobretitulo="Dados" titulo="Uma base pública, com respostas reais e anonimizadas">
        <dl className="grid grid-cols-2 gap-2">
          <Estatistica valor={linhas} formatar={fmtInt} rotulo="respostas" carregando={info.isPending} />
          <Estatistica valor={prevalencia} formatar={fmtPct} rotulo="com diabetes, na base" carregando={info.isPending} />
        </dl>
        <p>
          Respostas reais da pesquisa telefônica de fatores de risco do CDC dos Estados Unidos (BRFSS 2015), no UCI Machine Learning Repository
          (id 891, licença CC0), anonimizadas na origem: nenhum registro identifica uma pessoa. Sem pesos amostrais, a prevalência da base não
          estima a da população.
        </p>
        {URL_REPO ? (
          <LinkDoCartao para={`${URL_REPO}/blob/main/docs/dicionario-de-dados-diabetes.md`} externo>
            Dicionário de dados
          </LinkDoCartao>
        ) : null}
      </Cartao>
      <Cartao icone={TriangleAlert} sobretitulo="Limitações" titulo="Os limites, ditos com clareza" tom="alerta" ordem={1}>
        <ListaDeLimites limites={LIMITES} />
        <LinkDoCartao para={ROTA_DA_PRIVACIDADE}>Política de Privacidade</LinkDoCartao>
      </Cartao>
    </ul>
  );
}
