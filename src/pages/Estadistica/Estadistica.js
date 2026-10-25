/**
 * @fileoverview Página de Estadísticas de FinanzApp.
 *
 * Muestra análisis visual de ingresos y gastos mediante gráficos y métricas
 * resumen. Incluye filtros por periodo, soporte de exportación y
 * actualización reactiva ante cambios de datos en tiempo real.
 *
 * @module Estadistica
 */
(function(){
if (typeof window !== 'undefined' && window.sidebarRenderer) {
  window.sidebarRenderer.render('estadistica');
}

// Actualizar perfil del invitado si tiene el formato antiguo
if (typeof window !== 'undefined' && window.AuthService) {
  window.AuthService.normalizeGuestProfile();
}

function getCurrencyMeta() {
  if (window.Core?.helpers?.getCurrencyMeta) {
    return window.Core.helpers.getCurrencyMeta();
  }

  return { locale: 'en-US', symbol: '$', currency: 'USD' };
}

const APP_CURRENCY = getCurrencyMeta();

function formatCurrencyCard(amount) {
  if (window.Core?.helpers?.formatCurrency) {
    return window.Core.helpers.formatCurrency(amount);
  }

  const n = Number(amount) || 0;
  return new Intl.NumberFormat(APP_CURRENCY.locale || 'en-US', {
    style: 'currency',
    currency: APP_CURRENCY.currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}



const CHART_CURRENCY_FORMATTER = new Intl.NumberFormat(APP_CURRENCY.locale || 'en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const CHART_CURRENCY_DETAILED = new Intl.NumberFormat(APP_CURRENCY.locale || 'en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const CHART_PERCENT_FORMATTER = new Intl.NumberFormat(APP_CURRENCY.locale || 'en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

function getThemeColor(variableName, fallback) {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
    return value?.trim() || fallback;
  } catch (error) {
    return fallback;
  }
}

function colorWithAlpha(color, alpha = 1) {
  if (!color) return `rgba(255, 255, 255, ${alpha})`;
  const value = color.trim();
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map(part => Number(part.trim()));
    const [r = 255, g = 255, b = 255] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return value;
}
  const { esc } = window.Core.helpers;
  const { createFirestoreStore } = window.Core.storeFactories;
  const store = createFirestoreStore();

  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  let state = { categories: [], monthlyData: { labels: MONTHS, income: Array(12).fill(0), expenses: Array(12).fill(0) }, user: { name: 'Usuario', email: '' } };

  function obtenerRangoAnios() {
    const now = new Date().getFullYear();
    const start = 2025;
    return { start, end: Math.max(now, start) };
  }

  function crearDatosPrueba() {
    return {
      categories: [
        {
          id: "test_salary",
          name: "Salario",
          fixedType: "income",
          transactions: [
            {
              id: "tx_001",
              type: "income",
              amount: 45000,
              description: "Salario enero",
              date: "2025-01-15T00:00:00.000Z"
            },
            {
              id: "tx_002",
              type: "income",
              amount: 45000,
              description: "Salario febrero",
              date: "2025-02-15T00:00:00.000Z"
            }
          ]
        },
        {
          id: "test_food",
          name: "Comida",
          fixedType: "expense",
          transactions: [
            {
              id: "tx_003",
              type: "expense",
              amount: 15000,
              description: "Supermercado",
              date: "2025-01-10T00:00:00.000Z"
            },
            {
              id: "tx_004",
              type: "expense",
              amount: 12000,
              description: "Restaurante",
              date: "2025-01-15T00:00:00.000Z"
            }
          ]
        },
        {
          id: "test_transport",
          name: "Transporte",
          fixedType: "expense",
          transactions: [
            {
              id: "tx_005",
              type: "expense",
              amount: 8000,
              description: "Gasolina",
              date: "2025-01-12T00:00:00.000Z"
            }
          ]
        }
      ]
    };
  }

  

  async function cargarDatos() {
    const saved = await store.load();

    if (saved && saved.categories && saved.categories.length > 0) {
      state = {
        categories: saved.categories || [],
        monthlyData: saved.monthlyData || { 
          labels: MONTHS, 
          income: Array(12).fill(0), 
          expenses: Array(12).fill(0) 
        },
        user: saved.user || { name: 'Usuario', email: '' }
      };
      
      state.categories = (state.categories||[]).map(c => ({
        ...c,
        transactions: (c.transactions||[]).map(t => ({
          ...t, 
          date: (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date
        }))
      }));

      // Re-vincular transacciones planas si vienen en saved.transactions
      if (Array.isArray(saved.transactions) && saved.transactions.length > 0) {
        saved.transactions.forEach(t => {
          const tDate = (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date;
          const cat = state.categories.find(c => String(c.id) === String(t.categoryId));
          if (cat) {
            if (!cat.transactions) cat.transactions = [];
            const exists = cat.transactions.some(ct => String(ct.id) === String(t.id));
            if (!exists) {
              cat.transactions.push({ ...t, date: tDate });
            }
          }
        });
      }
      
    } else {
      state = { 
        categories: [], 
        monthlyData: { 
          labels: MONTHS, 
          income: Array(12).fill(0), 
          expenses: Array(12).fill(0) 
        }, 
        user: { name: 'Usuario', email: '' } 
      };
    }
  }

  function aplicarConfiguracionTema() {
    if (window.EstadisticaCharts?.aplicarConfiguracionTema) {
      window.EstadisticaCharts.aplicarConfiguracionTema();
    }
  }

  function mostrarEsqueletos() {
    document.querySelectorAll('.stats-summary-cards, .stats-insights, .charts-grid').forEach(el => {
      el.classList.remove('loaded');
    });

    ['sumIncome', 'sumExpenses', 'sumBalance', 'txCount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('skeleton', 'skeleton-value');
        el.textContent = '';
      }
    });

    ['avgIncome', 'avgExpenses', 'avgBalance', 'avgTicket'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('skeleton', 'skeleton-full');
        el.textContent = '';
      }
    });

    document.querySelectorAll('.chart-container').forEach(container => {
      container.classList.add('chart-loading');
    });

    document.querySelectorAll('.stats-insights .card-value').forEach(el => {
      el.classList.add('skeleton', 'skeleton-value');
      el.textContent = '';
    });
    document.querySelectorAll('.stats-insights .card-change').forEach(el => {
      el.classList.add('skeleton', 'skeleton-full');
      el.textContent = '';
    });

  }

  function ocultarEsqueletos() {
    document.querySelectorAll('.skeleton').forEach(el => {
      el.classList.remove('skeleton', 'skeleton-value', 'skeleton-text', 'skeleton-insight');
    });

    document.querySelectorAll('.chart-container').forEach(container => {
      container.classList.remove('chart-loading');
    });

    setTimeout(() => {
      document.querySelectorAll('.stats-summary-cards, .stats-insights, .charts-grid').forEach(el => {
        el.classList.add('loaded');
      });
    }, 50);
  }

  function poblarPerfilSidebar() {
    if (window.ProfileSync?.syncProfile) {
      window.ProfileSync.syncProfile();
    }
  }

  function inicializarTooltipPerfil() {
    if (window.ProfileSync?.initProfileTooltip) {
      window.ProfileSync.initProfileTooltip();
    }
  }

  function configurarEventosComunes() {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) logoutButton.addEventListener('click', async () => {
      const confirmed = await (typeof window.showAlert === 'function'
        ? window.showAlert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', { variant: 'confirm', emphasis: 'danger' })
        : Promise.resolve(window.confirm('¿Estás seguro de que deseas cerrar sesión?') ? 'confirm' : 'cancel'));
      if (confirmed !== 'confirm') return;
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('authUser');
      window.location.href = '/pages/Login/Login.html';
    });

    const btn = document.getElementById('themeToggle');
    const root = document.documentElement;
    const body = document.body;
    
    const apply = (t) => {
      const theme = t === 'light' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      if (body) body.setAttribute('data-theme', theme);
      root.style.backgroundColor = theme === 'light' ? '#f5efea' : '#191724';
      if (body) body.style.backgroundColor = theme === 'light' ? '#f5efea' : '#191724';

      localStorage.setItem('theme', theme);
      try {
        const rawSettings = localStorage.getItem('finanzapp:settings:v1');
        const settings = rawSettings ? JSON.parse(rawSettings) : {};
        settings.theme = theme;
        localStorage.setItem('finanzapp:settings:v1', JSON.stringify(settings));
        if (window.FirestoreDB && typeof window.FirestoreDB.saveSettings === 'function' && window.FirestoreDB.currentUserId) {
          window.FirestoreDB.saveSettings(settings).catch(() => {});
        }
      } catch (e) {}
      
      const icon = btn?.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
        window.LucideHelper?.refresh(btn);
      }
      
      renderizarTodo();
    };
    
    let stored = localStorage.getItem('theme');
    if (!stored) {
      try {
        const s = localStorage.getItem('finanzapp:settings:v1');
        if (s) {
          const p = JSON.parse(s);
          if (p && p.theme) stored = p.theme;
        }
      } catch (e) {}
    }
    apply(stored === 'light' ? 'light' : 'dark');
    
    if (btn) {
      btn.addEventListener('click', () => {
        const current = root.getAttribute('data-theme') || localStorage.getItem('theme') || 'dark';
        apply(current === 'light' ? 'dark' : 'light');
      });
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'theme' && e.newValue) {
        apply(e.newValue);
      }
    });
  }


  const STORAGE_FILTROS_KEY = 'finanzapp:filters:estadistica:v1';

  function cargarFiltrosPersistidos() {
    try {
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
      const current = cargarFiltrosPersistidos();
      localStorage.setItem(STORAGE_FILTROS_KEY, JSON.stringify({
        year: novosFiltros.year !== undefined ? novosFiltros.year : current.year,
        month: novosFiltros.month !== undefined ? novosFiltros.month : current.month,
        searchTerm: novosFiltros.searchTerm !== undefined ? novosFiltros.searchTerm : current.searchTerm,
        category: novosFiltros.category !== undefined ? novosFiltros.category : current.category
      }));
    } catch {}
  }

  function generarOpcionesAnio(){
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) return;
    const optionsContainer = yearFilter.querySelector('.custom-dropdown-options');
    if (!optionsContainer) return;
    optionsContainer.innerHTML = '';

    const shared = cargarFiltrosPersistidos();

    const { start, end } = obtenerRangoAnios();

    const allOpt = document.createElement('div');
    const isAllSelected = shared.year === null || shared.year === '' || shared.year === undefined;
    allOpt.className = `custom-dropdown-option ${isAllSelected ? 'selected' : ''}`;
    allOpt.setAttribute('data-value', '');
    allOpt.textContent = 'Todos los años';
    optionsContainer.appendChild(allOpt);

    for (let y = start; y <= end; y++){
      const isSelected = shared.year === y;
      const opt = document.createElement('div');
      opt.className = `custom-dropdown-option ${isSelected ? 'selected' : ''}`;
      opt.setAttribute('data-value', String(y));
      opt.textContent = String(y);
      optionsContainer.appendChild(opt);
    }
    const selected = yearFilter.querySelector('.custom-dropdown-selected');
    if (selected){
      if (shared.year !== null) {
        selected.querySelector('span').textContent = String(shared.year);
        selected.setAttribute('data-value', String(shared.year));
      } else {
        selected.querySelector('span').textContent = 'Todos los años';
        selected.setAttribute('data-value', '');
      }
    }
  }

  function obtenerFiltros() {
    const ySel = document.getElementById('yearFilter')?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
    const mSel = document.getElementById('monthFilter')?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
    return { year: ySel===''?null:parseInt(ySel,10), month: mSel===''?null:parseInt(mSel,10) };
  }

  function filtrarTransacciones() {
    const { year, month } = obtenerFiltros();
    const tx = [];
    state.categories.forEach(c => {
      const catTx = c.transactions || [];
      catTx.forEach(t => {
        const d = t.date instanceof Date ? t.date : new Date(t.date);
        if (Number.isNaN(d.getTime())) {
          return;
        }
        if (year != null && d.getFullYear() !== year) return;
        if (month != null && d.getMonth() !== month) return;
        tx.push({ ...t, category: c.name });
      });
    });
    return tx;
  }

  function calcularMensual(tx) {
    return window.EstadisticaKPIs ? window.EstadisticaKPIs.calcularMensual(tx) : { inc: Array(12).fill(0), exp: Array(12).fill(0) };
  }

  function calcularAcumulado(inc, exp) {
    return window.EstadisticaKPIs ? window.EstadisticaKPIs.calcularAcumulado(inc, exp) : [];
  }

  function calcularDivisionCategorias(tx) {
    return window.EstadisticaKPIs ? window.EstadisticaKPIs.calcularDivisionCategorias(tx) : { expenses: [], income: [] };
  }

  function renderizarResumen(tx) {
    if (window.EstadisticaKPIs) {
      window.EstadisticaKPIs.renderizarResumen(tx, formatCurrencyCard);
    }
  }

  function calcularEstadisticasDiarias(allTx) {
    return window.EstadisticaKPIs ? window.EstadisticaKPIs.calcularEstadisticasDiarias(allTx) : { incomeToday: 0, expensesToday: 0, avgDaily: 0 };
  }

  function renderizarKPIsDiarios(allTx) {
    if (window.EstadisticaKPIs) {
      window.EstadisticaKPIs.renderizarKPIsDiarios(allTx, formatCurrencyCard);
    }
  }

  function actualizarInsights(info) {
    if (window.EstadisticaKPIs) {
      window.EstadisticaKPIs.actualizarInsights(info, formatCurrencyCard);
    }
  }

  function destruirGraficos() {
    if (window.EstadisticaCharts) {
      window.EstadisticaCharts.destruirGraficos();
    }
  }

  function renderizarGraficos(tx) {
    if (window.EstadisticaCharts) {
      window.EstadisticaCharts.renderizarGraficos(tx, {
        formatCurrency: formatCurrencyCard,
        appCurrency: APP_CURRENCY,
        kpis: window.EstadisticaKPIs
      });
    }
  }

  function exportarCsv(tx){
    const f = obtenerFiltros();
    const meta = [`Generado`, new Date().toISOString(), `Año`, f.year==null? 'Todos': String(f.year), `Mes`, f.month==null? 'Todos': String(f.month+1)];
    const rows = [meta, [], ['Tipo','Monto','Descripción','Fecha','Categoría']];
    tx.forEach(t => rows.push([
      t.type==='income'?'Ingreso':'Gasto',
      String(t.amount),
      (t.description||'').replace(/\n/g,' '),
      (t.date instanceof Date ? t.date : new Date(t.date)).toISOString(),
      t.category
    ]));
    const csv = rows.map(r => r.map(v => /[",\n]/.test(v) ? '"'+String(v).replace(/"/g,'""')+'"' : v).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finanzapp-estadisticas-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
  }

  

  function mostrarToast(message, options = {}) {
    if (window.__appTooltips === false) return null;
    const variant = typeof options === 'string' ? options : (options?.variant || 'info');
    const duration = typeof options === 'object' && options?.duration ? options.duration : 3000;
    if (window.Toast) return window.Toast.show(message, variant, duration);
  }

  function mostrarExito(mensaje, options = {}) {
    return mostrarToast(mensaje, { variant: 'success', duration: 3000, ...(options || {}) });
  }

  function mostrarInfo(mensaje, options = {}) {
    return mostrarToast(mensaje, { variant: 'info', duration: 3000, ...(options || {}) });
  }

  function configurarDropdown(dropdownEl, onChange){
    const selected = dropdownEl.querySelector('.custom-dropdown-selected');
    const options = dropdownEl.querySelectorAll('.custom-dropdown-option');

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
        const isAlreadySelected = option.classList.contains('selected');
        if (isAlreadySelected) {
          option.classList.remove('selected');
          option.setAttribute('aria-selected', 'false');
          const isYear = dropdownEl.id === 'yearFilter';
          const defaultText = isYear ? 'Todos los años' : 'Todos los meses';
          selected.querySelector('span').textContent = defaultText;
          selected.setAttribute('data-value', '');
        } else {
          const value = option.getAttribute('data-value');
          const text = option.textContent;
          selected.querySelector('span').textContent = text;
          selected.setAttribute('data-value', value);
          dropdownEl.querySelectorAll('.custom-dropdown-option').forEach(o => { o.classList.remove('selected'); o.setAttribute('aria-selected','false'); });
          option.classList.add('selected');
          option.setAttribute('aria-selected','true');
        }
        dropdownEl.classList.remove('open');
        selected.setAttribute('aria-expanded', 'false');
        if (onChange) onChange();
      });
    });
  }

  function configurarUI(){
    const yearDD = document.getElementById('yearFilter');
    const monthDD = document.getElementById('monthFilter');
    generarOpcionesAnio();
    
    const shared = cargarFiltrosPersistidos();
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const mSel = monthDD?.querySelector('.custom-dropdown-selected');
    if (mSel) { 
      if (shared.month !== null && shared.month >= 0 && shared.month <= 11) {
        mSel.setAttribute('data-value', String(shared.month));
        mSel.querySelector('span').textContent = meses[shared.month];
      } else {
        mSel.setAttribute('data-value', '');
        mSel.querySelector('span').textContent = 'Todos los meses';
      }
    }

    monthDD?.querySelectorAll('.custom-dropdown-option').forEach(o => {
      const val = o.getAttribute('data-value');
      const isSelected = shared.month !== null && val === String(shared.month);
      o.classList.toggle('selected', isSelected);
      o.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
    
    function actualizarIndicadoresFiltrosActivos() {
      const yVal = yearDD?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
      const mVal = monthDD?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
      const hayAnio = yVal !== '' && yVal !== null;
      const hayMes = mVal !== '' && mVal !== null;

      if (yearDD) yearDD.classList.toggle('filter-active', hayAnio);
      if (monthDD) monthDD.classList.toggle('filter-active', hayMes);
      if (clearBtn) clearBtn.classList.toggle('filter-active', hayAnio || hayMes);
    }

    if (yearDD) configurarDropdown(yearDD, () => {
      const yVal = yearDD.querySelector('.custom-dropdown-selected')?.getAttribute('data-value');
      guardarFiltrosPersistidos({ year: yVal !== '' && yVal !== null ? parseInt(yVal, 10) : null });
      actualizarIndicadoresFiltrosActivos();
      renderizarTodo();
    });
    if (monthDD) configurarDropdown(monthDD, () => {
      const mVal = monthDD.querySelector('.custom-dropdown-selected')?.getAttribute('data-value');
      guardarFiltrosPersistidos({ month: mVal !== '' && mVal !== null ? parseInt(mVal, 10) : null });
      actualizarIndicadoresFiltrosActivos();
      renderizarTodo();
    });

    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      guardarFiltrosPersistidos({ year: null, month: null });
      const ySel = yearDD?.querySelector('.custom-dropdown-selected');
      const mSel = monthDD?.querySelector('.custom-dropdown-selected');
      if (ySel) { ySel.setAttribute('data-value', ''); ySel.querySelector('span').textContent = 'Todos los años'; }
      if (mSel) { mSel.setAttribute('data-value', ''); mSel.querySelector('span').textContent = 'Todos los meses'; }

      yearDD?.querySelectorAll('.custom-dropdown-option').forEach(o => { 
        o.classList.remove('selected'); 
        o.setAttribute('aria-selected', 'false');
      });
      monthDD?.querySelectorAll('.custom-dropdown-option').forEach(o => { 
        o.classList.remove('selected'); 
        o.setAttribute('aria-selected', 'false');
      });
      actualizarIndicadoresFiltrosActivos();
      renderizarTodo();

      mostrarExito('Filtros limpiados');
    });

    actualizarIndicadoresFiltrosActivos();

    document.addEventListener('click', (e) => {
      if (e.target.closest('.custom-dropdown')) return;
      
      document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        d.classList.remove('open');
        const sel = d.querySelector('.custom-dropdown-selected');
        if (sel) sel.setAttribute('aria-expanded', 'false');
      });
    });

    // Atajos de teclado para filtros (Alt + A, Alt + M, Alt + L)
    document.addEventListener('keydown', (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = (e.key || '').toLowerCase();
        const code = e.code || '';

        if (key === 'a' || code === 'KeyA') {
          const dd = document.getElementById('yearFilter');
          if (dd) { e.preventDefault(); dd.classList.add('open'); dd.querySelector('.custom-dropdown-selected')?.focus?.(); }
          return;
        }
        if (key === 'm' || code === 'KeyM') {
          const dd = document.getElementById('monthFilter');
          if (dd) { e.preventDefault(); dd.classList.add('open'); dd.querySelector('.custom-dropdown-selected')?.focus?.(); }
          return;
        }
        if (key === 'l' || code === 'KeyL') {
          const btn = document.getElementById('clearFiltersBtn');
          if (btn) { e.preventDefault(); btn.click(); }
          return;
        }
      }
    });
  }

  function obtenerTodasLasTransacciones(){
    const all = [];
    state.categories.forEach(c => (c.transactions||[]).forEach(t => all.push(t)));
    return all;
  }

  function renderizarTodo(){
    const tx = filtrarTransacciones();
    
    try {
      renderizarResumen(tx);
    } catch (error) {
      console.error('[Estadistica] Error en renderizarResumen:', error);
    }
    
    try {
      renderizarKPIsDiarios(obtenerTodasLasTransacciones());
    } catch (error) {
      console.error('[Estadistica] Error en renderizarKPIsDiarios:', error);
    }
    
    try {
      renderizarGraficos(tx);
    } catch (error) {
      console.error('[Estadistica] Error en renderizarGraficos:', error);
    }

    
    try { window.__statsLastRenderAt = Date.now(); } catch {}
  }

  window.DataEvents = window.DataEvents || { emit(){}, on(){}, off(){} };

  function limpiarTodosLosDatos() {
    try { state.categories = []; } catch {}

    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    safeSet('sumIncome', formatCurrencyCard(0));
    safeSet('sumExpenses', formatCurrencyCard(0));
    safeSet('sumBalance', formatCurrencyCard(0));
    safeSet('txCount', '0');
    safeSet('avgIncome', `Promedio mensual: ${formatCurrencyCard(0)}`);
    safeSet('avgExpenses', `Promedio mensual: ${formatCurrencyCard(0)}`);
    safeSet('avgBalance', `Promedio mensual: ${formatCurrencyCard(0)}`);
    safeSet('avgTicket', `Ticket promedio: ${formatCurrencyCard(0)}`);
    safeSet('dailyIncome', formatCurrencyCard(0));
    safeSet('dailyExpenses', formatCurrencyCard(0));
    safeSet('dailyAverage', formatCurrencyCard(0));

    try {
      destruirGraficos();
    } catch (error) {
    }

    const resetText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    resetText('insightTopCategoryValue', 'Sin datos');
    resetText('insightTopCategoryDetail', 'Aún no hay gastos registrados en este periodo.');
    resetText('insightBestMonthValue', 'Sin datos');
    resetText('insightBestMonthDetail', 'Agrega movimientos para conocer tu mejor mes.');
    resetText('insightSavingsValue', 'Sin datos');
    resetText('insightSavingsDetail', 'Registra ingresos para calcular tu balance neto.');

    const cashflowSummary = document.getElementById('cashflowSummary');
    if (cashflowSummary) {
      cashflowSummary.textContent = '';
      cashflowSummary.style.display = 'none';
    }

    const gaugeLabel = document.getElementById('savingsGaugeLabel');
    if (gaugeLabel) {
      gaugeLabel.textContent = 'Sin datos';
      gaugeLabel.classList.remove('negative');
    }

  }

  /**
   * Controlador de página que extiende BasePage.
   * Centraliza la inicialización de Firebase, la carga de datos
   * y la suscripción a eventos cross-tab y de almacenamiento.
   *
   * @extends {window.BasePage}
   */
  class EstadisticaApp extends window.BasePage {
    /**
     * Punto de entrada tras DOMContentLoaded.
     * Inicializa Firebase, espera autenticación, carga datos y configura la UI.
     *
     * @override
     * @returns {Promise<void>}
     */
    async _init() {
      mostrarEsqueletos();

      // 1. Poblar perfil inmediatamente desde localStorage (sin esperar red)
      poblarPerfilSidebar();
      inicializarTooltipPerfil();

      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
      }

      // 2. Configurar eventos y UI de inmediato (no dependen de datos)
      configurarEventosComunes();
      configurarUI();

      // 3. CARGA OPTIMISTA: mostrar datos del localStorage inmediatamente
      //    sin esperar a Firebase. Esto elimina el delay de 5-8 segundos.
      let renderizadoInicial = false;
      try {
        const userId = (typeof window !== 'undefined' && window.AuthService)
          ? window.AuthService.getUserId()
          : (() => {
              try {
                const authUser = localStorage.getItem('authUser');
                if (authUser && authUser !== 'guest') {
                  const profile = JSON.parse(authUser);
                  return profile.uid || profile.email || 'guest';
                }
              } catch {}
              return 'guest';
            })();
        const LS_PREFIX = 'finanzapp:data:v1';
        const rawCategories = localStorage.getItem(`${LS_PREFIX}:${userId}:categories`);
        const rawTransactions = localStorage.getItem(`${LS_PREFIX}:${userId}:transactions`);

          if (rawCategories) {
            const localData = {
              categories: JSON.parse(rawCategories || '[]'),
              transactions: JSON.parse(rawTransactions || '[]'),
            };

            // Aplicar datos locales al state inmediatamente
            state = {
              categories: (localData.categories || []).map(c => ({
                ...c,
                transactions: (c.transactions || []).map(t => ({
                  ...t,
                  date: (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date
                }))
              })),
              monthlyData: { labels: MONTHS, income: Array(12).fill(0), expenses: Array(12).fill(0) },
              user: { name: profile.name || 'Usuario', email: profile.email || '' }
            };

            // Re-vincular transacciones planas si vienen separadas
            if (Array.isArray(localData.transactions) && localData.transactions.length > 0) {
              localData.transactions.forEach(t => {
                const tDate = (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date;
                const cat = state.categories.find(c => String(c.id) === String(t.categoryId));
                if (cat) {
                  if (!cat.transactions) cat.transactions = [];
                  const exists = cat.transactions.some(ct => String(ct.id) === String(t.id));
                  if (!exists) cat.transactions.push({ ...t, date: tDate });
                }
              });
            }

            // Verificar Chart.js antes del primer render
            let chartJsReady = typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function';
            if (!chartJsReady) {
              let attempts = 0;
              while (!chartJsReady && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 100));
                chartJsReady = typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function';
                attempts++;
              }
            }

            // Asegurar lienzos de gráficos
            const canvasIds = ['chartCashflowArea', 'chartIncomeByCategory', 'chartExpenseByCategory', 'chartIncomeByDay', 'chartHeatmap'];
            document.querySelectorAll('.chart-wrap').forEach((wrap, idx) => {
              const expectedId = canvasIds[idx];
              if (expectedId && !wrap.querySelector(`canvas#${expectedId}`)) {
                wrap.innerHTML = `<canvas id="${expectedId}"></canvas>`;
              }
            });

            // Renderizar con datos locales inmediatamente
            renderizarTodo();
            ocultarEsqueletos();
            renderizadoInicial = true;
          }
      } catch (e) {
        console.warn('[Estadistica] Error en carga optimista local:', e);
      }

      // 4. Inicializar Firebase y sincronizar en background
      //    Si ya renderizamos con datos locales, esto actualiza silenciosamente.
      try {
        const _isGuestEstadistica = (typeof window !== 'undefined' && window.AuthService)
          ? window.AuthService.isGuest()
          : (() => {
              try {
                const raw = localStorage.getItem('authUser');
                if (!raw) return true;
                const u = JSON.parse(raw);
                return u.uid === 'guest' || u.provider === 'guest' || !u.uid;
              } catch { return true; }
            })();

        if (!_isGuestEstadistica && window.firebase) {
          if (window.FirestoreDB) {
            window.FirestoreDB.ensureFirebaseInitialized();
          } else if (!firebase.apps.length) {
            const config = window.FIREBASE_CONFIG;
            if (config) firebase.initializeApp(config);
          }
          await new Promise((resolve) => {
            try {
              const auth = firebase.auth();
              let resolved = false;
              let nullCount = 0;

              // Reducir timeout a 3s (antes era 8s) ya que ya tenemos datos locales
              const fallbackTimer = setTimeout(() => {
                if (!resolved) {
                  console.warn('⏱ Firebase Auth timed out (3s) in Estadistica — usando datos locales');
                  resolved = true;
                  resolve();
                }
              }, 3000);

              auth.onAuthStateChanged(async (currentUser) => {
                if (currentUser) {
                  if (resolved) return;
                  clearTimeout(fallbackTimer);
                  resolved = true;
                  try {
                    const profile = {
                      uid: currentUser.uid,
                      email: currentUser.email || '',
                      name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
                      picture: currentUser.photoURL || currentUser.providerData?.[0]?.photoURL || '',
                      provider: currentUser.providerData?.[0]?.providerId || 'google',
                      emailVerified: currentUser.emailVerified
                    };
                    localStorage.setItem('authUser', JSON.stringify(profile));
                    poblarPerfilSidebar();
                    if (window.FirestoreDB) {
                      await window.FirestoreDB.init(currentUser.uid);
                      window.FirestoreDB.setCurrentUser(currentUser.uid);
                    }
                  } catch (e) {}
                  resolve();
                } else {
                  nullCount++;
                  console.warn(`⚠️ Firebase Auth emitió null en Estadistica (emisión #${nullCount})`);
                }
              });
            } catch (error) {
              resolve();
            }
          });
        }
      } catch (error) {}

      // 5. Verificar Chart.js (si aún no fue verificado en el path optimista)
      if (!renderizadoInicial) {
        let chartJsReady = typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function';
        if (!chartJsReady) {
          let attempts = 0;
          const maxAttempts = 30;
          while (!chartJsReady && attempts < maxAttempts) {
            if (typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function') {
              chartJsReady = true;
            } else {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
          }
        }

        // Asegurar lienzos de gráficos
        const canvasIds = ['chartCashflowArea', 'chartIncomeByCategory', 'chartExpenseByCategory', 'chartIncomeByDay', 'chartHeatmap'];
        document.querySelectorAll('.chart-wrap').forEach((wrap, idx) => {
          const expectedId = canvasIds[idx];
          if (expectedId && !wrap.querySelector(`canvas#${expectedId}`)) {
            wrap.innerHTML = `<canvas id="${expectedId}"></canvas>`;
          }
        });
      }

      // 6. Sincronizar con Firestore (obtiene datos más frescos si hay diferencia)
      await cargarDatos();
      renderizarTodo();
      ocultarEsqueletos();
      this._bindCrossTabEvents();
    }

    /**
     * Suscribe a los eventos cross-tab y de almacenamiento para
     * recargar y renderizar estadísticas cuando los datos cambian.
     *
     * @override
     */
    _bindCrossTabEvents() {
      window.DataEvents.on('transactionChanged', (data) => {
        mostrarEsqueletos();
        setTimeout(async () => {
          await cargarDatos();
          renderizarTodo();
          ocultarEsqueletos();
        }, 200);
      });

      window.DataEvents.on('categoryChanged', (data) => {
        mostrarEsqueletos();
        if (data && data.action === 'clearAll') {
          limpiarTodosLosDatos();
          setTimeout(async () => {
            await cargarDatos();
            renderizarTodo();
            ocultarEsqueletos();
          }, 100);
        } else {
          setTimeout(async () => {
            await cargarDatos();
            renderizarTodo();
            ocultarEsqueletos();
          }, 200);
        }
      });

      window.DataEvents.on('dataImported', (data) => {
        mostrarEsqueletos();
        setTimeout(async () => {
          await cargarDatos();
          renderizarTodo();
          ocultarEsqueletos();
        }, 500);
      });

      window.addEventListener('storage', (e) => {
        if (e.key === 'finanzapp:data:v1') {
          mostrarEsqueletos();
          if (e.newValue === null || e.newValue === '' || e.newValue === '{"categories":[]}') {
            limpiarTodosLosDatos();
            setTimeout(async () => {
              await cargarDatos();
              renderizarTodo();
              ocultarEsqueletos();
            }, 100);
          } else {
            setTimeout(async () => {
              await cargarDatos();
              renderizarTodo();
              ocultarEsqueletos();
            }, 300);
          }
        }
      });
    }
  }

  const _estadisticaApp = new EstadisticaApp(); // eslint-disable-line no-unused-vars
})();
