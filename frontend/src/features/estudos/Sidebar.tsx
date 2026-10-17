import { useEffect, useState } from "react";

import type { ItemToc } from "./tipos";

/** Sumário indentado por nível, com scrollspy (IntersectionObserver, rootMargin 0 0 -70% 0). */
export function Sidebar({ toc }: { toc: ItemToc[] }) {
  const [ativo, setAtivo] = useState("");

  useEffect(() => {
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setAtivo(e.target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    for (const item of toc) {
      const el = document.getElementById(item.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [toc]);

  return (
    <nav aria-label="Sumário" className="text-sm">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-fraco">Sumário</h2>
      <ol className="flex flex-col gap-1">
        {toc.map((item) => (
          <li key={item.id} style={{ paddingLeft: (item.nivel - 1) * 12 }}>
            <a
              href={`#${item.id}`}
              aria-current={ativo === item.id ? "location" : undefined}
              className={`block rounded px-1 py-0.5 hover:bg-superficie-alta ${ativo === item.id ? "font-semibold text-primaria" : "text-texto"}`}
            >
              <span className="mr-1 text-texto-fraco">{item.numero}</span>
              {item.texto}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
