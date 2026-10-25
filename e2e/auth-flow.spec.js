import { test, expect } from '@playwright/test';

test.describe('FinanzApp - Flujo de Autenticación y Navegación', () => {
  test('La página de inicio (Landing Page) carga con título y elementos clave', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FinanzApp/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('La página de Login carga los componentes de autenticación', async ({ page }) => {
    await page.goto('/pages/Login/Login.html');
    await expect(page).toHaveTitle(/Autenticación/i);
    const loginForm = page.locator('#login-form, .login-card, .auth-container');
    await expect(loginForm.first()).toBeVisible();
  });
});

