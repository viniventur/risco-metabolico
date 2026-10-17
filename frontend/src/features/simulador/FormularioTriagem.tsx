import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import type { ErroApi } from "@/shared/api/http";
import type { CampoFormulario, EntradaTriagem, MetadadosFormulario } from "@/shared/api/endpoints/tipos";
import { calcularImc } from "@/shared/dominio";

import { AvisoExtrapolacao } from "./AvisoExtrapolacao";
import { CartaoImc } from "./CartaoImc";

type Props = {
  metadata: MetadadosFormulario;
  nome: string;
  aoMudarNome: (nome: string) => void;
  aoEnviar: (entrada: EntradaTriagem) => void;
  enviando: boolean;
  erro: ErroApi | null;
};

type Valores = Record<string, unknown>;

/** O schema zod nasce da especificação de /metadata: faixas dos números, opções fechadas das seleções. */
function montarSchema(campos: CampoFormulario[]) {
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

/** Defaults de /metadata; os selects guardam SEMPRE string (o DOM devolve string e o schema confere string). */
function padroes(campos: CampoFormulario[]): Valores {
  const v: Valores = {};
  for (const c of campos) {
    const padrao = c.padrao === null || c.padrao === undefined ? "" : c.padrao;
    v[c.nome] = c.tipo === "selecao" ? String(padrao) : padrao;
  }
  return v;
}

/** Converte os valores do formulário (strings dos selects) para o JSON de EntradaTriagem (inteiros nas escalas). */
function paraEntrada(valores: Valores, campos: CampoFormulario[]): EntradaTriagem {
  const saida: Record<string, string | number> = {};
  for (const c of campos) {
    const v = valores[c.nome];
    if (c.tipo === "numero") saida[c.nome] = Number(v);
    else {
      const opcao = (c.opcoes ?? []).find((o) => String(o.valor) === String(v));
      saida[c.nome] = opcao ? opcao.valor : String(v);
    }
  }
  return saida as unknown as EntradaTriagem;
}

export function FormularioTriagem({ metadata, nome, aoMudarNome, aoEnviar, enviando, erro }: Props) {
  const campos = useMemo(() => metadata.grupos.flatMap((g) => g.campos), [metadata]);
  const schema = useMemo(() => montarSchema(campos), [campos]);
  const { register, handleSubmit, control, formState } = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: padroes(campos),
    mode: "onBlur",
  });
  const peso = Number(useWatch({ control, name: "Peso" }));
  const altura = Number(useWatch({ control, name: "Altura" }));
  const imc = peso > 0 && altura > 0 ? calcularImc(peso, altura) : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((valores) => aoEnviar(paraEntrada(valores, campos)))}
      noValidate
      aria-describedby="aviso-formulario"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Nome (opcional)</span>
        <input
          type="text"
          value={nome}
          onChange={(e) => aoMudarNome(e.target.value)}
          maxLength={120}
          placeholder="Digite para identificar o relatório"
          className="min-h-11 rounded-card border border-borda bg-superficie px-3 text-texto"
        />
        <span className="text-xs text-texto-fraco">Só metadado do relatório: nunca vai para o modelo nem para o log.</span>
      </label>

      {metadata.grupos.map((grupo) => (
        <fieldset key={grupo.id} className="cartao flex flex-col gap-3 p-4">
          <legend className="px-1 text-base font-semibold">{grupo.titulo}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {grupo.campos.map((campo) => {
              const mensagem = formState.errors[campo.nome]?.message as string | undefined;
              return (
                <label key={campo.nome} className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold">{campo.rotulo}</span>
                  {campo.tipo === "numero" ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      min={campo.minimo ?? undefined}
                      max={campo.maximo ?? undefined}
                      step={campo.passo ?? undefined}
                      aria-invalid={mensagem ? true : undefined}
                      aria-describedby={campo.ajuda ? `${campo.nome}-ajuda` : undefined}
                      className="min-h-11 rounded-card border border-borda bg-superficie px-3 text-texto"
                      {...register(campo.nome)}
                    />
                  ) : (
                    <select
                      aria-invalid={mensagem ? true : undefined}
                      className="min-h-11 rounded-card border border-borda bg-superficie px-3 text-texto"
                      {...register(campo.nome)}
                    >
                      {(campo.opcoes ?? []).map((o) => (
                        <option key={String(o.valor)} value={String(o.valor)}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                  )}
                  {campo.ajuda ? (
                    <span id={`${campo.nome}-ajuda`} className="text-xs text-texto-fraco">
                      {campo.ajuda}
                    </span>
                  ) : null}
                  {mensagem ? (
                    <span className="text-xs text-perigo" role="alert">
                      {mensagem}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
          {grupo.id === "dados-iniciais" ? <CartaoImc imc={imc} /> : null}
        </fieldset>
      ))}

      {erro ? <AvisoExtrapolacao erro={erro} /> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="min-h-11 rounded-card bg-primaria px-5 text-sm font-semibold text-primaria-contraste hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? "Calculando…" : "Calcular probabilidade"}
        </button>
        <span id="aviso-formulario" className="text-xs text-texto-fraco">
          Modelo {metadata.versao_modelo}
        </span>
      </div>
    </form>
  );
}
