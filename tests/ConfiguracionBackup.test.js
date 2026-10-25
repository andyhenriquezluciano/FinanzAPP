/**
 * Unit tests for ConfiguracionBackup module
 */
import { describe, it, expect, beforeEach } from 'vitest';
import ConfiguracionBackup from '../src/pages/Configuracion/ConfiguracionBackup.js';

describe('ConfiguracionBackup Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Seguridad contra Prototype Pollution', () => {
    it('debe detectar claves prohibidas como __proto__, constructor o prototype', () => {
      expect(ConfiguracionBackup.hasForbiddenKeys(null)).toBe(false);
      expect(ConfiguracionBackup.hasForbiddenKeys({ validKey: 123 })).toBe(false);

      const maliciousProto = JSON.parse('{"__proto__": {"admin": true}}');
      expect(ConfiguracionBackup.hasForbiddenKeys(maliciousProto)).toBe(true);

      const maliciousConstructor = { constructor: { name: 'attacker' } };
      expect(ConfiguracionBackup.hasForbiddenKeys(maliciousConstructor)).toBe(true);

      const nestedMalicious = { nested: { prototype: {} } };
      expect(ConfiguracionBackup.hasForbiddenKeys(nestedMalicious)).toBe(true);
    });
  });

  describe('Validaciones de Entrada', () => {
    it('debe validar montos numéricos válidos y rechazar valores infinitos o corruptos', () => {
      expect(ConfiguracionBackup.isValidImportAmount(100)).toBe(true);
      expect(ConfiguracionBackup.isValidImportAmount('1,500.50')).toBe(true);
      expect(ConfiguracionBackup.isValidImportAmount(0)).toBe(true);
      expect(ConfiguracionBackup.isValidImportAmount(-50)).toBe(true);

      expect(ConfiguracionBackup.isValidImportAmount(NaN)).toBe(false);
      expect(ConfiguracionBackup.isValidImportAmount(Infinity)).toBe(false);
      expect(ConfiguracionBackup.isValidImportAmount(1e15)).toBe(false); // excede 1e12
    });

    it('debe validar fechas válidas en múltiples formatos', () => {
      expect(ConfiguracionBackup.isValidImportDate('2026-05-15')).toBe(true);
      expect(ConfiguracionBackup.isValidImportDate(new Date())).toBe(true);
      expect(ConfiguracionBackup.isValidImportDate(Date.now())).toBe(true);

      expect(ConfiguracionBackup.isValidImportDate('')).toBe(false);
      expect(ConfiguracionBackup.isValidImportDate('fecha-invalida')).toBe(false);
      expect(ConfiguracionBackup.isValidImportDate(null)).toBe(false);
    });

    it('debe validar longitud de strings para prevenir memory bloating', () => {
      expect(ConfiguracionBackup.isValidImportString('Supermercado')).toBe(true);
      expect(ConfiguracionBackup.isValidImportString('A'.repeat(500))).toBe(true);
      expect(ConfiguracionBackup.isValidImportString('A'.repeat(501))).toBe(false);
    });
  });

  describe('Normalización de Estado', () => {
    it('debe normalizar objetos vacíos a un estado base seguro', () => {
      const state = ConfiguracionBackup.normalizeState(null);
      expect(state).toEqual({
        transactions: [],
        categories: [],
        budgets: {}
      });
    });

    it('debe sincronizar transacciones embebidas en categorías', () => {
      const raw = {
        categories: [
          {
            id: 'cat_1',
            name: 'Comida',
            transactions: [
              { id: 'tx_1', amount: 50, date: '2026-01-01', description: 'Almuerzo' }
            ]
          }
        ]
      };

      const normalized = ConfiguracionBackup.normalizeState(raw);
      expect(normalized.categories.length).toBe(1);
      expect(normalized.transactions.length).toBe(1);
      expect(normalized.transactions[0].categoryId).toBe('cat_1');
      expect(normalized.transactions[0].categoryName).toBe('Comida');
    });

    it('debe calcular conteo de transacciones y presupuestos correctamente', () => {
      const snapshot = {
        transactions: [{ id: '1' }, { id: '2' }],
        categories: [
          { id: 'c1', transactions: [{ id: '1' }, { id: '2' }] }
        ],
        budgets: {
          b1: { amount: 1000 },
          b2: { amount: 2000 }
        }
      };

      expect(ConfiguracionBackup.countTransactions(snapshot)).toBe(2);
      expect(ConfiguracionBackup.countBudgets(snapshot)).toBe(2);
    });
  });

  describe('Normalización de Respaldo Completo', () => {
    it('debe procesar y validar un payload exportado por FinanzApp', () => {
      const payload = {
        version: 1,
        exportedAt: '2026-06-01T12:00:00.000Z',
        settings: { theme: 'dark', currency: 'DOP' },
        state: {
          categories: [{ id: '1', name: 'Transporte', transactions: [] }],
          transactions: [],
          budgets: {}
        }
      };

      const result = ConfiguracionBackup.normalizeImportPayload(payload);
      expect(result).not.toBeNull();
      expect(result.state.categories.length).toBe(1);
      expect(result.settings.theme).toBe('dark');
    });

    it('debe rechazar payloads maliciosos con prototipos inyectados', () => {
      const maliciousPayload = JSON.parse('{"state": {"categories": []}, "__proto__": {"polluted": true}}');
      const result = ConfiguracionBackup.normalizeImportPayload(maliciousPayload);
      expect(result).toBeNull();
    });
  });
});

