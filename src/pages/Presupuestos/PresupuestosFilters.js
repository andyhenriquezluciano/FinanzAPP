/**
 * FinanzApp - Presupuestos Filters Module
 * Single Responsibility: Gestión de filtros (año, mes, categoría), dropdowns personalizados y persistencia.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PresupuestosFilters = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_FILTROS_KEY = 'finanzapp:filters:presupuestos:v1';
  let config = {};

  function init(options) {
    config = options || {};
    return {
      cargarFiltrosPersistidos,
      guardarFiltrosPersistidos,
      getFiltros,
      setFiltros,
      actualizarIndicadoresFiltrosActivos,
      limpiarFiltros,
      aplicarFiltros,
      configurarDropdowns,
      generarOpcionesAnio,
      obtenerPresupuestosFiltrados
    };
  }

  function getBudgets() {
    return typeof config.getBudgets === 'function' ? config.getBudgets() : [];
  }

  function getTransactions() {
    return typeof config.getTransactions === 'function' ? config.getTransactions() : [];
  }

  function parseFecha(raw) {
    if (typeof config.parseFecha === 'function') return config.parseFecha(raw);
    if (!raw) return null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function cargarFiltrosPersistidos() {
    try {
      if (typeof localStorage === 'undefined') return { year: null, month: null, searchTerm: '', category: null };
      const raw = localStorage.getItem(STORAGE_FILTROS_KEY);
      if (!raw) return { year: null, month: null, searchTerm: '', category: null };
      const parsed = JSON.parse(raw);
      const yr = (parsed.year !== null && parsed.year !== undefined && parsed.year !== '') ? parseInt(parsed.year, 10) : null;
      const mo = (parsed.month !== null && parsed.month !== undefined && parsed.month !== '') ? parseInt(parsed.month, 10) : null;
      return {
        year: (yr !== null && !isNaN(yr)) ? yr : null,
        month: (mo !== null && !isNaN(mo) && mo >= 0 && mo <= 11) ? mo : null,
        searchTerm: typeof parsed.searchTerm === 'string' ? parsed.searchTerm : '',
        category: (parsed.category !== null && parsed.category !== undefined && parsed.category !== '') ? String(parsed.category) : null
      };
    } catch {
      return { year: null, month: null, searchTerm: '', category: null };
    }
  }

  function guardarFiltrosPersistidos(novosFiltros) {
    try {
      if (typeof localStorage === 'undefined') return;
      const current = cargarFiltrosPersistidos();
      localStorage.setItem(STORAGE_FILTROS_KEY, JSON.stringify({
        year: novosFiltros.year !== undefined ? novosFiltros.year : current.year,
        month: novosFiltros.month !== undefined ? novosFiltros.month : current.month,
        searchTerm: novosFiltros.searchTerm !== undefined ? novosFiltros.searchTerm : current.searchTerm,
        category: novosFiltros.category !== undefined ? novosFiltros.category : current.category
      }));
    } catch {}
  }

  const initialShared = cargarFiltrosPersistidos();
  const filtros = {
    year: initialShared.year ? String(initialShared.year) : null,
    month: initialShared.month !== null ? initialShared.month : null,
    category: initialShared.category || null
  };

  function getFiltros() {
    return filtros;
  }

  function setFiltros(newFiltros) {
    Object.assign(filtros, newFiltros);
  }

  function actualizarIndicadoresFiltrosActivos() {
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    const clearBtn = document.getElementById('clearFiltersBtn');

    const hayAnio = filtros.year !== null && filtros.year !== '';
    const hayMes = filtros.month !== null && filtros.month !== '';

    if (yearFilter) yearFilter.classList.toggle('filter-active', hayAnio);
    if (monthFilter) monthFilter.classList.toggle('filter-active', hayMes);
    if (clearBtn) clearBtn.classList.toggle('filter-active', hayAnio || hayMes);
  }

  function limpiarFiltros() {
    const hadActiveFilters = (filtros.year !== null && filtros.year !== '') || (filtros.month !== null && filtros.month !== '') || filtros.category !== null;

    filtros.year = null;
    filtros.month = null;
    filtros.category = null;
    guardarFiltrosPersistidos({ year: null, month: null, category: null });

    const yearFilter = document.getElementById('yearFilter');
    if (yearFilter) {
      const sel = yearFilter.querySelector('.custom-dropdown-selected');
      if (sel && sel.querySelector('span')) sel.querySelector('span').textContent = 'Todos los años';
      if (sel) sel.setAttribute('data-value', '');
      yearFilter.querySelectorAll('.custom-dropdown-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.setAttribute('aria-selected', 'false');
      });
    }

    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
      const sel = monthFilter.querySelector('.custom-dropdown-selected');
      if (sel && sel.querySelector('span')) sel.querySelector('span').textContent = 'Todos los meses';
      if (sel) sel.setAttribute('data-value', '');
      monthFilter.querySelectorAll('.custom-dropdown-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.setAttribute('aria-selected', 'false');
      });
    }

    actualizarIndicadoresFiltrosActivos();
    if (typeof config.onFilterChange === 'function') {
      config.onFilterChange();
    }

    if (window.Toast) {
      if (hadActiveFilters) window.Toast.success('Filtros limpiados');
      else window.Toast.info('No hay filtros activos');
    }
  }

  function aplicarFiltros() {
    actualizarIndicadoresFiltrosActivos();
    if (typeof config.onFilterChange === 'function') {
      config.onFilterChange();
    }
  }

  function generarOpcionesAnio() {
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) return;

    const currentYear = new Date().getFullYear();
    const optionsContainer = yearFilter.querySelector('.custom-dropdown-options');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = '';

    const allYears = new Set([2025, currentYear]);
    (getTransactions() || []).forEach(tx => {
      const d = parseFecha(tx.date);
      if (d) allYears.add(d.getFullYear());
    });
    const sortedYears = Array.from(allYears).sort((a, b) => a - b);

    const allOption = document.createElement('div');
    const isAllSelected = filtros.year === null || filtros.year === '' || filtros.year === undefined;
    allOption.className = `custom-dropdown-option ${isAllSelected ? 'selected' : ''}`;
    allOption.setAttribute('data-value', '');
    allOption.textContent = 'Todos los años';
    optionsContainer.appendChild(allOption);

    sortedYears.forEach(year => {
      const isSelected = filtros.year !== null && String(filtros.year) === String(year);
      const option = document.createElement('div');
      option.className = `custom-dropdown-option ${isSelected ? 'selected' : ''}`;
      option.setAttribute('data-value', String(year));
      option.textContent = String(year);
      optionsContainer.appendChild(option);
    });

    const selected = yearFilter.querySelector('.custom-dropdown-selected');
    if (selected) {
      if (filtros.year !== null && filtros.year !== '' && filtros.year !== undefined) {
        selected.querySelector('span').textContent = String(filtros.year);
        selected.setAttribute('data-value', String(filtros.year));
      } else {
        selected.querySelector('span').textContent = 'Todos los años';
        selected.setAttribute('data-value', '');
      }
    }
    actualizarIndicadoresFiltrosActivos();
  }

  function configurarDropdowns() {
    generarOpcionesAnio();

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');

    if (monthFilter) {
      const monthSelected = monthFilter.querySelector('.custom-dropdown-selected');
      if (monthSelected) {
        if (filtros.month !== null && filtros.month >= 0 && filtros.month <= 11) {
          monthSelected.querySelector('span').textContent = meses[filtros.month];
          monthSelected.setAttribute('data-value', String(filtros.month));
        } else {
          monthSelected.querySelector('span').textContent = 'Todos los meses';
          monthSelected.setAttribute('data-value', '');
        }
      }
      const monthOptions = monthFilter.querySelectorAll('.custom-dropdown-option');
      monthOptions.forEach(opt => {
        const val = opt.getAttribute('data-value');
        const isSelected = filtros.month !== null && val === String(filtros.month);
        opt.classList.toggle('selected', isSelected);
        opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }

    const configurarUnDropdown = (dropdownEl, tipoFiltro) => {
      if (!dropdownEl) return;
      const selected = dropdownEl.querySelector('.custom-dropdown-selected');
      const options = dropdownEl.querySelectorAll('.custom-dropdown-option');
      if (!selected) return;

      dropdownEl.setAttribute('role', 'listbox');
      selected.setAttribute('role', 'button');
      selected.setAttribute('aria-haspopup', 'listbox');
      selected.setAttribute('aria-expanded', 'false');

      options.forEach(opt => {
        opt.setAttribute('role', 'option');
        opt.setAttribute('aria-selected', opt.classList.contains('selected') ? 'true' : 'false');
      });

      selected.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!dropdownEl.classList.contains('open')) {
          document.querySelectorAll('.custom-dropdown.open').forEach(d => {
            d.classList.remove('open');
            d.querySelector('.custom-dropdown-selected')?.setAttribute('aria-expanded', 'false');
          });
        }
        const open = dropdownEl.classList.toggle('open');
        selected.setAttribute('aria-expanded', open ? 'true' : 'false');
      });

      options.forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const value = option.getAttribute('data-value') || '';
          const text = option.textContent.trim();
          const isAlreadySelected = option.classList.contains('selected');

          if (isAlreadySelected) {
            option.classList.remove('selected');
            option.setAttribute('aria-selected', 'false');
            const defaultText = tipoFiltro === 'year' ? 'Todos los años' : (tipoFiltro === 'month' ? 'Todos los meses' : 'Todas las categorías');
            selected.querySelector('span').textContent = defaultText;
            selected.setAttribute('data-value', '');
            if (tipoFiltro === 'year') {
              filtros.year = null;
              guardarFiltrosPersistidos({ year: null });
            } else if (tipoFiltro === 'month') {
              filtros.month = null;
              guardarFiltrosPersistidos({ month: null });
            } else if (tipoFiltro === 'category') {
              filtros.category = null;
              guardarFiltrosPersistidos({ category: null });
            }
          } else {
            selected.querySelector('span').textContent = text;
            selected.setAttribute('data-value', value);

            options.forEach(opt => {
              opt.classList.remove('selected');
              opt.setAttribute('aria-selected', 'false');
            });
            option.classList.add('selected');
            option.setAttribute('aria-selected', 'true');

            if (tipoFiltro === 'year') {
              filtros.year = value !== '' ? String(value) : null;
              guardarFiltrosPersistidos({ year: filtros.year ? parseInt(filtros.year, 10) : null });
            } else if (tipoFiltro === 'month') {
              filtros.month = value !== '' ? parseInt(value, 10) : null;
              guardarFiltrosPersistidos({ month: filtros.month });
            }
          }

          actualizarIndicadoresFiltrosActivos();
          aplicarFiltros();
          dropdownEl.classList.remove('open');
          selected.setAttribute('aria-expanded', 'false');
        });
      });
    };

    if (yearFilter) configurarUnDropdown(yearFilter, 'year');
    if (monthFilter) configurarUnDropdown(monthFilter, 'month');

    actualizarIndicadoresFiltrosActivos();

    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        d.classList.remove('open');
        d.querySelector('.custom-dropdown-selected')?.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function obtenerPresupuestosFiltrados() {
    return getBudgets().filter(budget => {
      if (filtros.year) {
        const startDate = new Date(budget.startDate);
        if (startDate.getFullYear() !== parseInt(filtros.year, 10)) {
          return false;
        }
      }

      if (filtros.month !== null) {
        const startDate = new Date(budget.startDate);
        if (startDate.getMonth() !== filtros.month) {
          return false;
        }
      }

      return true;
    });
  }

  const PresupuestosFilters = {
    init,
    cargarFiltrosPersistidos,
    guardarFiltrosPersistidos,
    getFiltros,
    setFiltros,
    actualizarIndicadoresFiltrosActivos,
    limpiarFiltros,
    aplicarFiltros,
    configurarDropdowns,
    generarOpcionesAnio,
    obtenerPresupuestosFiltrados
  };

  if (typeof window !== 'undefined') window.PresupuestosFilters = PresupuestosFilters;
  if (typeof globalThis !== 'undefined') globalThis.PresupuestosFilters = PresupuestosFilters;

  return PresupuestosFilters;
});

