// @fileoverview Módulo de gestión y aplicación de filtros para Categorías.

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoriasFilters = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const STORAGE_FILTROS_KEY = 'finanzapp:filters:categorias:v1';

  // Carga los filtros persistidos desde localStorage.
  function cargarFiltrosPersistidos() {
    if (typeof window !== 'undefined' && window.Core?.helpers?.loadSharedFilters) {
      return window.Core.helpers.loadSharedFilters('categorias');
    }
    try {
      if (typeof localStorage === 'undefined') return { year: null, month: null, searchTerm: '' };
      const raw = localStorage.getItem(STORAGE_FILTROS_KEY);
      if (!raw) return { year: null, month: null, searchTerm: '' };
      const parsed = JSON.parse(raw);
      const yr = (parsed.year !== null && parsed.year !== undefined && parsed.year !== '') ? parseInt(parsed.year, 10) : null;
      const mo = (parsed.month !== null && parsed.month !== undefined && parsed.month !== '') ? parseInt(parsed.month, 10) : null;
      return {
        year: (yr !== null && !isNaN(yr)) ? yr : null,
        month: (mo !== null && !isNaN(mo) && mo >= 0 && mo <= 11) ? mo : null,
        searchTerm: typeof parsed.searchTerm === 'string' ? parsed.searchTerm : ''
      };
    } catch {
      return { year: null, month: null, searchTerm: '' };
    }
  }

  // Guarda los filtros actuales en localStorage.
  function guardarFiltrosPersistidos(filtros) {
    if (typeof window !== 'undefined' && window.Core?.helpers?.saveSharedFilters) {
      window.Core.helpers.saveSharedFilters(filtros, 'categorias');
      return;
    }
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_FILTROS_KEY, JSON.stringify({
        year: filtros.year !== undefined ? filtros.year : null,
        month: filtros.month !== undefined ? filtros.month : null,
        searchTerm: filtros.searchTerm || ''
      }));
    } catch {}
  }

  // Carga el estado de ordenamiento persistido para fecha y monto.
  function cargarSortPersistido() {
    try {
      if (typeof localStorage === 'undefined') return { sortFecha: {}, sortMonto: {} };
      const sf = JSON.parse(localStorage.getItem('sort_fecha') || '{}');
      const sm = JSON.parse(localStorage.getItem('sort_monto') || '{}');
      return { sortFecha: sf, sortMonto: sm };
    } catch {
      return { sortFecha: {}, sortMonto: {} };
    }
  }

  // Guarda el ordenamiento de categorías en localStorage.
  function guardarSortPersistido(sortFecha, sortMonto) {
    try {
      if (typeof localStorage === 'undefined') return;
      const sfObj = sortFecha instanceof Map ? Object.fromEntries(sortFecha) : (sortFecha || {});
      const smObj = sortMonto instanceof Map ? Object.fromEntries(sortMonto) : (sortMonto || {});
      localStorage.setItem('sort_fecha', JSON.stringify(sfObj));
      localStorage.setItem('sort_monto', JSON.stringify(smObj));
    } catch {}
  }

  // Actualiza los estilos visuales de los filtros en la interfaz de usuario.
  function actualizarIndicadorFiltros(filtros) {
    if (typeof document === 'undefined') return;
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    const clearBtn = document.getElementById('clearFiltersBtn');
    const hayAnio = filtros.year !== null;
    const hayMes = filtros.month !== null;
    const hayBusqueda = !!(filtros.searchTerm && filtros.searchTerm.trim());

    if (yearFilter) yearFilter.classList.toggle('filter-active', hayAnio);
    if (monthFilter) monthFilter.classList.toggle('filter-active', hayMes);
    if (clearBtn) clearBtn.classList.toggle('filter-active', hayAnio || hayMes || hayBusqueda);
  }

  // Genera las opciones del dropdown de año.
  function generarOpcionesAnio(filtros) {
    if (typeof document === 'undefined') return;
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) return;

    const currentYear = new Date().getFullYear();
    const startYear = 2025;
    const optionsContainer = yearFilter.querySelector('.custom-dropdown-options');

    if (!optionsContainer) return;
    optionsContainer.innerHTML = '';

    const allOption = document.createElement('div');
    const isAllSelected = filtros.year === null || filtros.year === '';
    allOption.className = `custom-dropdown-option ${isAllSelected ? 'selected' : ''}`;
    allOption.setAttribute('data-value', '');
    allOption.textContent = 'Todos los años';
    optionsContainer.appendChild(allOption);
    const endYear = Math.max(startYear, currentYear);
    for (let year = startYear; year <= endYear; year++) {
      const option = document.createElement('div');
      const isSelected = filtros.year === year;
      option.className = `custom-dropdown-option ${isSelected ? 'selected' : ''}`;
      option.setAttribute('data-value', String(year));
      option.textContent = String(year);
      optionsContainer.appendChild(option);
    }

    const selectedElement = yearFilter.querySelector('.custom-dropdown-selected');
    if (selectedElement) {
      if (filtros.year !== null) {
        selectedElement.querySelector('span').textContent = String(filtros.year);
        selectedElement.setAttribute('data-value', String(filtros.year));
      } else {
        selectedElement.querySelector('span').textContent = 'Todos los años';
        selectedElement.setAttribute('data-value', '');
      }
    }
    actualizarIndicadorFiltros(filtros);
  }

  // Genera una clave única de caché para un estado de filtros.
  function claveFiltros(f) {
    return `${f?.year ?? ''}|${f?.month ?? ''}|${(f?.searchTerm || '').trim().toLowerCase()}`;
  }

  // Filtra un arreglo de transacciones según año, mes y término de búsqueda.
  function filtrarTransaccionesPorFecha(transactions, filtros, formatCurrencyFn) {
    if (!transactions || !Array.isArray(transactions)) return [];
    if (!filtros) return transactions;

    const formatFn = formatCurrencyFn || (typeof window !== 'undefined' && window.Core?.helpers?.formatCurrency) || ((n) => `$${Number(n).toFixed(2)}`);

    return transactions.filter(transaction => {
      const transactionDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);

      if (filtros.year !== null && transactionDate.getFullYear() !== filtros.year) {
        return false;
      }

      if (filtros.month !== null && transactionDate.getMonth() !== filtros.month) {
        return false;
      }

      if (filtros.searchTerm && filtros.searchTerm.trim() !== '') {
        const searchTerm = filtros.searchTerm.toLowerCase().trim();
        const description = (transaction.description || '').toLowerCase();

        const amount = formatFn(Math.abs(transaction.amount));
        const amountWithComma = amount.replace('.', ',');

        const searchTermClean = searchTerm.replace(/[$,]/g, '');
        const isNumericSearch = !isNaN(parseFloat(searchTermClean)) && isFinite(parseFloat(searchTermClean));

        let matchesAmount = false;
        if (isNumericSearch) {
          const searchAmount = parseFloat(searchTermClean);
          matchesAmount = Math.abs(Math.abs(transaction.amount) - searchAmount) < 0.01;
        }

        const textMatchesAmount = amount.includes(searchTermClean) ||
          amountWithComma.includes(searchTermClean) ||
          amount.toLowerCase().includes(searchTerm) ||
          amount.replace(/[$,]/g, '').toLowerCase().includes(searchTermClean);

        matchesAmount = matchesAmount || textMatchesAmount;

        const typeText = transaction.type === 'income' ? 'ingreso' : 'gasto';
        const matchesType = typeText.includes(searchTerm);

        if (!description.includes(searchTerm) && !matchesAmount && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }

  // Aplica los filtros actuales a todas las categorías dadas.
  function aplicarFiltrosACategorias(categories, filtros, formatCurrencyFn) {
    if (!Array.isArray(categories)) return [];
    return categories.map(category => ({
      ...category,
      transactions: filtrarTransaccionesPorFecha(category.transactions, filtros, formatCurrencyFn)
    }));
  }

  // Configura los listeners de los dropdowns de año y mes con ARIA.
  function configurarListenersFiltros(filtros, onFilterChange) {
    if (typeof document === 'undefined') return;
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

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

    const manejarSeleccionOpcion = (tipoFiltro, value) => {
      if (tipoFiltro === 'year') {
        filtros.year = value === '' ? null : parseInt(value, 10);
      } else if (tipoFiltro === 'month') {
        filtros.month = value === '' ? null : parseInt(value, 10);
      }
      guardarFiltrosPersistidos(filtros);
      actualizarIndicadorFiltros(filtros);
      if (typeof onFilterChange === 'function') onFilterChange(filtros);
    };

    const configurarDropdown = (dropdownEl, tipoFiltro) => {
      const selected = dropdownEl.querySelector('.custom-dropdown-selected');
      const options = dropdownEl.querySelectorAll('.custom-dropdown-option');
      if (!selected) return;

      dropdownEl.setAttribute('role', 'listbox');
      selected.setAttribute('role', 'button');
      selected.setAttribute('aria-haspopup', 'listbox');
      selected.setAttribute('aria-expanded', 'false');
      options.forEach((opt, idx) => {
        opt.setAttribute('role', 'option');
        opt.setAttribute('aria-selected', (idx === 0 && opt.classList.contains('selected')) ? 'true' : (opt.classList.contains('selected') ? 'true' : 'false'));
      });

      selected.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!dropdownEl.classList.contains('open')) {
          document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
        }
        const open = dropdownEl.classList.toggle('open');
        selected.setAttribute('aria-expanded', open ? 'true' : 'false');
      });

      options.forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const isAlreadySelected = option.classList.contains('selected');
          if (isAlreadySelected) {
            option.classList.remove('selected');
            option.setAttribute('aria-selected', 'false');
            const defaultText = tipoFiltro === 'year' ? 'Todos los años' : 'Todos los meses';
            selected.querySelector('span').textContent = defaultText;
            selected.setAttribute('data-value', '');
            manejarSeleccionOpcion(tipoFiltro, '');
          } else {
            const value = option.getAttribute('data-value');
            const text = option.textContent;

            selected.querySelector('span').textContent = text;
            selected.setAttribute('data-value', value);

            options.forEach(opt => {
              opt.classList.remove('selected');
              opt.setAttribute('aria-selected', 'false');
            });
            option.classList.add('selected');
            option.setAttribute('aria-selected', 'true');

            manejarSeleccionOpcion(tipoFiltro, value);
          }
          dropdownEl.classList.remove('open');
          selected.setAttribute('aria-expanded', 'false');
        });
      });
    };

    if (yearFilter) configurarDropdown(yearFilter, 'year');
    if (monthFilter) configurarDropdown(monthFilter, 'month');

    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        d.classList.remove('open');
        const sel = d.querySelector('.custom-dropdown-selected');
        if (sel) sel.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Configura los controles de búsqueda y limpieza de filtros
  function configurarControlesFiltrosYBusqueda(filtros, onFilterChange) {
    if (typeof document === 'undefined') return;
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    if (searchInput && filtros.searchTerm) {
      searchInput.value = filtros.searchTerm;
      if (clearSearchBtn) clearSearchBtn.style.display = 'block';
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        const hadActiveFilters = filtros.year !== null || filtros.month !== null || !!(filtros.searchTerm && filtros.searchTerm.trim());

        filtros.year = null;
        filtros.month = null;
        filtros.searchTerm = '';
        guardarFiltrosPersistidos(filtros);

        const yearDropdown = document.getElementById('yearFilter');
        if (yearDropdown) {
          const selected = yearDropdown.querySelector('.custom-dropdown-selected');
          const optionItems = yearDropdown.querySelectorAll('.custom-dropdown-option');
          if (selected) {
            selected.querySelector('span').textContent = 'Todos los años';
            selected.setAttribute('data-value', '');
          }
          optionItems.forEach(opt => {
            opt.classList.remove('selected');
            opt.setAttribute('aria-selected', 'false');
          });
        }

        const monthDropdown = document.getElementById('monthFilter');
        if (monthDropdown) {
          const monthSelected = monthDropdown.querySelector('.custom-dropdown-selected');
          const monthOptions = monthDropdown.querySelectorAll('.custom-dropdown-option');
          if (monthSelected) {
            monthSelected.querySelector('span').textContent = 'Todos los meses';
            monthSelected.setAttribute('data-value', '');
          }
          monthOptions.forEach(opt => {
            opt.classList.remove('selected');
            opt.setAttribute('aria-selected', 'false');
          });
        }

        if (searchInput) searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        actualizarIndicadorFiltros(filtros);
        if (typeof onFilterChange === 'function') onFilterChange();

        if (window.Toast) {
          if (hadActiveFilters) window.Toast.success('Filtros limpiados');
          else window.Toast.info('No hay filtros activos');
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filtros.searchTerm = e.target.value;
        guardarFiltrosPersistidos(filtros);
        if (clearSearchBtn) {
          clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
        }
        actualizarIndicadorFiltros(filtros);
        if (typeof onFilterChange === 'function') onFilterChange();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        filtros.searchTerm = '';
        guardarFiltrosPersistidos(filtros);
        if (searchInput) searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        actualizarIndicadorFiltros(filtros);
        if (typeof onFilterChange === 'function') onFilterChange();
      });
    }
  }

  const CategoriasFilters = {
    STORAGE_FILTROS_KEY,
    cargarFiltrosPersistidos,
    guardarFiltrosPersistidos,
    cargarSortPersistido,
    guardarSortPersistido,
    actualizarIndicadorFiltros,
    generarOpcionesAnio,
    claveFiltros,
    filtrarTransaccionesPorFecha,
    aplicarFiltrosACategorias,
    configurarListenersFiltros,
    configurarControlesFiltrosYBusqueda
  };

  if (typeof window !== 'undefined') window.CategoriasFilters = CategoriasFilters;
  if (typeof globalThis !== 'undefined') globalThis.CategoriasFilters = CategoriasFilters;

  return CategoriasFilters;
});

