import { describe, it, expect, beforeEach } from 'vitest';
import '../src/pages/Categorias/CategoriasFilters.js';

const CategoriasFilters = window.CategoriasFilters || globalThis.CategoriasFilters;

describe('CategoriasFilters - Modular Filter & Sorting Manager', () => {

  beforeEach(() => {
    localStorage.clear();
  });

  it('debe cargar filtros predeterminados si no hay en localStorage', () => {
    const f = CategoriasFilters.cargarFiltrosPersistidos();
    expect(f.year).toBeNull();
    expect(f.month).toBeNull();
    expect(f.searchTerm).toBe('');
  });

  it('debe guardar y recargar filtros en localStorage correctamente', () => {
    CategoriasFilters.guardarFiltrosPersistidos({ year: 2026, month: 2, searchTerm: 'Supermercado' });
    const loaded = CategoriasFilters.cargarFiltrosPersistidos();
    expect(loaded.year).toBe(2026);
    expect(loaded.month).toBe(2);
    expect(loaded.searchTerm).toBe('Supermercado');
  });

  it('debe generar claves de caché consistentes', () => {
    const k1 = CategoriasFilters.claveFiltros({ year: 2026, month: 1, searchTerm: 'uber' });
    const k2 = CategoriasFilters.claveFiltros({ year: 2026, month: 1, searchTerm: '  UBER  ' });
    expect(k1).toBe(k2);
  });

  it('debe filtrar transacciones por año, mes y término de búsqueda', () => {
    const txs = [
      { id: '1', date: new Date(2026, 0, 15), amount: 1500, description: 'Supermercado Nacional', type: 'expense' },
      { id: '2', date: new Date(2026, 1, 10), amount: 450, description: 'Uber Trip', type: 'expense' },
      { id: '3', date: new Date(2025, 11, 20), amount: 20000, description: 'Pago de Nómina', type: 'income' },
      { id: '4', date: new Date(2026, 1, 25), amount: 1200, description: 'Farmacia Carol', type: 'expense' }
    ];

    // Filtrar solo 2026
    const resYear = CategoriasFilters.filtrarTransaccionesPorFecha(txs, { year: 2026, month: null, searchTerm: '' });
    expect(resYear.length).toBe(3);

    // Filtrar Febrero 2026 (mes 1)
    const resFeb = CategoriasFilters.filtrarTransaccionesPorFecha(txs, { year: 2026, month: 1, searchTerm: '' });
    expect(resFeb.length).toBe(2);
    expect(resFeb.map(t => t.id)).toEqual(['2', '4']);

    // Filtrar por término de búsqueda
    const resSearch = CategoriasFilters.filtrarTransaccionesPorFecha(txs, { year: null, month: null, searchTerm: 'Uber' });
    expect(resSearch.length).toBe(1);
    expect(resSearch[0].description).toBe('Uber Trip');

    // Filtrar por tipo (ingreso)
    const resIncome = CategoriasFilters.filtrarTransaccionesPorFecha(txs, { year: null, month: null, searchTerm: 'ingreso' });
    expect(resIncome.length).toBe(1);
    expect(resIncome[0].description).toBe('Pago de Nómina');
  });

  it('debe aplicar filtros a un árbol completo de categorías', () => {
    const categories = [
      {
        id: 1,
        name: 'Comida',
        transactions: [
          { id: 't1', date: new Date(2026, 2, 1), amount: 300, description: 'Almuerzo' },
          { id: 't2', date: new Date(2025, 5, 1), amount: 500, description: 'Cena' }
        ]
      },
      {
        id: 2,
        name: 'Transporte',
        transactions: [
          { id: 't3', date: new Date(2026, 2, 2), amount: 200, description: 'Metro' }
        ]
      }
    ];

    const filtradas = CategoriasFilters.aplicarFiltrosACategorias(categories, { year: 2026, month: 2, searchTerm: '' });
    expect(filtradas[0].transactions.length).toBe(1);
    expect(filtradas[0].transactions[0].id).toBe('t1');
    expect(filtradas[1].transactions.length).toBe(1);
    expect(filtradas[1].transactions[0].id).toBe('t3');
  });

  it('debe generar opciones de año incluyendo la opción "Todos los años" en la lista', () => {
    document.body.innerHTML = `
      <div class="custom-dropdown" id="yearFilter">
        <div class="custom-dropdown-selected" data-value="">
          <span>Todos los años</span>
        </div>
        <div class="custom-dropdown-options"></div>
      </div>
    `;

    // Con filtro nulo
    CategoriasFilters.generarOpcionesAnio({ year: null, month: null, searchTerm: '' });
    const sel = document.querySelector('#yearFilter .custom-dropdown-selected');
    expect(sel.querySelector('span').textContent).toBe('Todos los años');
    expect(sel.getAttribute('data-value')).toBe('');

    const options = document.querySelectorAll('#yearFilter .custom-dropdown-option');
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].textContent).toBe('Todos los años');
    expect(options[0].getAttribute('data-value')).toBe('');
    expect(options[0].classList.contains('selected')).toBe(true);

    // Con año seleccionado (2026)
    CategoriasFilters.generarOpcionesAnio({ year: 2026, month: null, searchTerm: '' });
    expect(sel.querySelector('span').textContent).toBe('2026');
    expect(sel.getAttribute('data-value')).toBe('2026');
  });

  it('al limpiar filtros debe resetear el año a null y mostrar "Todos los años"', () => {
    document.body.innerHTML = `
      <input type="text" id="searchInput" value="prueba">
      <button id="clearSearchBtn"></button>
      <div class="custom-dropdown filter-active" id="yearFilter">
        <div class="custom-dropdown-selected" data-value="2026">
          <span>2026</span>
        </div>
        <div class="custom-dropdown-options">
          <div class="custom-dropdown-option selected" data-value="2026">2026</div>
        </div>
      </div>
      <div class="custom-dropdown filter-active" id="monthFilter">
        <div class="custom-dropdown-selected" data-value="5">
          <span>Junio</span>
        </div>
        <div class="custom-dropdown-options">
          <div class="custom-dropdown-option selected" data-value="5">Junio</div>
        </div>
      </div>
      <button id="clearFiltersBtn" class="filter-active"></button>
    `;

    const filtros = { year: 2026, month: 5, searchTerm: 'prueba' };
    let changed = false;
    CategoriasFilters.configurarControlesFiltrosYBusqueda(filtros, () => { changed = true; });

    const btn = document.getElementById('clearFiltersBtn');
    btn.click();

    expect(filtros.year).toBeNull();
    expect(filtros.month).toBeNull();
    expect(filtros.searchTerm).toBe('');
    expect(changed).toBe(true);

    const yearSel = document.querySelector('#yearFilter .custom-dropdown-selected');
    expect(yearSel.querySelector('span').textContent).toBe('Todos los años');
    expect(yearSel.getAttribute('data-value')).toBe('');

    const monthSel = document.querySelector('#monthFilter .custom-dropdown-selected');
    expect(monthSel.querySelector('span').textContent).toBe('Todos los meses');
    expect(monthSel.getAttribute('data-value')).toBe('');

    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    expect(yearFilter.classList.contains('filter-active')).toBe(false);
    expect(monthFilter.classList.contains('filter-active')).toBe(false);
    expect(btn.classList.contains('filter-active')).toBe(false);
  });
});

