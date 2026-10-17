// SVG inline: o ÚNICO lugar de ícone do front (ANCORA/F15). Sem biblioteca de ícones no bundle.
import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { titulo?: string };

function base({ titulo, ...props }: Props) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": titulo ? undefined : true,
    role: titulo ? "img" : undefined,
    ...props,
  };
}

export function IconeInicio(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function IconePainel(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function IconeConsulta(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </svg>
  );
}

export function IconeSimulador(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <path d="M4 20h16" />
      <path d="M6 16l4-6 4 3 4-7" />
    </svg>
  );
}

export function IconeMonitoramento(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  );
}

export function IconeEstudos(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5M8 7h6" />
    </svg>
  );
}

export function IconeLimpar(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <path d="M4 5h16l-6 7v5l-4 2v-7z" />
      <path d="M18 18l3 3m0-3-3 3" />
    </svg>
  );
}

export function IconeSol(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconeLua(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function IconeTabela(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M3 15h18M9 5v14" />
    </svg>
  );
}

export function IconeBaixar(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 17v3h16v-3" />
    </svg>
  );
}

export function IconeImprimir(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M6 14h12v7H6z" />
    </svg>
  );
}

export function IconeAlerta(p: Props) {
  return (
    <svg {...base(p)}>
      {p.titulo && <title>{p.titulo}</title>}
      <path d="M12 3 2 21h20z" />
      <path d="M12 10v5M12 18h.01" />
    </svg>
  );
}

/** Marca decorativa da faixa de KPIs: puramente visual, sempre dentro de um contêiner aria-hidden. */
export function Marca(p: Props) {
  return (
    <svg {...base({ width: 56, height: 56, strokeWidth: 1.5, ...p })}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M6.5 13.5l2.5-3 2.5 4 2.5-6 2.5 5" />
    </svg>
  );
}
