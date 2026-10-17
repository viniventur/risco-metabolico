import { paraErroApi } from "../http";

/** Converte o {data, error, response} do openapi-fetch em dado ou lança o envelope de erro da API. */
export function desembrulhar<T>(r: { data?: T; error?: unknown; response: Response }): T {
  if (r.error !== undefined || r.data === undefined) {
    throw paraErroApi(r.response.status, r.error);
  }
  return r.data;
}
