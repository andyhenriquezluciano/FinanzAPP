import { test, expect } from '@playwright/test';

test.describe('FinanzApp - Carga de Páginas sin Errores Críticos', () => {
  const pagesToTest = [
    { name: 'Categorias', path: '/pages/Categorias/Categorias.html' },
    { name: 'Presupuestos', path: '/pages/Presupuestos/Presupuestos.html' },
    { name: 'Estadistica', path: '/pages/Estadistica/Estadistica.html' },
    { name: 'Configuracion', path: '/pages/Configuracion/Configuracion.html' }
  ];

  for (const { name, path } of pagesToTest) {
    test(`Página ${name} carga y renderiza su estructura base`, async ({ page }) => {
      const consoleErrors = [];
      page.on('pageerror', (err) => consoleErrors.push(err.message));

      await page.addInitScript(() => {
        localStorage.setItem('loggedIn', 'true');
        localStorage.setItem('authUser', JSON.stringify({ uid: 'guest', email: 'guest@finanzapp.local', isAnonymous: true }));
      });

      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      // Verificar que el body esté visible y no haya crasheos fatales
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Verificar que no haya errores de sintaxis fatales
      const syntaxErrors = consoleErrors.filter(msg => /SyntaxError|Unexpected token/i.test(msg));
      expect(syntaxErrors).toHaveLength(0);
    });
  }
});

