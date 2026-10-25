import { test } from '@playwright/test';

test('inspect compact mode without transactions', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('loggedIn', 'true');
    localStorage.setItem('authUser', JSON.stringify({ uid: 'guest', email: 'guest@finanzapp.local', isAnonymous: true }));
  });

  await page.goto('/pages/Categorias/Categorias.html');
  await page.waitForLoadState('networkidle');

  // Let's clear transactions of category 2 (Comida) or find a category with 0 transactions
  // Or create a new category or clear category 2
  await page.evaluate(() => {
    window.__appConfirmDelete = false;
    window.limpiarTransaccionesCategoria(2);
  });

  await page.waitForTimeout(500);

  // Take screenshot before click
  await page.screenshot({ path: 'compact-before-click.png' });

  // Now click the compact toggle button on category 2
  const toggleBtn = page.locator('.category-card[data-category-id="2"] .compact-toggle-btn');
  if (await toggleBtn.count() > 0) {
    await toggleBtn.click();
  }

  await page.waitForTimeout(500);

  // Take screenshot after click
  await page.screenshot({ path: 'compact-after-click.png' });
});

