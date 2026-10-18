import { zodResolver } from "@hookform/resolvers/zod";
import { Info, LoaderCircle, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import type { ErroApi } from "@/shared/api/http";
import type { CampoFormulario, EntradaTriagem, MetadadosFormulario } from "@/shared/api/endpoints/tipos";
import { AVISO_REGISTRO_ANONIMO, calcularImc } from "@/shared/dominio";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/native-select";
import { Separator } from "@/shared/ui/separator";

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

const ID_AVISO = "aviso-registro-anonimo";

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

/**
 * Os 16 campos de /metadata num cartão só, em três seções numeradas (os grupos do legado), com o
 * aviso de registro anônimo no topo — e é ELE que descreve o formulário (`aria-describedby`; antes
 * era a versão do modelo, redesenho 1.13). O botão de enviar fica numa barra fixa no pé do cartão:
 * visível em qualquer ponto da rolagem (antes ficava a 1.127 px, fora da dobra).
 */
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
    <Card className="relative">
      <form onSubmit={handleSubmit((valores) => aoEnviar(paraEntrada(valores, campos)))} noValidate aria-describedby={ID_AVISO} aria-label="Formulário de triagem">
        <div className="flex flex-col gap-6 p-5 sm:p-6">
          <Alert variant="info">
            <Info aria-hidden="true" />
            <AlertTitle>Registro anônimo</AlertTitle>
            <AlertDescription id={ID_AVISO}>{AVISO_REGISTRO_ANONIMO}</AlertDescription>
          </Alert>

          {metadata.grupos.map((grupo, indice) => (
            // fieldset nomeado pelo título da seção (aria-labelledby): a <legend> desenhada pelo
            // navegador cortava a borda do cartão (redesenho, 1.12).
            <fieldset key={grupo.id} aria-labelledby={`secao-${grupo.id}`} className="flex min-w-0 flex-col gap-5">
              {indice > 0 ? <Separator className="mb-1" /> : null}
              <h2 id={`secao-${grupo.id}`} className="flex items-center gap-3 text-[15px] font-semibold tracking-tight">
                <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                  {indice + 1}
                </span>
                {grupo.titulo}
              </h2>
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                {indice === 0 ? (
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="campo-nome">
                      Nome <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="campo-nome"
                      value={nome}
                      onChange={(e) => aoMudarNome(e.target.value)}
                      maxLength={120}
                      placeholder="Digite para identificar o relatório"
                      aria-describedby="campo-nome-ajuda"
                    />
                    <p id="campo-nome-ajuda" className="text-xs text-muted-foreground">
                      Só metadado do relatório: nunca vai para o modelo nem para o log.
                    </p>
                  </div>
                ) : null}
                {grupo.campos.map((campo) => {
                  const mensagem = formState.errors[campo.nome]?.message as string | undefined;
                  const id = `campo-${campo.nome}`;
                  const descritores = [campo.ajuda ? `${id}-ajuda` : null, mensagem ? `${id}-erro` : null].filter(Boolean).join(" ") || undefined;
                  return (
                    <div key={campo.nome} className="flex min-w-0 flex-col gap-2">
                      <Label htmlFor={id}>{campo.rotulo}</Label>
                      {campo.tipo === "numero" ? (
                        <Input
                          id={id}
                          type="number"
                          inputMode="decimal"
                          min={campo.minimo ?? undefined}
                          max={campo.maximo ?? undefined}
                          step={campo.passo ?? undefined}
                          aria-invalid={mensagem ? true : undefined}
                          aria-describedby={descritores}
                          className="tabular-nums"
                          {...register(campo.nome)}
                        />
                      ) : (
                        <NativeSelect id={id} aria-invalid={mensagem ? true : undefined} aria-describedby={descritores} {...register(campo.nome)}>
                          {(campo.opcoes ?? []).map((o) => (
                            <option key={String(o.valor)} value={String(o.valor)}>
                              {o.rotulo}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                      {campo.ajuda ? (
                        <p id={`${id}-ajuda`} className="text-xs leading-snug text-muted-foreground">
                          {campo.ajuda}
                        </p>
                      ) : null}
                      {mensagem ? (
                        <p id={`${id}-erro`} className="text-xs font-medium text-destructive" role="alert">
                          {mensagem}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                {grupo.id === "dados-iniciais" ? (
                  <div className="sm:col-span-2">
                    <CartaoImc imc={imc} />
                  </div>
                ) : null}
              </div>
            </fieldset>
          ))}

          {erro ? <AvisoExtrapolacao erro={erro} /> : null}
        </div>

        <div
          className={cn(
            "nao-imprimir sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-lg border-t bg-card/92 px-5 py-3 backdrop-blur sm:px-6",
          )}
        >
          <p className="text-xs text-muted-foreground">
            Modelo v{metadata.versao_modelo} · 16 respostas, 7 probabilidades
          </p>
          <Button type="submit" disabled={enviando} className="min-w-52">
            {enviando ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}
            {enviando ? "Calculando…" : "Calcular probabilidade"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
