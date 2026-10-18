/**
 * Os dados que a Política de Privacidade (./politica-privacidade.md) cita, num lugar só: o
 * responsável (controlador, na LGPD) é o mesmo dos outros projetos do autor, e os prazos são os que
 * o código e a infraestrutura DESTE projeto aplicam — mudou lá, muda aqui (o comentário de cada
 * campo diz onde). O texto usa {{CHAVE}}; `preencher` troca pelos valores antes de virar página.
 */

export type Responsavel = {
  nome: string;
  /** CPF mascarado: pessoa física. */
  documento: string;
  endereco: string;
  /** E-mail só para privacidade, o mesmo dos outros projetos: contato geral e pedidos do titular. */
  email: string;
  /** Pequeno porte (Res. CD/ANPD nº 2/2022, art. 11) dispensa o Encarregado, com um canal de contato. */
  encarregado: string;
  hospedagem: string;
  /** O endereço público do site, com https:// (o SITE_URL do deploy, docs/deploy-vps.md). */
  site: string;
  /** RETENCAO_DIAS do compose e do deploy (docs/deploy-vps.md): a retenção do log de predição. */
  retencaoLog: string;
  /** O `logging` do docker-compose.yml: até 3 arquivos de 10 MB por serviço, sobrescritos em rodízio. */
  rodizioLogsTecnicos: string;
  /** A janela mais longa do limite do simulador (LIMITE_TAXA_* da API: por minuto e por hora). */
  janelaDoLimite: string;
};

export const RESPONSAVEL: Responsavel = {
  nome: "Vinícius de Oliveira Cunha Ventura",
  documento: "***.***.***-85",
  endereco: "Maceió, AL",
  email: "vvprivacidade@gmail.com",
  encarregado: "o próprio responsável (agente de pequeno porte, dispensado de indicar Encarregado pela Resolução CD/ANPD nº 2/2022, art. 11)",
  // A mesma VPS dos outros projetos do autor (ADR 0009). Mudou de empresa ou de país? Atualize aqui.
  hospedagem: "Hostinger (servidor VPS nos Estados Unidos, em Boston)",
  site: "https://triagem-metabolica.viniciusventura.com.br",
  retencaoLog: "90 dias",
  rodizioLogsTecnicos: "até 30 MB por serviço",
  janelaDoLimite: "1 hora",
};

/** Versão do documento. Mudou algo importante? Troque a data e some uma linha ao histórico do texto. */
export const VERSAO_DOCUMENTO = { numero: "1.0", data: "2026-10-18" } as const;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10-18" → "18 de outubro de 2026" */
export function dataPorExtenso(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return `${dia} de ${MESES[(mes ?? 1) - 1]} de ${ano}`;
}

/** O valor entra no Markdown: sem a barra, os asteriscos do CPF mascarado viravam negrito e itálico. */
const escaparMarkdown = (texto: string): string => texto.replace(/[\\`*_[\]|~]/g, (c) => `\\${c}`);

/** Troca os {{CAMPOS}} do texto. */
export function preencher(texto: string, dados: Responsavel = RESPONSAVEL, site: string = dados.site): string {
  const valores: Record<string, string> = {
    RESPONSAVEL_NOME: dados.nome,
    RESPONSAVEL_DOCUMENTO: dados.documento,
    RESPONSAVEL_ENDERECO: dados.endereco,
    RESPONSAVEL_EMAIL: dados.email,
    ENCARREGADO: dados.encarregado,
    HOSPEDAGEM: dados.hospedagem,
    RETENCAO_LOG: dados.retencaoLog,
    RODIZIO_LOGS: dados.rodizioLogsTecnicos,
    JANELA_LIMITE: dados.janelaDoLimite,
    SITE: site,
    VERSAO: VERSAO_DOCUMENTO.numero,
    DATA_ATUALIZACAO: dataPorExtenso(VERSAO_DOCUMENTO.data),
  };
  return texto.replace(/\{\{([A-Z_]+)\}\}/g, (original, chave: string) => {
    const valor = valores[chave];
    return valor === undefined ? original : escaparMarkdown(valor);
  });
}
