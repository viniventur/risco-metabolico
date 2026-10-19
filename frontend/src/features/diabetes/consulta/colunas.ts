/**
 * As 23 colunas da Consulta da vertente, na ordem canônica da API (`COLUNAS_REGISTROS`, com a faixa
 * de IMC logo depois do IMC): o nome da coluna é a chave da linha de /diabetes/registros e, em
 * minúsculas, o `campo` de /diabetes/painel/por-categoria. Aqui mora só a FORMA (ordem e largura); o
 * rótulo de cada coluna e de cada valor vem da API (`campos`), nunca de uma cópia no front.
 */
export type ColunaDiabetes = {
  chave: string;
  /** largura em px: os rótulos da API são longos e quebram em até duas linhas no cabeçalho */
  largura: number;
  /** alinha à direita (números e contagens de dias) */
  numerica?: boolean;
};

export const COLUNAS_DIABETES: readonly ColunaDiabetes[] = [
  { chave: "Diabetes", largura: 150 },
  { chave: "Pressao_Alta", largura: 120 },
  { chave: "Colesterol_Alto", largura: 130 },
  { chave: "Exame_Colesterol_5_Anos", largura: 170 },
  { chave: "IMC", largura: 104, numerica: true },
  { chave: "Faixa_IMC", largura: 160 },
  { chave: "Fumou_100_Cigarros", largura: 150 },
  { chave: "Teve_AVC", largura: 110 },
  { chave: "Doenca_Coronariana_Ou_Infarto", largura: 180 },
  { chave: "Atividade_Fisica_30_Dias", largura: 170 },
  { chave: "Fruta_Diaria", largura: 120 },
  { chave: "Verdura_Diaria", largura: 150 },
  { chave: "Consumo_Pesado_Alcool", largura: 150 },
  { chave: "Cobertura_Saude", largura: 140 },
  { chave: "Deixou_Medico_Por_Custo", largura: 160 },
  { chave: "Saude_Geral", largura: 160 },
  { chave: "Dias_Saude_Mental_Ruim", largura: 180, numerica: true },
  { chave: "Dias_Saude_Fisica_Ruim", largura: 180, numerica: true },
  { chave: "Dificuldade_Caminhar", largura: 190 },
  { chave: "Sexo", largura: 110 },
  { chave: "Faixa_Etaria", largura: 140 },
  { chave: "Escolaridade", largura: 290 },
  { chave: "Faixa_Renda", largura: 170 },
];

/** O `campo` do painel de cada coluna: o nome do banco, em minúsculas (`coluna_banco` no backend). */
export const campoDaColuna = (chave: string) => chave.toLowerCase();

/** As colunas cujo rótulo não vem de /diabetes/painel/fatores: pedidas ao por-categoria sem filtro. */
export const CAMPOS_FORA_DOS_FATORES = ["diabetes", "faixa_imc", "dias_saude_mental_ruim", "dias_saude_fisica_ruim", "sexo", "faixa_etaria"] as const;

/** A coluna numérica que o por-categoria não agrupa: o rótulo dela vem de /diabetes/metadata. */
export const COLUNA_IMC = "IMC";
