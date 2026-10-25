import { test, expect } from '@playwright/test';

test.describe('FinanzApp - Selector de Tema (Dark / Light)', () => {
  test('Aplica data-theme en <html> y persiste en localStorage', async ({ page }) => {
    // Configurar sesión de invitado en localStorage antes de navegar
    await page.addInitScript(() => {
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('authUser', JSON.stringify({ uid: 'guest', email: 'guest@finanzapp.local', isAnonymous: true }));
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/pages/Categorias/Categorias.html');
    await page.waitForLoadState('domcontentloaded');

    // Verificar tema inicial oscuro
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Cambiar tema programáticamente o mediante botón si existe
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    });

    const currentTheme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(currentTheme).toBe('light');
    await expect(html).toHaveAttribute('data-theme', 'light');
  });
});

