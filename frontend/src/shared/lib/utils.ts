import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes condicionais e resolve conflitos do Tailwind (a última vence): `cn("p-4", cond && "p-2")`. */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
