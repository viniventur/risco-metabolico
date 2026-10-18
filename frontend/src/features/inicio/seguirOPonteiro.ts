import type { PointerEvent } from "react";

/** Põe a posição do ponteiro no cartão, para o holofote de `.cartao-holofote` (inicio.css) seguir. */
export function seguirOPonteiro(evento: PointerEvent<HTMLElement>): void {
  const cartao = evento.currentTarget;
  const caixa = cartao.getBoundingClientRect();
  cartao.style.setProperty("--holofote-x", `${evento.clientX - caixa.left}px`);
  cartao.style.setProperty("--holofote-y", `${evento.clientY - caixa.top}px`);
}
