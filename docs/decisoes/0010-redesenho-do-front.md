# ADR 0010 — Redesenho geral do front

**Data:** 2026-10-18 · **Estado:** aceita · **Fase:** pós-F17

## Contexto

A seção ANCORA do plano e `docs/design-tokens.md` previam que, quando as fotos do painel de
referência chegassem, F15 seria reaberta como **tarefa de skin isolada**, e que **só** quatro coisas
poderiam mudar: `frontend/src/shared/tema/tokens.css`, `docs/design-tokens.md`, as classes de
`grid-column`/`grid-row` de `PainelPage.tsx` e os SVGs de `shared/ui/icones/`. A restrição existia
para que a espera pelas fotos não virasse uma segunda rodada de refatoração.

As fotos não são mais o problema. A auditoria de `docs/redesenho-front.md` mediu a interface
publicada e encontrou defeitos que nenhum desses quatro arquivos resolve: cartões com texto
sobreposto porque o *breakpoint* é da viewport e não do cartão, rótulos de eixo a 16 px porque a
regra de CSS não casa com o DOM do Recharts 3, o tema bloqueado pela CSP de produção, a frase de
dados fictícios lida quatro vezes pelo leitor de tela, o formulário descrito pela versão do modelo,
a tabela mostrando código no lugar de rótulo, a faixa de deriva explicando a indisponibilidade com
uma hibernação que deixou de existir na ADR 0009. São defeitos de componente, de casca e de dado
de apresentação — não de paleta.

## Decisão

**Esta ADR substitui a regra da ANCORA** ("F15 só pode tocar `tokens.css`, `design-tokens.md`, o
grid de `PainelPage` e os ícones"). O redesenho é geral e pode tocar **qualquer arquivo de
`frontend/src`** (e `frontend/index.html`, `frontend/public/` fora de `study/`, `frontend/e2e/`),
seguindo a especificação de `docs/redesenho-front.md`:

| tema | decisão |
|---|---|
| Componentes | shadcn/ui sobre Radix, com `class-variance-authority`, `tailwind-merge`, `lucide-react` e `sonner`, no padrão do front de referência do autor — portado para o Tailwind **v4** já usado (sem `tailwind.config.ts`). |
| Tokens | trios HSL claro/escuro com os nomes do padrão shadcn (`--background`, `--card`, `--primary`, …) em `tokens.css`; o `@theme inline` declara `--color-*: hsl(var(--*))` e continua apagando a paleta padrão (`--color-*: initial`). |
| Paleta | deixa de ser **PROVISÓRIA**: é a paleta do produto. O azul herdado `#3262DA` continua como `--primary` claro; as macro-faixas ganham rampas ordinais medidas (ΔL\* ≈ 10, ≥ 3:1) nos dois temas. |
| Casca | `AppShell` com barra lateral recolhível (gaveta abaixo de 1024 px), barra do topo com o estado da API e o tema, e `PageHeader` por tela. |
| Ícones | `lucide-react`, importados um a um. A marca continua SVG próprio. Revoga o "nenhuma biblioteca de ícones no bundle" de `design-tokens.md`. |
| Marca no painel | a `<Marca>` de §7.3 sai da faixa de KPIs (onde ocupava a vaga de um indicador) e passa a ser a marca da barra lateral, visível em todas as telas. |
| Barras do simulador | voltam à **cor única** de §7.5 (a implementação usava duas cores sem legenda). |
| Faixa de deriva | o texto deixa de citar "o banco do plano gratuito hiberna por inatividade" (ADR 0009: não há hibernação) e passa a falar de reinício, deploy ou falha do banco. |
| Estado da API | a faixa "Acordando o modelo…" que empurrava a página vira um selo na barra do topo, com o mesmo texto. |

## O que NÃO muda

- **A camada de dados**: `shared/api/endpoints/*`, `http.ts` (cabeçalho `X-Origem-Cliente: painel`,
  `VITE_API_URL` relativo em produção), `schema.d.ts` gerado e nunca editado, `useFiltros` (filtros
  na URL com nuqs), `useAgregado`, `useCrossFilter`, a ordem clínica das 7 classes, zod +
  react-hook-form no simulador, métricas só de `/model/info`, nenhum número escrito à mão.
- **O que §7.3/§7.4 especificam** sobre dado, agregação, tipo de gráfico e interação — a regra de
  arbitragem da ANCORA continua: a aparência é do redesenho, o comportamento é do plano.
- **Acessibilidade de F13/F14**: tabela equivalente ("Ver dados") em todo gráfico, legenda em HTML,
  foco visível, `aria-live` do recorte, Esc limpa os filtros, alvo mínimo de 44 px.
- **Os portões**: lista negra de termos (hooks e CI), cor literal só em `tokens.css` com os dois
  *greps* da ANCORA vazios, a frase de dados fictícios literal e contígua em `RodapeAviso.tsx` e no
  rodapé de toda tela, o aviso de registro anônimo no simulador. As fotos de referência continuam
  fora do git e de pull request.
- **As rotas** (`nginx.conf` e `verificar-stack.sh` intocados).

## Consequências

- O *bundle* ganha Radix (os primitivos usados), `lucide-react` (só os ícones importados), `sonner`,
  `class-variance-authority`, `clsx` e `tailwind-merge`. O portão `verificar-bundle.ps1` continua
  valendo.
- `docs/design-tokens.md` é reescrito com os tokens novos e perde o PROVISÓRIO e os três blocos de
  placeholder das fotos: se as fotos um dia chegarem, elas entram como referência visual de um novo
  ajuste, não como especificação pendente.
- Os seis *smokes* do Playwright e os testes de componente acompanham os papéis e nomes novos.
- O script de tema sai de linha para `public/tema-inicial.js`: a CSP `script-src 'self'` continua
  como está, sem *hash* nem `'unsafe-inline'`.
