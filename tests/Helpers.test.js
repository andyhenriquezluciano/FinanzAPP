import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../src/lib/Helpers.js';

const Helpers = window.Core?.helpers;

describe('Helpers - Utilidades Financieras, Seguridad y Formato', () => {

  beforeEach(() => {
    localStorage.clear();
    window.__appCensorAmounts = false;
    window.__appShowCents = false;
  });

  afterEach(() => {
    localStorage.clear();
    window.__appCensorAmounts = false;
    window.__appShowCents = false;
  });

  describe('Seguridad y Escape contra XSS (Helpers.esc)', () => {
    it('debe escapar caracteres HTML criticos (&, <, >, ", \')', () => {
      expect(Helpers.esc('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(Helpers.esc('Tom & Jerry')).toBe('Tom &amp; Jerry');
      expect(Helpers.esc("User's Input")).toBe('User&#39;s Input');
      expect(Helpers.esc('onload="malicious()"')).toBe('onload=&quot;malicious()&quot;');
    });

    it('debe manejar de forma segura tipos no string (null, undefined, numeros, booleans)', () => {
      expect(Helpers.esc(null)).toBe('');
      expect(Helpers.esc(undefined)).toBe('');
      expect(Helpers.esc(12345)).toBe('12345');
      expect(Helpers.esc(0)).toBe('0');
      expect(Helpers.esc(false)).toBe('false');
    });
  });

  describe('Formateo y Validacion de Cantidades (isValidAmount, sanitizeAmount)', () => {
    it('isValidAmount debe aceptar montos validos y rechazar invalidos o negativos', () => {
      expect(Helpers.isValidAmount('100')).toBe(true);
      expect(Helpers.isValidAmount('100.50')).toBe(true);
      expect(Helpers.isValidAmount('0.01')).toBe(true);
      expect(Helpers.isValidAmount('99999999.99')).toBe(true);

      // Invalidos
      expect(Helpers.isValidAmount('0')).toBe(false);
      expect(Helpers.isValidAmount('-50')).toBe(false);
      expect(Helpers.isValidAmount('abc')).toBe(false);
      expect(Helpers.isValidAmount('')).toBe(false);
      expect(Helpers.isValidAmount(null)).toBe(false);
      expect(Helpers.isValidAmount('10.555')).toBe(false);
      expect(Helpers.isValidAmount('123456789')).toBe(false);
    });

    it('sanitizeAmount debe truncar enteros y decimales respetando los limites', () => {
      expect(Helpers.sanitizeAmount('1234567890.12345', 8, 2)).toBe('12345678.12');
      expect(Helpers.sanitizeAmount('100,50')).toBe('100.50');
      expect(Helpers.sanitizeAmount('1250,75')).toBe('1250.75');
      expect(Helpers.sanitizeAmount('10.20.30')).toBe('10.20');
      expect(Helpers.sanitizeAmount('abc')).toBe('');
    });

    it('hasMultipleDecimalSeparators y hasTooManyFractionDigits deben detectar inconsistencias', () => {
      expect(Helpers.hasMultipleDecimalSeparators('10.50.20')).toBe(true);
      expect(Helpers.hasMultipleDecimalSeparators('10,50,20')).toBe(true);
      expect(Helpers.hasMultipleDecimalSeparators('10.50,20')).toBe(true);
      expect(Helpers.hasMultipleDecimalSeparators('10.50')).toBe(false);
      expect(Helpers.hasMultipleDecimalSeparators('1000')).toBe(false);

      expect(Helpers.hasTooManyFractionDigits('10.55', 2)).toBe(false);
      expect(Helpers.hasTooManyFractionDigits('10.555', 2)).toBe(true);
      expect(Helpers.hasTooManyFractionDigits('10,555', 2)).toBe(true);
      expect(Helpers.hasTooManyFractionDigits('1000', 2)).toBe(false);
    });

    it('formatInputAmount debe dar formato en vivo con separador de miles y coma decimal', () => {
      expect(Helpers.formatInputAmount('1234567.89')).toBe('1.234.567,89');
      expect(Helpers.formatInputAmount('50,')).toBe('50,');
      expect(Helpers.formatInputAmount('000500')).toBe('500');
      expect(Helpers.formatInputAmount(null)).toBe('');
      expect(Helpers.formatInputAmount('')).toBe('');
    });
  });

  describe('Formateo de Monedas y Privacidad (formatCurrency, formatCurrencyStrict)', () => {
    it('debe formatear montos positivos y negativos con la divisa activa', () => {
      const pos = Helpers.formatCurrency(1500);
      expect(pos).toContain('1,500');
      expect(pos).toContain('RD$');

      const neg = Helpers.formatCurrency(-750);
      expect(neg).toContain('-RD$');
      expect(neg).toContain('750');
    });

    it('debe respetar la opcion showCents cuando este activada', () => {
      window.__appShowCents = true;
      const formatted = Helpers.formatCurrency(2500.5);
      expect(formatted).toContain('2,500.50');
    });

    it('debe censurar montos cuando censorAmounts este activado', () => {
      window.__appCensorAmounts = true;
      expect(Helpers.formatCurrency(1500)).toBe('RD$••••••');
      expect(Helpers.formatCurrency(1500, { withSymbol: false })).toBe('••••••');
      expect(Helpers.formatCurrencyStrict(1500)).toBe('••••••');
    });

    it('formatCurrencyStrict debe devolver la cifra sin simbolo de divisa', () => {
      const formatted = Helpers.formatCurrencyStrict(9876.54);
      expect(formatted).not.toContain('RD$');
      expect(formatted).not.toContain('$');
      expect(formatted).toContain('9,877');
    });
  });

  describe('Validacion y Formato de Fechas (validateDate, formatDate)', () => {
    it('validateDate debe validar fechas requeridas, rechazar invalidas y rechazar fechas futuras', () => {
      expect(Helpers.validateDate(null).isValid).toBe(false);
      expect(Helpers.validateDate(null).error).toBe('Fecha requerida');

      expect(Helpers.validateDate('fecha-invalida').isValid).toBe(false);
      expect(Helpers.validateDate('fecha-invalida').error).toBe('Fecha inválida');

      const pastResult = Helpers.validateDate('2025-01-15');
      expect(pastResult.isValid).toBe(true);
      expect(pastResult.error).toBeNull();
      expect(pastResult.date).toBeInstanceOf(Date);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const futureResult = Helpers.validateDate(tomorrow);
      expect(futureResult.isValid).toBe(false);
      expect(futureResult.error).toBe('No se pueden agregar transacciones futuras');
    });

    it('formatDate debe formatear a DD/MM/YYYY por defecto y soportar anos bisiestos', () => {
      const leapDay = new Date(2024, 1, 29);
      expect(Helpers.formatDate(leapDay)).toBe('29/02/2024');

      const endOfYear = new Date(2025, 11, 31);
      expect(Helpers.formatDate(endOfYear)).toBe('31/12/2025');
      expect(Helpers.formatDate('31/12/2025')).toBe('31/12/2025');
      expect(Helpers.formatDate(null)).toBe('');
      expect(Helpers.formatDate('invalida')).toBe('');
    });

    it('formatDate debe respetar la preferencia MDY si esta configurada', () => {
      localStorage.setItem('finanzapp:settings:v1', JSON.stringify({ dateFormat: 'mdy' }));
      const d = new Date(2025, 6, 4);
      expect(Helpers.formatDate(d)).toBe('07/04/2025');
    });

    it('formatDateForInput debe generar formato YYYY-MM-DD para inputs nativos de fecha', () => {
      const d = new Date(2025, 4, 10);
      expect(Helpers.formatDateForInput(d)).toBe('2025-05-10');
      expect(Helpers.formatDateForInput(null)).toBe('');
    });
  });

  describe('Persistencia y Aislamiento de Filtros (loadSharedFilters, saveSharedFilters)', () => {
    it('debe guardar y cargar filtros de pagina con aislamiento de claves', () => {
      Helpers.saveSharedFilters({ year: 2026, month: 5, searchTerm: 'Super' }, 'historial');
      Helpers.saveSharedFilters({ year: 2025, month: 0, searchTerm: 'Gasolina' }, 'graficas');

      const f1 = Helpers.loadSharedFilters('historial');
      expect(f1.year).toBe(2026);
      expect(f1.month).toBe(5);
      expect(f1.searchTerm).toBe('Super');

      const f2 = Helpers.loadSharedFilters('graficas');
      expect(f2.year).toBe(2025);
      expect(f2.month).toBe(0);
      expect(f2.searchTerm).toBe('Gasolina');
    });

    it('debe tolerar JSON corrupto en localStorage sin arrojar excepciones', () => {
      localStorage.setItem('finanzapp:filters:corrupt:v1', '{corrupt json!!!');
      const filters = Helpers.loadSharedFilters('corrupt');
      expect(filters.year).toBeNull();
      expect(filters.month).toBeNull();
      expect(filters.searchTerm).toBe('');
    });
  });

  describe('Redondeo Seguro de Coma Flotante (Helpers.round2)', () => {
    it('debe redondear números a 2 decimales con precisión epsilon', () => {
      expect(Helpers.round2(1.005)).toBe(1.01);
      expect(Helpers.round2(0.1 + 0.2)).toBe(0.3);
      expect(Helpers.round2(10.555)).toBe(10.56);
      expect(Helpers.round2(10.554)).toBe(10.55);
      expect(Helpers.round2('123.456')).toBe(123.46);
      expect(Helpers.round2(0)).toBe(0);
    });

    it('debe soportar cantidad personalizada de decimales', () => {
      expect(Helpers.round2(1.23456, 3)).toBe(1.235);
      expect(Helpers.round2(1.23456, 1)).toBe(1.2);
      expect(Helpers.round2(1.23456, 0)).toBe(1);
    });
  });

  describe('Generador Universal de IDs (Helpers.generateId)', () => {
    it('debe generar IDs únicos con y sin prefijo', () => {
      const id1 = Helpers.generateId();
      const id2 = Helpers.generateId('cat');
      const id3 = Helpers.generateId('budget');

      expect(typeof id1).toBe('string');
      expect(id1.includes('_')).toBe(true);
      expect(id2.startsWith('cat_')).toBe(true);
      expect(id3.startsWith('budget_')).toBe(true);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Parsing Universal de Fechas (Helpers.parseDateInput)', () => {
    it('debe parsear fechas en formato ISO YYYY-MM-DD', () => {
      const d = Helpers.parseDateInput('2026-05-15');
      expect(d).toBeInstanceOf(Date);
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(4); // Mayo = 4
      expect(d.getDate()).toBe(15);
    });

    it('debe parsear fechas en formato DD/MM/YYYY o DD.MM.YYYY', () => {
      const d1 = Helpers.parseDateInput('25/12/2026');
      expect(d1).toBeInstanceOf(Date);
      expect(d1.getFullYear()).toBe(2026);
      expect(d1.getMonth()).toBe(11); // Dic = 11
      expect(d1.getDate()).toBe(25);

      const d2 = Helpers.parseDateInput('10.08.2026');
      expect(d2).toBeInstanceOf(Date);
      expect(d2.getFullYear()).toBe(2026);
      expect(d2.getMonth()).toBe(7); // Agosto = 7
      expect(d2.getDate()).toBe(10);
    });

    it('debe respetar el formato MDY cuando esté configurado en settings', () => {
      localStorage.setItem('finanzapp:settings:v1', JSON.stringify({ dateFormat: 'mdy' }));
      const d = Helpers.parseDateInput('08/25/2026');
      expect(d).toBeInstanceOf(Date);
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(7); // Agosto = 7
      expect(d.getDate()).toBe(25);
    });

    it('debe retornar null para entradas vacías, inválidas o malformadas', () => {
      expect(Helpers.parseDateInput('')).toBeNull();
      expect(Helpers.parseDateInput(null)).toBeNull();
      expect(Helpers.parseDateInput(undefined)).toBeNull();
      expect(Helpers.parseDateInput('fecha-invalida')).toBeNull();
      expect(Helpers.parseDateInput('2026/01')).toBeNull();
    });

    it('parseFechaInput debe ser un alias exacto de parseDateInput', () => {
      expect(Helpers.parseFechaInput('2026-03-20')?.getDate()).toBe(20);
    });
  });

});