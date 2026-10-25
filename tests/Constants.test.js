import { describe, it, expect } from 'vitest';
import Constants from '../src/lib/Constants.js';

describe('Constants', () => {
  it('debe tener las claves de almacenamiento esenciales congeladas', () => {
    expect(Constants.STORAGE_KEYS.AUTH_USER).toBe('authUser');
    expect(Constants.STORAGE_KEYS.LOGGED_IN).toBe('loggedIn');
    expect(Constants.STORAGE_KEYS.SETTINGS).toBe('finanzapp:settings:v1');
    expect(Object.isFrozen(Constants.STORAGE_KEYS)).toBe(true);
  });

  it('debe tener los eventos del sistema congelados', () => {
    expect(Constants.APP_EVENTS.THEME_CHANGED).toBe('finanzapp:theme:changed');
    expect(Constants.APP_EVENTS.TRANSACTIONS_UPDATED).toBe('finanzapp:transactions:updated');
    expect(Object.isFrozen(Constants.APP_EVENTS)).toBe(true);
  });

  it('debe contener las monedas soportadas con metadatos correctos', () => {
    expect(Constants.SUPPORTED_CURRENCIES.DOP.symbol).toBe('RD$');
    expect(Constants.SUPPORTED_CURRENCIES.USD.symbol).toBe('$');
    expect(Constants.SUPPORTED_CURRENCIES.EUR.symbol).toBe('€');
  });

  it('debe tener los settings por defecto congelados con valores válidos', () => {
    expect(Constants.DEFAULT_SETTINGS.theme).toBe('dark');
    expect(Constants.DEFAULT_SETTINGS.currency).toBe('DOP');
    expect(Constants.DEFAULT_SETTINGS.confirmDelete).toBe('on');
    expect(Object.isFrozen(Constants.DEFAULT_SETTINGS)).toBe(true);
  });
});

