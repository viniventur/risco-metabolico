import { useId, useState } from "react";

import { calcularImc, classificarImc } from "@/shared/dominio";
import { fmtImc } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

/** Classe literal do ponto de cada macro-faixa (o Tailwind só gera classe que aparece escrita). */
const PONTO: Record<string, string> = {
  abaixo: "bg-faixa-abaixo",
  normal: "bg-faixa-normal",
  sobrepeso: "bg-faixa-sobrepeso",
  obesidade: "bg-faixa-obesidade",
};

type Props = {
  /** o IMC que está no campo (digitado ou calculado), para mostrar a faixa */
  imc: number | null;
  /** preenche o campo IMC do formulário */
  aoCalcular: (imc: number) => void;
};

/**
 * A calculadora do IMC por peso e altura (decisão D2): preenche o campo IMC, que é o que vai à API — o
 * contrato não muda, e peso e altura ficam só na tela. Embaixo, a faixa do IMC que está no campo, com a
 * cor da macro-faixa (a mesma do cartão de IMC do simulador da obesidade).
 */
export function CalculadoraImc({ imc, aoCalcular }: Props) {
  const [medidas, setMedidas] = useState<{ peso: number; altura: number }>({ peso: Number.NaN, altura: Number.NaN });
  const base = useId();
  const idTitulo = `${base}-titulo`;

  function mudar(proximas: { peso: number; altura: number }) {
    setMedidas(proximas);
    if (proximas.peso > 0 && proximas.altura > 0) aoCalcular(calcularImc(proximas.peso, proximas.altura));
  }

  const faixa = imc !== null && imc > 0 ? classificarImc(imc) : null;
  return (
    <div role="group" aria-labelledby={idTitulo} className="flex flex-col gap-3 rounded-md border border-dashed bg-muted/30 p-4">
      <div className="flex flex-col gap-0.5">
        <p id={idTitulo} className="text-sm font-medium">
          Calcular o IMC pelo peso e pela altura
        </p>
        <p className="text-xs text-muted-foreground">Preenche o campo IMC. Peso e altura ficam só nesta tela: não vão para o modelo nem para o log.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={`${base}-peso`}>Peso (kg)</Label>
          <Input
            id={`${base}-peso`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            className="tabular-nums"
            onChange={(e) => mudar({ ...medidas, peso: e.target.valueAsNumber })}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={`${base}-altura`}>Altura (m)</Label>
          <Input
            id={`${base}-altura`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            className="tabular-nums"
            onChange={(e) => mudar({ ...medidas, altura: e.target.valueAsNumber })}
          />
        </div>
      </div>
      {faixa ? (
        <p className="flex items-center gap-2 text-sm" aria-live="polite">
          <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", PONTO[faixa.macro])} />
          <span>
            IMC <strong className="font-semibold tabular-nums">{fmtImc(imc)}</strong> · {faixa.faixa}
          </span>
        </p>
      ) : null}
    </div>
  );
}
