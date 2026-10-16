import { test, expect, type Page } from '@playwright/test';

/** Limpa SW, caches e IndexedDB para começar de um estado limpo (demo semeia). */
async function resetApp(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
    const keys = await caches?.keys?.();
    await Promise.all((keys ?? []).map((k) => caches.delete(k)));
    await new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase('pdv-mercadinho');
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
  });
  await page.goto('/');
}

async function login(page: Page) {
  await page.getByRole('button', { name: /admin/i }).first().click();
  await page.getByPlaceholder('PIN').fill('1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('admin', { exact: true })).toBeVisible();
}

async function openCash(page: Page) {
  await page.getByRole('button', { name: 'Abrir caixa' }).first().click();
  const fund = page.getByLabel('Fundo de troco (R$)');
  await fund.fill('100,00');
  // O segundo "Abrir caixa" é o botão de confirmação do modal.
  await page.getByRole('button', { name: 'Abrir caixa' }).last().click();
  await expect(page.getByText('Caixa aberto')).toBeVisible();
}

test('venda completa: login, caixa, scan, finalizar com troco', async ({ page }) => {
  // Evita que window.print() abra um diálogo que bloqueia o teste (aplica em toda navegação).
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await resetApp(page);
  // Aguarda o seed (modo demo) popular e exibir o login.
  await expect(page.getByText(/Selecione o usuário/)).toBeVisible({ timeout: 20_000 });

  await login(page);
  await openCash(page);

  const code = page.getByPlaceholder(/Código de barras/);
  await code.fill('SKU001');
  await code.press('Enter');
  await expect(page.getByRole('cell', { name: 'Arroz Branco 5kg' })).toBeVisible();

  await code.fill('3*SKU015');
  await code.press('Enter');
  await expect(page.getByRole('cell', { name: 'Refrigerante Cola 2L' })).toBeVisible();

  // Total R$ 52,87 (25,90 + 3x 8,99)
  await expect(page.getByText('R$ 52,87').first()).toBeVisible();

  await page.getByRole('button', { name: /Finalizar/ }).click();
  await page.getByRole('button', { name: /R\$ 100,00/ }).click();
  await expect(page.getByText('R$ 47,13')).toBeVisible(); // troco
  await page.getByRole('button', { name: /Confirmar/ }).click();

  // Nova venda: carrinho limpo.
  await expect(page.getByText('Nenhum item. Passe um produto para começar.')).toBeVisible();

  // Confirma persistência no IndexedDB.
  const persisted = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('pdv-mercadinho');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const getAll = (store: string) =>
      new Promise<Record<string, unknown>[]>((res, rej) => {
        const t = db.transaction(store).objectStore(store).getAll();
        t.onsuccess = () => res(t.result);
        t.onerror = () => rej(t.error);
      });
    const sales = await getAll('sales');
    const sale = sales.find((s) => s.totalCents === 5287 && s.status === 'FINALIZED');
    const movs = (await getAll('stockMovements')).filter((m) => sale && m.refId === sale.id);
    return { found: !!sale, change: sale?.changeCents, movs: movs.map((m) => m.quantity).sort() };
  });
  expect(persisted.found).toBe(true);
  expect(persisted.change).toBe(4713);
  expect(persisted.movs).toEqual([-3000, -1000].sort());
});

test('funciona offline: recarrega sem rede e realiza uma venda', async ({ page, context }) => {
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await resetApp(page);
  await expect(page.getByText(/Selecione o usuário/)).toBeVisible({ timeout: 20_000 });
  await login(page);
  await openCash(page);

  // Garante que o service worker assumiu o controle (app shell em cache).
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  // Desliga a rede e recarrega: o app deve abrir do cache.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Selecione o usuário/)).toBeVisible({ timeout: 20_000 });

  await login(page);

  // Caixa continua aberto (dados persistidos no IndexedDB).
  await expect(page.getByText('Caixa aberto')).toBeVisible();

  const code = page.getByPlaceholder(/Código de barras/);
  await code.fill('SKU002');
  await code.press('Enter');
  await page.getByRole('button', { name: /Finalizar/ }).click();
  await page.getByRole('button', { name: /Valor exato/ }).click();
  await page.getByRole('button', { name: /Confirmar/ }).click();
  await expect(page.getByText('Nenhum item. Passe um produto para começar.')).toBeVisible();

  await context.setOffline(false);
});
