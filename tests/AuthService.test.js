import { describe, it, expect, beforeEach } from 'vitest';
import AuthService from '../src/lib/AuthService.js';

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('debe retornar null cuando no hay usuario guardado', () => {
    expect(AuthService.getUser()).toBeNull();
    expect(AuthService.getUserId()).toBe('guest');
    expect(AuthService.isGuest()).toBe(true);
    expect(AuthService.isLoggedIn()).toBe(false);
  });

  it('debe manejar authUser="guest" correctamente', () => {
    localStorage.setItem('authUser', 'guest');
    localStorage.setItem('loggedIn', 'true');

    const user = AuthService.getUser();
    expect(user).not.toBeNull();
    expect(user.uid).toBe('guest');
    expect(user.name).toBe('Invitado');
    expect(AuthService.getUserId()).toBe('guest');
    expect(AuthService.isGuest()).toBe(true);
    expect(AuthService.isLoggedIn()).toBe(true);
  });

  it('debe guardar y recuperar un usuario autenticado normal', () => {
    const mockUser = {
      uid: 'user_12345',
      name: 'Edsen Test',
      email: 'edsen@ejemplo.com',
      provider: 'google.com'
    };

    AuthService.setUser(mockUser);

    expect(AuthService.isLoggedIn()).toBe(true);
    expect(AuthService.getUserId()).toBe('user_12345');
    expect(AuthService.isGuest()).toBe(false);

    const saved = AuthService.getUser();
    expect(saved.email).toBe('edsen@ejemplo.com');
    expect(saved.name).toBe('Edsen Test');
  });

  it('debe normalizar perfiles antiguos de invitado', () => {
    const legacyProfile = {
      name: 'Usuario Invitado',
      email: 'invitado@finanzapp.com',
      provider: 'guest'
    };
    localStorage.setItem('authUser', JSON.stringify(legacyProfile));

    const normalized = AuthService.normalizeGuestProfile();
    expect(normalized).toBe(true);

    const updated = AuthService.getUser();
    expect(updated.name).toBe('Invitado');
    expect(updated.email).toBe('');
    expect(updated.uid).toBe('guest');
  });

  it('debe limpiar la sesión al hacer logout', () => {
    AuthService.setUser({ uid: 'test_user', name: 'User' });
    expect(AuthService.isLoggedIn()).toBe(true);

    AuthService.clearSession();
    expect(AuthService.isLoggedIn()).toBe(false);
    expect(AuthService.getUser()).toBeNull();
    expect(localStorage.getItem('logoutTimestamp')).toBeTruthy();
  });

  it('debe ser resiliente ante JSON corrupto en localStorage', () => {
    localStorage.setItem('authUser', '{corrupt-json');
    expect(AuthService.getUser()).toBeNull();
    expect(AuthService.getUserId()).toBe('guest');
    expect(AuthService.isGuest()).toBe(true);
  });
});

