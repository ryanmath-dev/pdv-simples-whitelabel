# Roadmap — próximos passos

Sugestões de evolução, aproximadamente por prioridade/impacto.

## Backend e multi-terminal
- **Backend real de sincronização** (ex.: Supabase/Postgres) implementando o
  [contrato de sync](sync-contract.md): `/sync/push` e `/sync/pull`.
- **Multi-terminal**: vários caixas compartilhando catálogo e consolidando
  vendas/estoque; numeração de venda por terminal já existe.
- **Autenticação de terminal** (token por dispositivo) e papéis sincronizados.

## Fiscal
- Adapter **NFC-e real** (Focus NFe, PlugNotas, NFE.io ou ACBr) — ver
  [fiscal-adapter.md](fiscal-adapter.md). Inclui contingência offline e
  reprocessamento (`retryPending`).
- Perfis tributários por produto (campos `ncm`, `cest`, `cfop`, `origin`,
  `taxProfileId` já reservados).

## Pagamentos
- **TEF** e **PIX dinâmico** (QR com confirmação) via novos `PaymentProvider`.
- Conciliação de pagamentos por adquirente.

## Hardware
- **Impressora ESC/POS** (WebUSB/WebSerial) como `ReceiptPrinter`, além do
  `window.print()` atual.
- **Balança serial** (leitura direta de peso) e integração com etiquetas de
  balança já suportadas na leitura.

## Produto / UX
- Persistir a sessão de login (hoje em memória) com bloqueio por inatividade.
- Clientes e fiado (`STORE_CREDIT` já modelado nos pagamentos).
- Promoções (leve 3 pague 2), combos, preço por faixa de quantidade.
- Relatórios adicionais (DRE simples, giro de estoque, ruptura).

## Empacotamento desktop (opcional)
- **Tauri** para empacotar como app desktop (menor que Electron):
  1. `cargo install tauri-cli` e `pnpm add -D @tauri-apps/cli`.
  2. `pnpm tauri init` apontando `distDir` para `../dist` e `devUrl` para o Vite.
  3. `pnpm build` e `pnpm tauri build` geram o instalador.
  O domínio/infra não mudam — o app continua lendo/escrevendo no IndexedDB do
  WebView. (Apenas documentado; não implementado.)

## Qualidade
- Mais cobertura E2E (CSV import, inventário, fechamento de caixa impresso).
- Métricas de performance do caixa (tempo por venda) e testes de carga da outbox.
