/**
 * Tests for DatePicker component
 */
import { describe, it, expect, beforeEach } from 'vitest';
import DatePicker from '../src/lib/DatePicker.js';

describe('DatePicker Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('debe crear dinámicamente el modal en el DOM cuando se inicializa o se abre', () => {
    expect(document.getElementById('datePickerModal')).toBeNull();
    DatePicker.init();
    const modal = document.getElementById('datePickerModal');
    expect(modal).not.toBeNull();
    expect(modal.classList.contains('modal')).toBe(true);
    expect(modal.querySelector('#calendarDays')).not.toBeNull();
  });

  it('debe abrirse y formatear la fecha correctamente para un input de destino', () => {
    const input = document.createElement('input');
    input.id = 'testDateInput';
    input.value = '2026-05-15';
    document.body.appendChild(input);

    DatePicker.open(input);
    const modal = document.getElementById('datePickerModal');
    expect(modal.classList.contains('active')).toBe(true);

    const monthYear = document.getElementById('currentMonthYear');
    expect(monthYear.textContent).toContain('Mayo 2026');

    // Confirm selection
    DatePicker.confirm();
    expect(modal.classList.contains('active')).toBe(false);
    expect(input.value).toBe('2026-05-15');
  });

  it('debe navegar entre meses correctamente', () => {
    const input = document.createElement('input');
    input.value = '2026-01-10';
    document.body.appendChild(input);

    DatePicker.open(input);
    const monthYear = document.getElementById('currentMonthYear');
    expect(monthYear.textContent).toContain('Enero 2026');

    DatePicker.navigateMonth(1);
    expect(monthYear.textContent).toContain('Febrero 2026');

    DatePicker.navigateMonth(-1);
    expect(monthYear.textContent).toContain('Enero 2026');

    DatePicker.close();
  });

  it('debe cerrar el modal al llamar close()', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    DatePicker.open(input);
    const modal = document.getElementById('datePickerModal');
    expect(modal.classList.contains('active')).toBe(true);

    DatePicker.close();
    expect(modal.classList.contains('active')).toBe(false);
  });
});

