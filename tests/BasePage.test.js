/**
 * Unit tests for BasePage class
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BasePage from '../src/lib/BasePage.js';
import AuthService from '../src/lib/AuthService.js';

describe('BasePage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.AuthService = AuthService;
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
    document.body.innerHTML = '';
  });

  describe('Theme Management', () => {
    it('debe aplicar tema dark por defecto', () => {
      BasePage.applyTheme('dark', false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('debe aplicar tema light correctamente', () => {
      BasePage.applyTheme('light', false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('debe alternar entre light y dark con toggleTheme()', () => {
      BasePage.applyTheme('dark', false);
      BasePage.toggleTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      BasePage.toggleTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('User Profile Sidebar Update', () => {
    it('debe actualizar los elementos del perfil en el sidebar con los datos del usuario', () => {
      document.body.innerHTML = `
        <div class="user-name"></div>
        <div class="user-email"></div>
        <div class="user-avatar"></div>
      `;

      AuthService.setUser({
        uid: 'usr_test_123',
        name: 'Maria Lopez',
        email: 'maria@example.com',
        picture: 'https://example.com/avatar.jpg',
        provider: 'google'
      });

      BasePage.updateUserProfile();

      expect(document.querySelector('.user-name').textContent).toBe('Maria Lopez');
      expect(document.querySelector('.user-email').textContent).toBe('maria@example.com');
      expect(document.querySelector('.user-avatar img').src).toBe('https://example.com/avatar.jpg');
    });

    it('debe mostrar valores de invitado cuando no hay usuario autenticado', () => {
      document.body.innerHTML = `
        <div class="user-name"></div>
        <div class="user-email"></div>
      `;

      BasePage.updateUserProfile();

      expect(document.querySelector('.user-name').textContent).toBe('Invitado');
      expect(document.querySelector('.user-email').textContent).toBe('');
    });
  });

  describe('Subclass Lifecycle', () => {
    it('permite extender BasePage y heredar datosUsuario', () => {
      class TestPage extends BasePage {
        onDataLoadedCalled = false;
        async onDataLoaded(data) {
          this.onDataLoadedCalled = true;
        }
      }

      AuthService.setUser({ uid: 'usr_subclass', name: 'Test' });
      const page = new TestPage();
      expect(page.datosUsuario).toBeDefined();
      expect(Array.isArray(page.datosUsuario.transactions)).toBe(true);
      expect(Array.isArray(page.datosUsuario.categories)).toBe(true);
    });
  });
});
