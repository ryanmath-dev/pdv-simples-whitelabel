# Contrato de sincronização

A sincronização remota é **opcional e plugável**. A demo usa
`LocalOnlySyncAdapter` (não envia nada; a outbox apenas acumula). Para habilitar
um backend, defina `VITE_SYNC_URL` — o `HttpSyncAdapter` passa a falar com um
endpoint REST genérico.

A rede **nunca** está no caminho crítico de uma venda: o sync roda em segundo
plano (ao voltar online, a cada X minutos e por botão manual).

## A port

```ts
// src/application/ports/sync-adapter.ts
export interface SyncAdapter {
  readonly name: string;
  isRemote(): boolean;
  push(batch: OutboxEntry[]): Promise<PushResult>;
  pull(since: string | null): Promise<PullResult>;
}
```

## Outbox

Toda escrita de entidade sincronizável gera, **na mesma transação**, um registro:

```ts
interface OutboxEntry {
  id: string;
  entity: string;      // 'products' | 'sales' | 'saleItems' | ...
  entityId: string;
  op: 'UPSERT' | 'DELETE';
  payload: unknown;    // snapshot da entidade (ou a entidade com deletedAt)
  createdAt: string;   // ISO 8601
  attempts: number;
  lastError?: string | null;
}
```

## Endpoints (HttpSyncAdapter)

### `POST {VITE_SYNC_URL}/sync/push`

Request:

```json
{ "entries": [ /* OutboxEntry[] */ ] }
```

Response:

```json
{
  "acceptedIds": ["<outboxId>", "..."],
  "errors": { "<outboxId>": "mensagem de erro" }
}
```

O cliente remove da outbox os `acceptedIds` e incrementa `attempts`/`lastError`
para os que falharam.

### `GET {VITE_SYNC_URL}/sync/pull?since=<cursor>`

Response:

```json
{
  "changes": [
    {
      "entity": "products",
      "entityId": "<uuid>",
      "op": "UPSERT",
      "payload": { /* entidade */ },
      "updatedAt": "2026-10-13T12:00:00.000Z",
      "version": 3
    }
  ],
  "cursor": "<novo-cursor>"
}
```

`since` é `null` na primeira sincronização; depois, o `cursor` retornado.

## Estratégia de conflito

- **Catálogo (produtos, categorias, preços, settings):** _last-write-wins_ por
  `updatedAt` + `version`. Ao aplicar um `pull`, aceite a mudança se o `version`
  recebido for maior (ou `updatedAt` mais recente) que o local.
- **Vendas e movimentos de estoque:** são **append-only** e nunca conflitam —
  por isso o estoque é um ledger, não um saldo editável. O servidor apenas
  acumula; o saldo é recalculável em qualquer réplica a partir dos movimentos.
- `stockBalances` é cache derivado e **não** sincroniza (recalcule localmente com
  `rebuildBalances`).

## Responsabilidades do backend (sugestão)

- Idempotência por `OutboxEntry.id` (reenvios não duplicam).
- Carimbar/propagar `updatedAt` e `version` monotônicos para LWW no `pull`.
- Fornecer um `cursor` estável e ordenável (ex.: timestamp ou sequência global).
- Autenticar o terminal (token por terminal) — fora do escopo da demo.
