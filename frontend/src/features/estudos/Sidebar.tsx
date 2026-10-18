import { useEffect, useState } from "react";

import { cn } from "@/shared/lib/utils";

import type { ItemToc } from "./tipos";

/** Sumário indentado por nível, com scrollspy (IntersectionObserver, rootMargin 0 0 -70% 0) e links de 44 px. */
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
      <h2 className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Sumário</h2>
      <ol className="flex flex-col border-l">
        {toc.map((item) => {
          const atual = ativo === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={atual ? "location" : undefined}
                style={{ paddingLeft: 12 + (item.nivel - 1) * 12 }}
                className={cn(
                  "-ml-px flex min-h-11 items-center gap-2 border-l-2 py-1.5 pr-2 leading-snug transition-colors",
                  atual ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <span className="shrink-0 text-xs tabular-nums opacity-70">{item.numero}</span>
                <span>{item.texto}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
