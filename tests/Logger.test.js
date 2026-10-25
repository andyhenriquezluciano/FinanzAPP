/**
 * Unit tests for Logger module
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Logger from '../src/lib/Logger.js';

describe('Logger Module', () => {
  beforeEach(() => {
    Logger.clearLogs();
    Logger.setLevel('DEBUG');
    vi.restoreAllMocks();
  });

  it('debe registrar mensajes con contexto y timestamp en el buffer circular', () => {
    Logger.info('Auth', 'Usuario inició sesión exitosamente');
    const logs = Logger.getRecentLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('INFO');
    expect(logs[0].context).toBe('Auth');
    expect(logs[0].message).toBe('Usuario inició sesión exitosamente');
    expect(logs[0].timestamp).toBeDefined();
  });

  it('debe estructurar errores con metadatos de excepción', () => {
    const testErr = new Error('Conexión perdida a Firestore');
    Logger.error('Database', 'Fallo al guardar transacción', testErr);

    const logs = Logger.getRecentLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('ERROR');
    expect(logs[0].meta.message).toBe('Conexión perdida a Firestore');
    expect(logs[0].meta.name).toBe('Error');
  });

  it('debe limitar el tamaño del buffer a MAX_BUFFER_SIZE (50)', () => {
    for (let i = 0; i < 60; i++) {
      Logger.debug('Loop', `Mensaje número ${i}`);
    }

    const logs = Logger.getRecentLogs();
    expect(logs.length).toBe(50);
    expect(logs[0].message).toBe('Mensaje número 10');
    expect(logs[49].message).toBe('Mensaje número 59');
  });

  it('debe respetar el nivel mínimo de log configurado', () => {
    Logger.setLevel('WARN');
    Logger.debug('Test', 'Ignorar debug');
    Logger.info('Test', 'Ignorar info');
    Logger.warn('Test', 'Capturar warn');

    const logs = Logger.getRecentLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('WARN');
  });
});

