import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { fmtInt } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";

import { CLASSE_DO_CONTROLE } from "./controle";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type Opcao = { valor: string; rotulo: string; n?: number };

type Props = {
  rotulo: string;
  opcoes: Opcao[];
  selecionados: string[];
  aoAlternar: (valor: string) => void;
  aoLimpar: () => void;
};

/**
 * Combobox multi-seleção (§7.4): `role="listbox"` com `aria-multiselectable`, busca e "Todos".
 * Mostra TODAS as opções do domínio global, não só as sobreviventes ao filtro; exibe o rótulo
 * ("<1L") e envia o valor ("1"). As setas movem a opção ativa, anunciada por `aria-activedescendant`
 * (antes era só cor de fundo, invisível ao leitor de tela — redesenho, 1.16). A lista é um Popover
 * do Radix: o Esc fecha a lista e marca o evento, e o atalho global de limpar filtros o ignora.
 */
export function MultiSelect({ rotulo, opcoes, selecionados, aoAlternar, aoLimpar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const base = useId();
  const idRotulo = `${base}-rotulo`;
  const idValor = `${base}-valor`;
  const idLista = `${base}-lista`;
  const lista = useRef<HTMLUListElement>(null);

  const visiveis = opcoes.filter((o) => o.rotulo.toLowerCase().includes(busca.toLowerCase()));
  const nomes = opcoes.filter((o) => selecionados.includes(o.valor)).map((o) => o.rotulo);
  const resumo = nomes.length === 0 ? "Todos" : nomes.length === 1 ? nomes[0] : `${nomes[0]} +${nomes.length - 1}`;

  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  function mudarAberto(proximo: boolean) {
    setAberto(proximo);
    if (proximo) {
      setBusca("");
      setAtivo(0);
    }
  }

  function aoTeclar(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => Math.min(i + 1, visiveis.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setAtivo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setAtivo(Math.max(visiveis.length - 1, 0));
    } else if (e.key === "Enter") {
      const alvo = visiveis[ativo];
      if (alvo) {
        e.preventDefault();
        aoAlternar(alvo.valor);
      }
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={idRotulo} className="text-xs font-medium text-muted-foreground">
        {rotulo}
      </span>
      <Popover open={aberto} onOpenChange={mudarAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={aberto}
            aria-controls={idLista}
            aria-labelledby={`${idRotulo} ${idValor}`}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && !aberto) {
                e.preventDefault();
                mudarAberto(true);
              }
            }}
            className={cn(CLASSE_DO_CONTROLE, "items-center justify-between gap-2 text-left hover:bg-accent/60")}
          >
            <span id={idValor} className={cn("truncate", nomes.length === 0 && "text-muted-foreground")}>
              {resumo}
            </span>
            <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-60 p-0">
          <div className="relative border-b">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setAtivo(0);
              }}
              onKeyDown={aoTeclar}
              placeholder="Buscar…"
              aria-label={`Buscar em ${rotulo}`}
              aria-controls={idLista}
              aria-activedescendant={visiveis[ativo] ? `${idLista}-${ativo}` : undefined}
              className="h-11 w-full bg-transparent pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul ref={lista} id={idLista} role="listbox" aria-multiselectable="true" aria-label={rotulo} className="max-h-64 overflow-auto p-1">
            {visiveis.map((o, i) => {
              const marcado = selecionados.includes(o.valor);
              return (
                <li
                  key={o.valor}
                  id={`${idLista}-${i}`}
                  data-indice={i}
                  role="option"
                  aria-selected={marcado}
                  onClick={() => aoAlternar(o.valor)}
                  onMouseMove={() => setAtivo(i)}
                  className={cn("flex min-h-11 items-center gap-2.5 rounded-md px-2 text-sm select-none", i === ativo && "bg-accent text-accent-foreground")}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                      marcado ? "border-primary bg-primary text-primary-foreground" : "border-input bg-control",
                    )}
                  >
                    {marcado ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="flex-1 truncate">{o.rotulo}</span>
                  {o.n !== undefined ? <span className="text-xs text-muted-foreground tabular-nums">{fmtInt(o.n)}</span> : null}
                </li>
              );
            })}
            {visiveis.length === 0 ? <li className="px-2 py-3 text-sm text-muted-foreground">Nada encontrado.</li> : null}
          </ul>
          <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span>{selecionados.length === 0 ? "Nenhum filtro" : `${fmtInt(selecionados.length)} selecionado(s)`}</span>
            <button
              type="button"
              onClick={aoLimpar}
              disabled={selecionados.length === 0}
              className="alvo-toque rounded px-2 py-1 font-medium text-primary hover:bg-accent disabled:text-muted-foreground disabled:opacity-60"
            >
              Todos
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
