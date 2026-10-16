# Módulo fiscal (NFC-e) — como plugar

O app não emite documento fiscal por padrão: usa `NoopFiscalProvider`
(`fiscalStatus = 'NOT_REQUIRED'`). A emissão real (NFC-e, modelo 65) fica atrás
da _port_ `FiscalProvider` — ligar um emissor real é **criar um adapter e trocar
uma linha no `composition-root.ts`**.

## A port

```ts
// src/application/ports/fiscal-provider.ts
export interface FiscalProvider {
  readonly name: string;
  isEnabled(): boolean;
  issue(sale: FiscalSaleSnapshot): Promise<FiscalResult>;   // após venda finalizada
  cancel(saleId: string, reason: string): Promise<FiscalResult>;
  retryPending(): Promise<void>;                             // reprocessa contingência
  receiptExtras(saleId: string): Promise<FiscalReceiptExtras | null>; // QR, chave, protocolo
}
```

- `FiscalSaleSnapshot` é montado por uma **função pura** no domínio
  (`domain/fiscal-snapshot.ts → buildFiscalSnapshot`), com itens (inclusive
  campos fiscais `ncm`/`cfop`), pagamentos, emitente e consumidor opcional.
- `FiscalReceiptExtras` carrega o que o cupom precisa exibir: `qrCodeData`,
  `accessKey`, `protocol`, `extraLines`.

## Fluxo (não bloqueia o caixa)

`finalizeSale` **não** chama o provider diretamente. Ele publica `SaleFinalized`
no event bus; o handler fiscal (`application/fiscal-handler.ts`) assina o evento,
monta o snapshot e chama `provider.issue(...)`, gravando o resultado
(`fiscalStatus`, `fiscalRef`) na venda. Assim a venda já está concluída
localmente antes de qualquer tentativa de emissão.

```
Venda finalizada (local)  ──emit──▶  SaleFinalized
                                        │
                        fiscal-handler  ▼
                        provider.issue(snapshot)
                                        │
                     atualiza sale.fiscalStatus / fiscalRef
```

## Contingência offline

- Sem internet, um provider real deve marcar `fiscalStatus = 'CONTINGENCY'` (ou
  `'PENDING'`) e **não** travar o caixa.
- Quando a conexão voltar, chame `provider.retryPending()` (por exemplo, no mesmo
  gatilho do sync: ao voltar online / a cada X minutos / botão manual) para
  reprocessar as emissões pendentes e atualizar o status.

## Onde o cupom exibe os dados fiscais

`BrowserReceiptPrinter` recebe `ReceiptData.fiscal` (obtido de
`provider.receiptExtras(saleId)`). O template (`receipt-template.ts`) imprime as
`extraLines`, a chave de acesso e o QR Code no rodapé do cupom.

## Exemplo: provider de demonstração

`FakeFiscalProvider` (`infrastructure/fiscal/fake-fiscal-provider.ts`) marca toda
venda como `AUTHORIZED`, gera uma chave fictícia de 44 dígitos e um QR Code
fictício. É a prova de que trocar o provider exige mudar **apenas** o
`composition-root` (teste: `composition-root.test.ts`).

Ative-o com `VITE_FISCAL_PROVIDER=fake`, ou troque em código:

```ts
// src/composition-root.ts
function pickFiscalProvider(name) {
  switch (name) {
    case 'fake': return new FakeFiscalProvider();
    // case 'focus': return new FocusNfeProvider(env.FOCUS_TOKEN);
    // case 'plugnotas': return new PlugNotasProvider(...);
    default: return new NoopFiscalProvider();
  }
}
```

## Implementando um emissor real

1. Crie `infrastructure/fiscal/<provider>-fiscal-provider.ts` implementando
   `FiscalProvider` (chamadas à API de terceiros — Focus NFe, PlugNotas, NFE.io,
   ACBr, etc.), traduzindo `FiscalSaleSnapshot` para o payload do serviço.
2. Garanta os campos fiscais nos produtos (`ncm`, `cest`, `cfop`, `origin`,
   `taxProfileId` — já reservados em `product.ts`) e no emitente (`settings`).
3. Trate erros/rejeições retornando `FiscalResult` com `status` adequado
   (`REJECTED`, `CONTINGENCY`) e `message`.
4. Registre o provider em `pickFiscalProvider` e selecione via
   `VITE_FISCAL_PROVIDER`.
