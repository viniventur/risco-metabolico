import createClient from "openapi-fetch";

import type { paths } from "./schema";

// VITE_API_URL é o prefixo público da API (ex.: https://<host>/api/v1). O openapi.json já
// traz os caminhos com /api/v1, então o cliente usa só a origem.
const PREFIXO = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000/api/v1";
export const ORIGEM_API = PREFIXO.replace(/\/api\/v\d+\/?$/, "");
export const URL_DOCS = `${ORIGEM_API}/docs`;
export const URL_REPO = (import.meta.env.VITE_REPO_URL as string | undefined) ?? "";

// X-Origem-Cliente: é o que faz as predições do simulador chegarem ao log com origem = 'painel'
// (6.8.2). Está em allow_headers do CORS do backend; sem isso o preflight recusaria.
export const cliente = createClient<paths>({
  baseUrl: ORIGEM_API,
  headers: { "X-Origem-Cliente": "painel" },
});

/** O envelope único de erro do backend ({erro, mensagem, detalhes}), ou um fallback. */
export type ErroApi = { erro: string; mensagem: string; detalhes?: unknown; status: number };

export function paraErroApi(status: number, corpo: unknown): ErroApi {
  if (corpo && typeof corpo === "object" && "erro" in corpo && "mensagem" in corpo) {
    const c = corpo as { erro: string; mensagem: string; detalhes?: unknown };
    return { erro: c.erro, mensagem: c.mensagem, detalhes: c.detalhes, status };
  }
  return { erro: "erro_http", mensagem: `Falha na API (${status}).`, status };
}

/** JSON estático de public/ (módulo Estudos): não passa pelo backend. */
export async function buscarEstatico<T>(caminho: string): Promise<T> {
  const resposta = await fetch(caminho, { headers: { Accept: "application/json" } });
  if (!resposta.ok) throw paraErroApi(resposta.status, null);
  return (await resposta.json()) as T;
}

// Todo erro lançado pelas queries/mutations é um ErroApi (desembrulhar/paraErroApi); o TanStack
// Query passa a tipar `error` assim em todos os hooks, sem genérico repetido em cada chamada.
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ErroApi;
  }
}
