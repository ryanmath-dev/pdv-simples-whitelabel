# PDV Mercadinho

PDV (Ponto de Venda) **offline-first** e **instalável (PWA)** para mercadinhos de
bairro, com controle de estoque por ledger, caixa, relatórios e um módulo fiscal
desacoplado (NFC-e futura). Funciona 100% sem internet — o caixa nunca para por
falta de conexão — e sincroniza quando houver backend (opcional e plugável).

É um **template/demo utilizável**: já vem com dados de exemplo (~60 produtos e
~2 semanas de vendas) e pode ser publicado como site estático.

> ⚠️ Documento de venda impresso é um **cupom não fiscal** ("DOCUMENTO SEM VALOR
> FISCAL"). A emissão fiscal real (NFC-e) é plugável — veja
> [docs/fiscal-adapter.md](docs/fiscal-adapter.md).

## Stack

TypeScript (strict) · React 18 + Vite · Tailwind CSS · Zustand · Dexie.js
(IndexedDB) · vite-plugin-pwa (Workbox) · React Router · Zod · UUID v7 ·
Vitest + Playwright · pnpm.

Arquitetura **Ports & Adapters** — domínio e casos de uso puros, infraestrutura
(Dexie, fiscal, pagamento, sync, impressora) atrás de interfaces, fiadas em um
único `src/composition-root.ts`. Veja [docs/architecture.md](docs/architecture.md).

## Como rodar

Pré-requisitos: Node 20+ e pnpm (`corepack enable` ou `npm i -g pnpm`).

```bash
pnpm install
pnpm dev          # desenvolvimento em http://localhost:5173
pnpm build        # build de produção em dist/
pnpm preview      # serve o build em http://localhost:4173
```

Qualidade:

```bash
pnpm typecheck    # tsc --noEmit (strict)
pnpm lint         # eslint (0 warnings)
pnpm test         # Vitest (domínio, casos de uso, seed)
pnpm test:e2e:install   # baixa o Chromium do Playwright (1x)
pnpm test:e2e           # E2E: venda completa + venda offline
```

## Modo demonstração

Com `VITE_DEMO_MODE` **não** definido ou `true`, na primeira abertura o banco é
populado com dados fictícios e um banner discreto "Demonstração — dados fictícios"
aparece. Desligue com `VITE_DEMO_MODE=false`.

Usuários de demo (mostrados na tela de login só em modo demo):

| Usuário | PIN  | Papel         |
|---------|------|---------------|
| `admin` | 1234 | Administrador |
| `caixa` | 0000 | Operador      |

Para recomeçar do zero: **Configurações → Resetar demonstração**.

## Instalar no computador/celular

O app é um PWA instalável:

- **Chrome/Edge (desktop e Android):** clique em "Instalar app" na barra do app
  (ou no ícone de instalação na barra de endereço). Abre em janela própria.
- **iPhone/iPad (Safari):** Compartilhar → "Adicionar à Tela de Início".

Após a primeira visita, o app abre **offline**. Quando houver nova versão, um
aviso "Nova versão disponível — Atualizar" aparece no topo.

## Publicar (deploy estático)

O projeto inclui configuração para os dois provedores, com fallback SPA e
`Cache-Control: no-cache` no `sw.js`.

### Vercel
1. Importe o repositório em vercel.com.
2. Framework: **Vite** (ou "Other"). Build: `pnpm build`. Output: `dist`.
3. O `vercel.json` já cuida de rewrites (SPA) e headers do service worker.
4. Deploy. (CLI: `npx vercel --prod`.)

### Netlify
1. "Add new site" → importe o repositório.
2. Build command: `pnpm build`. Publish directory: `dist`.
3. O `netlify.toml` já cuida do redirect SPA e dos headers.
4. Deploy. (CLI: `npx netlify deploy --prod`.)

## Atalhos de teclado (tela de caixa)

| Tecla | Ação |
|-------|------|
| `F1`  | Ajuda |
| `F2`  | Buscar produto |
| `F3`  | Alterar quantidade do item |
| `F4`  | Cancelar item (PIN de gerente, se configurado) |
| `F6`  | Desconto (item/venda; PIN se acima do limite) |
| `F8`  | Suspender venda |
| `F10` | Finalizar / pagar |
| `Esc` | Cancelar ação |

Dicas: digite `3*<código>` para multiplicar a quantidade; o leitor de código de
barras funciona como teclado (Enter finaliza a leitura); etiquetas de balança
(EAN-13 prefixo 2) são interpretadas conforme o padrão configurado.

## Dados e estoque

- Dinheiro sempre em **centavos inteiros** (nunca float).
- Quantidade em **milésimos** (1000 = 1 un ou 1 kg); produtos `UN` ou `KG`.
- Estoque é um **ledger** (`stockMovements`) — fonte da verdade; o saldo
  (`stockBalances`) é um cache recalculável (`rebuildBalances`).
- Toda escrita entra na **outbox** na mesma transação, pronta para sincronizar.

## Limitações conhecidas

- **Sem backend por padrão:** a segurança (login por PIN) é **local**, adequada
  para demonstração. Multi-terminal e sync real exigem implementar o
  [contrato de sincronização](docs/sync-contract.md).
- **Fiscal:** o provider padrão é "noop" (cupom não fiscal). NFC-e real exige um
  adapter — veja [docs/fiscal-adapter.md](docs/fiscal-adapter.md).
- **Impressão:** usa `window.print()` + CSS de bobina (58/80 mm). ESC/POS
  (WebUSB/Serial) e TEF/PIX dinâmico ficam como adapters futuros.
- A sessão de login é mantida em memória: recarregar a página exige novo login.

## Documentação

- [docs/architecture.md](docs/architecture.md) — camadas, fluxo de uma venda, diagramas.
- [docs/fiscal-adapter.md](docs/fiscal-adapter.md) — como plugar NFC-e.
- [docs/sync-contract.md](docs/sync-contract.md) — contrato do backend de sync.
- [docs/roadmap.md](docs/roadmap.md) — próximos passos.
