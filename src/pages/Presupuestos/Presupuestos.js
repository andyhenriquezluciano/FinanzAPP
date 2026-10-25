/**
 * @fileoverview Página de Presupuestos de FinanzApp.
 * Permite crear, editar y eliminar presupuestos por categoría y periodo,
 * visualizar el progreso de gasto frente a cada presupuesto y filtrar
 * por año, mes y categoría.
 *
 * @module Presupuestos
 */
(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.sidebarRenderer) {
    window.sidebarRenderer.render('presupuestos');
  }

  const { formatCurrency, formatInputAmount, formatDate, parseDateInput } = window.Core.helpers;

  const datosApp = {
    budgets: [],
    categories: [],
    transactions: [],
    user: { name: 'Usuario', email: 'usuario@ejemplo.com' }
  };

  const mostrarExito = (msg, opts) => window.Toast?.success(msg, opts);
  const mostrarAdvertencia = (msg, opts) => window.Toast?.warning(msg, opts);
  const mostrarError = (msg, opts) => window.Toast?.error(msg, opts);

  function cargarDatosLocalesSincronos() {
    try {
      const uid = (typeof window !== 'undefined' && window.AuthService)
        ? window.AuthService.getUserId()
        : (() => {
            try {
              const raw = localStorage.getItem('authUser');
              if (raw && raw !== 'guest') {
                const p = JSON.parse(raw);
                return p.uid || p.id || 'guest';
              }
            } catch {}
            return 'guest';
          })();

      const p = 'finanzapp:data:v1';
      let rawCats = localStorage.getItem(`${p}:${uid}:categories`);
      let rawTxs = localStorage.getItem(`${p}:${uid}:transactions`);
      let rawBuds = localStorage.getItem('finanzapp:budgets') || localStorage.getItem(`${p}:${uid}:budgets`);

      if (!rawCats) rawCats = localStorage.getItem('categories');
      if (!rawTxs) rawTxs = localStorage.getItem('transactions');

      if (rawCats) {
        try { datosApp.categories = JSON.parse(rawCats) || []; } catch {}
      }
      if (rawTxs) {
        try {
          const parsedTxs = JSON.parse(rawTxs) || [];
          const txsFromCats = [];
          (datosApp.categories || []).forEach(cat => {
            if (Array.isArray(cat?.transactions)) {
              txsFromCats.push(...cat.transactions.map(t => ({
                ...t,
                categoryId: cat.id,
                categoryName: cat.name
              })));
            }
          });
          datosApp.transactions = normalizarTransacciones([...parsedTxs, ...txsFromCats]);
        } catch {}
      }
      if (rawBuds) {
        try {
          const parsedBuds = JSON.parse(rawBuds);
          const list = Array.isArray(parsedBuds) ? parsedBuds : (typeof parsedBuds === 'object' ? Object.values(parsedBuds) : []);
          datosApp.budgets = list.map((b, idx) => {
            if (!b || typeof b !== 'object') return null;
            const id = b.id != null && String(b.id).trim() !== ''
              ? String(b.id)
              : (b.categoryId ? `budget_${b.categoryId}` : `budget_${Date.now()}_${idx}`);
            return {
              ...b,
              id,
              amount: Number(b.amount) || 0,
              period: b.period || 'monthly',
              categoryId: b.categoryId != null ? String(b.categoryId) : ''
            };
          }).filter(Boolean);
        } catch {}
      }

      actualizarCategorias();
      try { actualizarNombresPeriodosGuardados(); } catch {}
    } catch (e) {
      console.warn('[Presupuestos] Error cargando caché local:', e);
    }
  }

  function procesarQuickCreateDesdeURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      const quickCreate = params.get('quickCreate');
      if (quickCreate !== '1') return;
      abrirModalCrear();
      params.delete('quickCreate');
      const query = params.toString();
      const hash = window.location.hash || '';
      const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${hash}`;
      window.history.replaceState({}, '', newUrl);
    } catch (e) {
      console.warn('No se pudo procesar quickCreate desde URL:', e);
    }
  }

  function parseFechaFlexible(raw) {
    if (!raw) return null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

    if (raw && typeof raw.toDate === 'function') {
      const d = raw.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }

    if (raw && typeof raw === 'object' && Number.isFinite(raw.seconds)) {
      const d = new Date(raw.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const directa = new Date(raw);
    if (!Number.isNaN(directa.getTime())) return directa;

    if (typeof raw === 'string') {
      return parseDateInput(raw);
    }

    return null;
  }

  function normalizarTipoTx(type) {
    const t = String(type || '').trim().toLowerCase();
    if (t === 'income' || t === 'ingreso') return 'income';
    if (t === 'expense' || t === 'gasto') return 'expense';
    return '';
  }

  function transaccionCoincideTipoPresupuesto(tx, categoryId) {
    const txTipo = normalizarTipoTx(tx?.type);
    if (!txTipo) return false;

    const categoria = datosApp.categories.find(c => String(c.id) === String(categoryId));
    const fixedType = String(categoria?.fixedType || '').trim().toLowerCase();

    if (fixedType === 'income' || fixedType === 'expense') {
      return txTipo === fixedType;
    }

    return txTipo === 'expense';
  }

  function transaccionPerteneceACategoria(tx, categoryId) {
    if (String(tx?.categoryId ?? '') === String(categoryId)) return true;

    const categoria = datosApp.categories.find(c => String(c.id) === String(categoryId));
    if (!categoria) return false;

    const txCategoryName = String(tx?.categoryName || tx?.category || '').trim().toLowerCase();
    const categoriaNombre = String(categoria.name || '').trim().toLowerCase();
    return !!txCategoryName && txCategoryName === categoriaNombre;
  }

  function normalizarTransacciones(rawTransactions = []) {
    const categoryIdByName = new Map();
    datosApp.categories.forEach(cat => {
      const key = String(cat?.name || '').trim().toLowerCase();
      if (key) categoryIdByName.set(key, cat.id);
    });

    const seen = new Set();
    const result = [];

    (rawTransactions || []).forEach((tx) => {
      if (!tx || typeof tx !== 'object') return;

      let categoryId = tx.categoryId;
      if (categoryId == null || categoryId === '') {
        const key = String(tx.categoryName || tx.category || '').trim().toLowerCase();
        if (key && categoryIdByName.has(key)) categoryId = categoryIdByName.get(key);
      }

      const normalized = {
        ...tx,
        categoryId,
        categoryName: tx.categoryName || tx.category || null
      };

      const d = parseFechaFlexible(normalized.date);
      const dateKey = d ? d.toISOString() : String(normalized.date || '');
      const dedupeKey = normalized.id 
        ? `id_${normalized.id}`
        : [
            String(normalized.categoryId ?? ''),
            String(Number(normalized.amount) || 0),
            String(normalized.type || ''),
            dateKey
          ].join('|');

      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      result.push(normalized);
    });

    return result;
  }

  let elementos = {};
  let renderer = null;
  let filters = null;

  function cargarElementosDOM() {
    elementos = {
      yearFilter: document.getElementById('yearFilter'),
      monthFilter: document.getElementById('monthFilter'),
      clearFiltersBtn: document.getElementById('clearFiltersBtn'),

      totalBudgeted: document.getElementById('totalBudgeted'),
      totalSpent: document.getElementById('totalSpent'),
      totalAvailable: document.getElementById('totalAvailable'),
      complianceRate: document.getElementById('complianceRate'),

      budgetsContainer: document.getElementById('budgetsContainer'),
      budgetsTableBody: document.getElementById('budgetsTableBody'),

      budgetModal: document.getElementById('budgetModal'),
      budgetModalTitle: document.getElementById('budgetModalTitle'),
      budgetForm: document.getElementById('budgetForm'),
      closeBudgetModal: document.getElementById('closeBudgetModal'),
      cancelBudgetBtn: document.getElementById('cancelBudgetBtn'),
      saveBudgetBtn: document.getElementById('saveBudgetBtn'),
      addBudgetBtn: document.getElementById('addBudgetBtn'),

      budgetCategoryDropdown: document.getElementById('budgetCategoryDropdown'),
      budgetCategory: document.getElementById('budgetCategory'),
      budgetAmount: document.getElementById('budgetAmount'),
      budgetPeriodDropdown: document.getElementById('budgetPeriodDropdown'),
      budgetPeriod: document.getElementById('budgetPeriod'),
      budgetStartDate: document.getElementById('budgetStartDate'),
      budgetEndDate: document.getElementById('budgetEndDate'),
      customPeriodGroup: document.getElementById('customPeriodGroup'),
      customEndGroup: document.getElementById('customEndGroup'),

      budgetTableSearch: document.getElementById('budgetTableSearch'),
      budgetTableInfo: document.getElementById('budgetTableInfo'),
      prevPageBtn: document.getElementById('prevPageBtn'),
      nextPageBtn: document.getElementById('nextPageBtn'),
      pageInfo: document.getElementById('pageInfo'),

      themeToggle: document.getElementById('themeToggle'),
      logoutButton: document.getElementById('logoutButton'),
      userInfoHover: document.getElementById('userInfoHover')
    };
  }

  async function inicializar() {
    cargarElementosDOM();

    // BasePage centralizado
    window.BasePage?.initThemeToggle();
    window.BasePage?.updateUserProfile();
    window.BasePage?.initUserInfoTooltip();
    window.BasePage?.initLogout();

    renderer = window.PresupuestosRenderer?.init({
      getElementos: () => elementos,
      getCategories: () => datosApp.categories,
      getFilteredBudgets: () => filters ? filters.obtenerPresupuestosFiltrados() : datosApp.budgets,
      getFiltros: () => filters ? filters.getFiltros() : {},
      calcularGastado,
      formatCurrency,
      formatDate,
      sincronizarPresupuesto,
      editarPresupuesto,
      eliminarPresupuesto
    });

    filters = window.PresupuestosFilters?.init({
      getBudgets: () => datosApp.budgets,
      getTransactions: () => datosApp.transactions,
      parseFecha: parseFechaFlexible,
      onFilterChange: () => {
        renderer?.setPaginaActual(1);
        renderizarTodo();
      }
    });

    // 1. Carga y renderizado optimista inmediato (0ms) con datos en localStorage
    cargarDatosLocalesSincronos();
    configurarEventos();
    renderer?.configurarOrdenTabla();
    filters?.configurarDropdowns();
    renderizarTodo();

    // 2. Sincronización con Firebase Auth y Firestore (solo usuarios autenticados)
    const _isGuest = (typeof window !== 'undefined' && window.AuthService)
      ? window.AuthService.isGuest()
      : (() => {
          try {
            const raw = localStorage.getItem('authUser');
            if (!raw) return true;
            const u = JSON.parse(raw);
            return u.uid === 'guest' || u.provider === 'guest' || !u.uid;
          } catch { return true; }
        })();

    if (!_isGuest && typeof firebase !== 'undefined' && firebase.auth) {
      try {
        await new Promise((resolve) => {
          const auth = firebase.auth();
          let resolved = false;
          const fallbackTimer = setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 3000);

          auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
              if (resolved) {
                try {
                  if (window.FirestoreDB) {
                    await window.FirestoreDB.init(currentUser.uid);
                    window.FirestoreDB.setCurrentUser(currentUser.uid);
                  }
                  await cargarDatosIniciales();
                  renderizarTodo();
                } catch (err) {
                  window.Logger?.warn('Presupuestos', 'Error recargando tras cambio de auth', err);
                }
                return;
              }
              clearTimeout(fallbackTimer);
              resolved = true;
              try {
                if (window.FirestoreDB) {
                  await window.FirestoreDB.init(currentUser.uid);
                  window.FirestoreDB.setCurrentUser(currentUser.uid);
                }
              } catch (err) {
                window.Logger?.warn('Presupuestos', 'Error inicializando FirestoreDB en auth', err);
              }
              resolve();
            }
          });
        });
      } catch (err) {
        window.Logger?.warn('Presupuestos', 'Error en promesa de auth', err);
      }
    }

    await cargarDatosIniciales();
    renderizarTodo();
  }

  function configurarEventos() {
    if (elementos.addBudgetBtn) {
      elementos.addBudgetBtn.addEventListener('click', abrirModalCrear);
    }

    if (elementos.clearFiltersBtn) {
      elementos.clearFiltersBtn.addEventListener('click', () => filters?.limpiarFiltros());
    }

    if (elementos.closeBudgetModal) {
      elementos.closeBudgetModal.addEventListener('click', cerrarModal);
    }

    if (elementos.cancelBudgetBtn) {
      elementos.cancelBudgetBtn.addEventListener('click', cerrarModal);
    }

    if (elementos.saveBudgetBtn) {
      elementos.saveBudgetBtn.addEventListener('click', guardarPresupuesto);
    }

    if (elementos.budgetPeriod) {
      elementos.budgetPeriod.addEventListener('change', (e) => {
        const isCustom = e.target.value === 'custom';
        if (elementos.customPeriodGroup) elementos.customPeriodGroup.style.display = isCustom ? 'block' : 'none';
        if (elementos.customEndGroup) elementos.customEndGroup.style.display = isCustom ? 'block' : 'none';
      });
    }

    if (elementos.budgetAmount) {
      elementos.budgetAmount.addEventListener('input', function () {
        const caret = this.selectionStart;
        const before = this.value;
        const formatted = formatInputAmount(before);
        this.value = formatted;
        const diff = this.value.length - before.length;
        try { this.setSelectionRange(caret + diff, caret + diff); } catch (err) {}
      });

      elementos.budgetAmount.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          guardarPresupuesto();
        }
      });
    }

    if (elementos.budgetTableSearch) {
      elementos.budgetTableSearch.addEventListener('input', debounce(() => renderer?.buscarEnTabla(), 300));
    }

    if (elementos.prevPageBtn) {
      elementos.prevPageBtn.addEventListener('click', () => renderer?.cambiarPagina(-1));
    }

    if (elementos.nextPageBtn) {
      elementos.nextPageBtn.addEventListener('click', () => renderer?.cambiarPagina(1));
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elementos.budgetModal && !elementos.budgetModal.classList.contains('hidden')) {
        cerrarModal();
        return;
      }

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

  async function cargarDatosIniciales() {
    try {
      let data = null;
      try {
        if (window.Core?.storeFactories?.createFirestoreStore) {
          const store = window.Core.storeFactories.createFirestoreStore();
          data = await store.load();
        } else if (window.DataStore?.loadData) {
          data = await window.DataStore.loadData();
        }
      } catch (e) {
        window.Logger?.debug('Presupuestos', 'Fallo cargando de FirestoreStore', e);
      }

      let dataFromLocalStore = null;
      try {
        if (window.Core?.storeFactories?.createLocalStorageStore) {
          const localStore = window.Core.storeFactories.createLocalStorageStore();
          dataFromLocalStore = await localStore.load();
        }
      } catch (e) {
        window.Logger?.debug('Presupuestos', 'Fallo cargando de LocalStorageStore', e);
      }

      if (!data && window.FirestoreDB?.currentUserId) {
        try {
          const fsData = await window.FirestoreDB.loadAllUserData();
          if (fsData && (fsData.categories?.length || fsData.transactions?.length)) {
            data = fsData;
          }
        } catch (e) {
          window.Logger?.debug('Presupuestos', 'Fallo cargando de FirestoreDB directo', e);
        }
      }

      const categoriesFromStore = Array.isArray(data?.categories) ? data.categories : null;
      const transactionsFromStore = Array.isArray(data?.transactions) ? data.transactions : null;

      const categoriesFromLocalStore = Array.isArray(dataFromLocalStore?.categories) ? dataFromLocalStore.categories : null;
      const transactionsFromLocalStore = Array.isArray(dataFromLocalStore?.transactions) ? dataFromLocalStore.transactions : null;

      const categoriesFromLocal = (() => {
        try { return JSON.parse(localStorage.getItem('categories') || '[]'); } catch { return []; }
      })();
      const transactionsFromLocal = (() => {
        try { return JSON.parse(localStorage.getItem('transactions') || '[]'); } catch { return []; }
      })();

      if (categoriesFromStore !== null) {
        datosApp.categories = categoriesFromStore;
      } else if (categoriesFromLocalStore !== null) {
        datosApp.categories = categoriesFromLocalStore;
      } else {
        datosApp.categories = categoriesFromLocal;
      }

      const transactionsFromCategories = [];
      datosApp.categories.forEach(cat => {
        if (Array.isArray(cat?.transactions)) {
          transactionsFromCategories.push(...cat.transactions.map(t => ({
            ...t,
            categoryId: cat.id,
            categoryName: cat.name
          })));
        }
      });

      if (transactionsFromStore !== null) {
        datosApp.transactions = normalizarTransacciones([...transactionsFromStore, ...transactionsFromCategories]);
      } else if (transactionsFromLocalStore !== null) {
        datosApp.transactions = normalizarTransacciones([...transactionsFromLocalStore, ...transactionsFromCategories]);
      } else {
        datosApp.transactions = normalizarTransacciones([...transactionsFromLocal, ...transactionsFromCategories]);
      }

      let rawBudgets = [];
      const budgetData = localStorage.getItem('finanzapp:budgets');
      if (budgetData) {
        try {
          const parsed = JSON.parse(budgetData);
          if (Array.isArray(parsed)) rawBudgets = parsed;
          else if (parsed && typeof parsed === 'object') rawBudgets = Object.values(parsed);
        } catch (_) { rawBudgets = []; }
      }
      if ((!rawBudgets || !rawBudgets.length) && data?.budgets) {
        if (Array.isArray(data.budgets)) rawBudgets = data.budgets;
        else if (typeof data.budgets === 'object') rawBudgets = Object.values(data.budgets);
      }

      datosApp.budgets = (rawBudgets || []).map((b, idx) => {
        if (!b || typeof b !== 'object') return null;
        const id = b.id != null && String(b.id).trim() !== ''
          ? String(b.id)
          : (b.categoryId ? `budget_${b.categoryId}` : `budget_${Date.now()}_${idx}`);
        return {
          ...b,
          id,
          amount: Number(b.amount) || 0,
          period: b.period || 'monthly',
          categoryId: b.categoryId != null ? String(b.categoryId) : ''
        };
      }).filter(Boolean);

      actualizarCategorias();
      try { actualizarNombresPeriodosGuardados(); } catch (_) {}

      // Renovación automática de presupuestos vencidos
      try {
        let autoRenewEnabled = true;
        try {
          const settings = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
          if (settings.autoRenewBudgets === 'off') autoRenewEnabled = false;
        } catch (_) {}

        if (autoRenewEnabled) {
          const renewals = revisarYRenovarPresupuestos();
          renderizarTodo();
          if (renewals && renewals.length) {
            renewals.forEach(r => {
              const cumplido = r.status === 'completed';
              const nombre = r.name || 'Presupuesto';
              const estado = cumplido ? 'Cumplido' : 'No cumplido';
              const msg = `${nombre} renovado (${estado})`;
              if (cumplido) mostrarExito(msg, { duration: 6000 });
              else mostrarAdvertencia(msg, { duration: 6000 });
            });
          }
        } else {
          renderizarTodo();
        }
      } catch (_) {
        renderizarTodo();
      }

      procesarQuickCreateDesdeURL();
    } catch (error) {
      mostrarError('Error al cargar los datos');
    }
  }

  async function guardarPresupuestos() {
    if (window._isHandlingCrossTab) return;
    window._isPresupuestosSaving = true;
    try {
      localStorage.setItem('finanzapp:budgets', JSON.stringify(datosApp.budgets));
      if (window.Core?.storeFactories?.createFirestoreStore) {
        const store = window.Core.storeFactories.createFirestoreStore();
        let cats = datosApp.categories;
        let txs = datosApp.transactions;
        if ((!cats || cats.length === 0) || (!txs || txs.length === 0)) {
          try {
            const current = await store.load();
            if (current) {
              if (!cats || cats.length === 0) cats = current.categories || [];
              if (!txs || txs.length === 0) txs = current.transactions || [];
            }
          } catch (_) {}
        }
        await store.save({
          categories: cats,
          transactions: txs,
          budgets: datosApp.budgets || []
        });
      }
      if (window.DataEvents) {
        window.DataEvents.emit('datos:actualizados');
      }
    } catch (_) {
    } finally {
      setTimeout(() => { window._isPresupuestosSaving = false; }, 1500);
    }
  }

  function calcularGastadoEnRango(categoryId, startDate, endDate) {
    try {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      const end = new Date(endDate);
      end.setHours(23,59,59,999);
      const gastos = datosApp.transactions.filter(t => {
        if (!transaccionCoincideTipoPresupuesto(t, categoryId)) return false;
        if (!transaccionPerteneceACategoria(t, categoryId)) return false;
        const txDate = parseFechaFlexible(t.date);
        if (!txDate) return false;
        return txDate >= start && txDate <= end;
      });
      return gastos.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    } catch (_) {
      return 0;
    }
  }

  function actualizarNombresPeriodosGuardados() {
    try {
      if (!Array.isArray(datosApp.budgets) || !Array.isArray(datosApp.categories)) return;
      let changed = false;
      datosApp.budgets.forEach(b => {
        try {
          if (!b) return;
          const cat = datosApp.categories.find(c => String(c.id) === String(b.categoryId));
          const nuevo = String(cat?.name || b.categoryName || 'Sin categoría').trim();
          if (nuevo && b.name !== undefined && b.name !== nuevo) {
            b.name = nuevo;
            changed = true;
          } else if (b.name === undefined) {
            b.name = nuevo;
          }
        } catch (_) {}
      });
      if (changed) guardarPresupuestos();
    } catch (e) {
      console.error('Error migrando nombres de periodo:', e);
    }
  }

  function revisarYRenovarPresupuestos() {
    if (window.PresupuestosRollover) {
      const { summaries, changed } = window.PresupuestosRollover.revisarYRenovarPresupuestos(
        datosApp.budgets,
        (catId, startIso, endIso) => calcularGastadoEnRango(catId, startIso, endIso)
      );
      if (changed) guardarPresupuestos();
      return summaries;
    }
    return [];
  }

  function actualizarCategorias() {
    poblarDropdownCategoriasModal(elementos.budgetCategory?.value || '');
  }

  function calcularGastado(budget) {
    const startDate = new Date(budget.startDate);
    const endDate = new Date(budget.endDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const gastos = datosApp.transactions.filter(t => {
      if (!transaccionCoincideTipoPresupuesto(t, budget.categoryId)) return false;
      if (!transaccionPerteneceACategoria(t, budget.categoryId)) return false;

      const txDate = parseFechaFlexible(t.date);
      if (!txDate) return false;
      return txDate >= startDate && txDate <= endDate;
    });

    return gastos.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }

  function calcularEstadisticas() {
    let totalPresupuestado = 0;
    let totalGastado = 0;
    let presupuestosDentroDeLimite = 0;

    const presupuestosFiltrados = filters ? filters.obtenerPresupuestosFiltrados() : datosApp.budgets;

    presupuestosFiltrados.forEach(budget => {
      const gastado = calcularGastado(budget);
      totalPresupuestado += budget.amount;
      totalGastado += gastado;

      if (gastado <= budget.amount) {
        presupuestosDentroDeLimite++;
      }
    });

    const totalDisponible = totalPresupuestado - totalGastado;
    const tasaCumplimiento = presupuestosFiltrados.length > 0 
      ? (presupuestosDentroDeLimite / presupuestosFiltrados.length) * 100 
      : 0;

    return {
      totalPresupuestado,
      totalGastado,
      totalDisponible,
      tasaCumplimiento
    };
  }

  function renderizarTodo() {
    actualizarResumen();
    renderer?.renderizarTarjetasPresupuestos();
    renderer?.renderizarTabla();
  }

  function actualizarResumen() {
    const stats = calcularEstadisticas();
    if (elementos.totalBudgeted) elementos.totalBudgeted.textContent = formatCurrency(stats.totalPresupuestado);
    if (elementos.totalSpent) elementos.totalSpent.textContent = formatCurrency(stats.totalGastado);
    if (elementos.totalAvailable) elementos.totalAvailable.textContent = formatCurrency(stats.totalDisponible);
    if (elementos.complianceRate) elementos.complianceRate.textContent = `${Math.round(stats.tasaCumplimiento)}%`;
  }

  let crudInstance = null;
  function getCrud() {
    if (!crudInstance && window.PresupuestosCRUD) {
      crudInstance = window.PresupuestosCRUD.init({
        getElementos: () => elementos,
        getDatosApp: () => datosApp,
        guardarPresupuestos,
        renderizarTodo,
        transaccionPerteneceACategoria,
        parseFechaFlexible,
        getBudgetDisplayName: window.PresupuestosRenderer?.getBudgetDisplayName,
        mostrarExito,
        mostrarAdvertencia
      });
    }
    return crudInstance;
  }

  function poblarDropdownCategoriasModal(selectedCatId = '') { getCrud()?.poblarDropdownCategoriasModal(selectedCatId); }
  function abrirModalCrear() { getCrud()?.abrirModalCrear(); }
  function editarPresupuesto(budgetId) { getCrud()?.editarPresupuesto(budgetId); }
  function sincronizarPresupuesto(budgetId) { getCrud()?.sincronizarPresupuesto(budgetId); }
  async function eliminarPresupuesto(budgetId) { return getCrud()?.eliminarPresupuesto(budgetId); }
  function guardarPresupuesto() { getCrud()?.guardarPresupuesto(); }
  function cerrarModal() { getCrud()?.cerrarModal(); }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function abrirSelectorFecha(inputId) {
    const input = document.getElementById(inputId === 'start' ? 'budgetStartDate' : 'budgetEndDate');
    if (!input || !window.DatePicker) return;

    const modal = document.getElementById('budgetModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }

    const restoreModal = () => {
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = '';
      }
    };

    let minDate = null;
    if (inputId === 'end') {
      const startVal = document.getElementById('budgetStartDate')?.value;
      if (startVal) minDate = parseDateInput(startVal);
    }

    window.DatePicker.open(input, {
      disableFuture: inputId === 'start',
      minDate,
      onClose: restoreModal,
      onConfirm: restoreModal
    });
  }

  window.openDatePicker = function(inputId) {
    abrirSelectorFecha(inputId);
  };

  /**
   * Controlador de página que extiende BasePage.
   */
  class PresupuestosApp extends window.BasePage {
    async _init() {
      inicializar();
      this._bindCrossTabEvents();
    }

    _bindCrossTabEvents() {
      if (!window.DataEvents) return;
      window.DataEvents.on('datos:actualizados', async () => {
        if (window._isPresupuestosSaving) return;
        window._isHandlingCrossTab = true;
        try {
          await cargarDatosIniciales();
        } finally {
          window._isHandlingCrossTab = false;
        }
      });
    }
  }

  const _presupuestosApp = new PresupuestosApp(); // eslint-disable-line no-unused-vars

  window.PresupuestosApp = {
    renderizarTodo,
    limpiarFiltros: () => filters?.limpiarFiltros(),
    abrirModalCrear
  };
})();
