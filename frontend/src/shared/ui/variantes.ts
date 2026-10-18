import { cva, type VariantProps } from "class-variance-authority";

// As variantes moram fora dos componentes: o arquivo .tsx exporta só componente (o fast refresh do
// Vite recarrega sem perder estado) e quem precisa da classe de um botão num <a> a importa daqui.

export const variantesDoBotao = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 " +
    "aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-control shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // 44 px: o alvo mínimo de toque do projeto (F13/F14).
        default: "h-11 px-4",
        // 36 px desenhados; a área clicável chega a 44 px pelo .alvo-toque de tokens.css.
        sm: "alvo-toque h-9 px-3 text-[13px]",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
        "icon-sm": "alvo-toque size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type VariantesDoBotao = VariantProps<typeof variantesDoBotao>;

export const variantesDoSelo = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/12 text-primary",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-success/12 text-success",
        warning: "border-transparent bg-warning/14 text-warning",
        destructive: "border-transparent bg-destructive/12 text-destructive",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type VariantesDoSelo = VariantProps<typeof variantesDoSelo>;

export const variantesDoAlerta = cva(
  "relative grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground [&>svg]:text-muted-foreground",
        info: "border-primary/30 bg-primary/6 text-foreground [&>svg]:text-primary",
        destructive: "border-destructive/40 bg-destructive/8 text-foreground [&>svg]:text-destructive",
        warning: "border-warning/45 bg-warning/8 text-foreground [&>svg]:text-warning",
        success: "border-success/40 bg-success/8 text-foreground [&>svg]:text-success",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type VariantesDoAlerta = VariantProps<typeof variantesDoAlerta>;
