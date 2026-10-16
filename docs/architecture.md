# Arquitetura

O app segue **Ports & Adapters** (arquitetura hexagonal). O domínio e os casos de
uso são puros (sem React, sem Dexie). A infraestrutura implementa as _ports_ e é
escolhida em um único lugar: `src/composition-root.ts`.

## Camadas

```mermaid
flowchart TD
  subgraph UI["ui/ (React + Zustand + dexie-react-hooks)"]
    POS[Caixa] --- PROD[Produtos] --- STK[Estoque] --- CASH[Sessão] --- REP[Relatórios] --- SET[Config]
  end
  subgraph APP["application/ (casos de uso + ports)"]
    UC[finalize-sale, cancel-sale, receive-goods,\nadjust-stock, inventory, open/close caixa]
    PORTS[[ports: repositories, fiscal,\npayment, printer, sync]]
    EV[event bus]
  end
  subgraph DOM["domain/ (regras puras)"]
    MON[money/quantity/barcode]
    ENT[product, sale, stock, cash-register, user, reports]
  end
  subgraph INFRA["infrastructure/ (adapters)"]
    DB[(Dexie / IndexedDB\n+ outbox)]
    FIS[Noop/Fake FiscalProvider]
    PAY[ManualPaymentProvider]
    SYN[LocalOnly/Http SyncAdapter]
    PRN[BrowserReceiptPrinter]
    SEED[demo seed]
  end
  CR[composition-root.ts]

  UI --> APP
  APP --> DOM
  APP -. depende só das ports .-> PORTS
  CR --> INFRA
  CR --> APP
  INFRA -. implementa .-> PORTS
```

**Regras de dependência:**

- `domain/` não importa React, Dexie, nem `application/` ou `infrastructure/`.
- `application/` depende apenas de `domain/` e das suas próprias _ports_.
- `infrastructure/` implementa as _ports_; é fiada em `composition-root.ts`.
- `ui/` consome o `AppContainer` via contexto React.

## Fluxo de uma venda (finalize-sale)

```mermaid
sequenceDiagram
  participant Op as Operador (UI)
  participant POS as pos-store (Zustand)
  participant UC as finalizeSale (use case)
  participant DB as Dexie (transação)
  participant OUT as outbox
  participant EV as event bus
  participant FIS as FiscalProvider

  Op->>POS: escaneia itens, F10
  Op->>UC: finalizeSale(itens, pagamentos)
  UC->>UC: computeSaleTotals / computePaymentBalance (puro, centavos)
  UC->>DB: transaction(rw) {
  DB-->>DB: grava sale, saleItems, payments
  DB-->>DB: grava stockMovements (SALE, negativos)
  DB-->>DB: atualiza stockBalances (cache)
  DB-->>OUT: enfileira outbox (UPSERT) para cada escrita
  UC->>DB: } commit (tudo ou nada)
  UC-->>EV: emit SaleFinalized / StockChanged (após commit)
  EV-->>FIS: handler fiscal: issue(snapshot) [não bloqueia o caixa]
  FIS-->>DB: atualiza fiscalStatus/fiscalRef da venda
  UC-->>Op: imprime cupom (BrowserReceiptPrinter), nova venda
```

Pontos-chave:

- **Atomicidade:** venda + itens + pagamentos + movimentos + outbox são gravados
  na mesma transação Dexie. Se qualquer passo falha, nada é persistido
  (provado em `finalize-sale.test.ts`).
- **A rede nunca está no caminho crítico.** O fiscal e o sync reagem a eventos
  _após_ a venda já estar finalizada localmente.
- **Estoque é ledger.** O saldo é sempre recalculável a partir dos movimentos
  (`rebuildBalances`); vendas/movimentos são append-only e nunca conflitam no sync.

## Modelo de dados (resumo)

`products`, `categories`, `stockMovements` (ledger), `stockBalances` (cache),
`sales`, `saleItems`, `payments`, `cashSessions`, `cashMovements`, `users`,
`settings`, `outbox`, `auditLog`. Migrações versionadas do Dexie desde a v1
(`infrastructure/db/schema.ts`). Convenções: dinheiro em centavos inteiros,
quantidade em milésimos, toda entidade com `id` (UUIDv7), `createdAt`,
`updatedAt`, `deletedAt?`, `version`.
