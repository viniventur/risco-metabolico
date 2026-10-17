import { useEffect, useId, useRef, useState } from "react";

type Opcao = { valor: string; rotulo: string; n?: number };

type Props = {
  rotulo: string;
  opcoes: Opcao[];
  selecionados: string[];
  aoAlternar: (valor: string) => void;
  aoLimpar: () => void;
};

/**
 * Combobox multi-seleção acessível (role="listbox", aria-multiselectable), com busca e chip "Todos".
 * Mostra TODAS as opções do domínio global, não só as sobreviventes ao filtro; exibe o rótulo e
 * envia o valor (ex.: "<1L" -> 1).
 */
export function MultiSelect({ rotulo, opcoes, selecionados, aoAlternar, aoLimpar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [foco, setFoco] = useState(0);
  const idLista = useId();
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  const visiveis = opcoes.filter((o) => o.rotulo.toLowerCase().includes(busca.toLowerCase()));
  const resumo = selecionados.length === 0 ? "Todos" : `${selecionados.length} selecionado(s)`;

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setAberto(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setFoco((f) => Math.min(f + 1, visiveis.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFoco((f) => Math.max(f - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      const alvo = visiveis[foco];
      if (aberto && alvo) {
        e.preventDefault();
        aoAlternar(alvo.valor);
      } else if (!aberto) {
        e.preventDefault();
        setAberto(true);
      }
    }
  }

  return (
    <div ref={raiz} className="relative flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-texto-fraco">{rotulo}</span>
      <div className="flex gap-1">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={aberto}
          aria-controls={idLista}
          onClick={() => setAberto((v) => !v)}
          onKeyDown={aoTeclar}
          className="flex min-h-11 flex-1 items-center justify-between rounded-card border border-borda bg-superficie px-3 text-left text-sm text-texto hover:bg-superficie-alta"
        >
          <span>{resumo}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {selecionados.length > 0 ? (
          <button
            type="button"
            onClick={aoLimpar}
            aria-label={`Limpar ${rotulo}`}
            className="min-h-11 rounded-card border border-borda bg-superficie px-2 text-xs text-texto hover:bg-superficie-alta"
          >
            Todos
          </button>
        ) : null}
      </div>
      {aberto ? (
        <div className="absolute top-full z-20 mt-1 w-full rounded-card border border-borda bg-superficie p-2 shadow-card">
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setFoco(0);
            }}
            onKeyDown={aoTeclar}
            placeholder="Buscar…"
            aria-label={`Buscar em ${rotulo}`}
            className="mb-2 w-full rounded border border-borda bg-fundo px-2 py-1 text-sm text-texto"
          />
          <ul id={idLista} role="listbox" aria-multiselectable="true" aria-label={rotulo} className="max-h-60 overflow-auto">
            {visiveis.map((o, i) => {
              const ativo = selecionados.includes(o.valor);
              return (
                <li
                  key={o.valor}
                  role="option"
                  aria-selected={ativo}
                  onClick={() => aoAlternar(o.valor)}
                  onMouseEnter={() => setFoco(i)}
                  className={`flex min-h-10 cursor-pointer items-center justify-between rounded px-2 text-sm ${i === foco ? "bg-superficie-alta" : ""} ${ativo ? "font-semibold text-primaria" : "text-texto"}`}
                >
                  <span>
                    <span aria-hidden="true" className="mr-2">
                      {ativo ? "☑" : "☐"}
                    </span>
                    {o.rotulo}
                  </span>
                  {o.n !== undefined ? <span className="text-xs text-texto-fraco">{o.n}</span> : null}
                </li>
              );
            })}
            {visiveis.length === 0 ? <li className="px-2 py-1 text-sm text-texto-fraco">Nada encontrado.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
