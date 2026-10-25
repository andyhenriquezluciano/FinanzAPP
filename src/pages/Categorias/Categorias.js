/**
 * @fileoverview Dashboard principal de FinanzApp.
 * Gestiona categorías, transacciones, filtros, exportación y KPIs diarios.
 * Dependencias: firebase, FirestoreDB, Core, jsPDF.
 */
window.DataEvents = window.DataEvents || { emit(){}, on(){}, off(){} };

if (typeof window !== 'undefined' && window.sidebarRenderer) {
  window.sidebarRenderer.render('categorias');
}

const CATEGORIAS_PREDETERMINADAS = [
  { id: 1, name: 'Nómina', fixedType: 'income', isDefault: true, transactions: [], isPinned: false },
  { id: 2, name: 'Comida', fixedType: 'expense', isDefault: true, transactions: [], isPinned: false },
  { id: 3, name: 'Transporte', fixedType: 'expense', isDefault: true, transactions: [], isPinned: false }
];

const datosUsuario = {
  categories: [],
  monthlyData: {
    labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
    income: Array(12).fill(0),
    expenses: Array(12).fill(0)
  },
  user: { name: "Usuario", email: "usuario@ejemplo.com" }
};

// Carga síncrona inmediata desde localStorage para renderizado instantáneo (0ms)
(function _initCachedCategoriesInstant() {
  try {
    const uid = (typeof window !== 'undefined' && window.AuthService)
      ? window.AuthService.getUserId()
      : (() => {
          try {
            const raw = localStorage.getItem('authUser');
            if (raw && raw !== 'guest') {
              const u = JSON.parse(raw);
              return u.uid || u.email || 'guest';
            }
          } catch {}
          return 'guest';
        })();
    const p = `finanzapp:data:v1:${uid}`;
    const rawCats = localStorage.getItem(`${p}:categories`);
    if (rawCats !== null) {
      const parsed = JSON.parse(rawCats);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0) {
          datosUsuario.categories = parsed.map(c => ({
            ...c,
            transactions: (c.transactions || []).map(t => ({
              ...t,
              date: (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date
            }))
          }));
        } else {
          datosUsuario.categories = [];
        }

        // Vincular transacciones raíz a sus categorías
        const rawTxs = localStorage.getItem(`${p}:transactions`);
        if (rawTxs) {
          try {
            const txs = JSON.parse(rawTxs);
            if (Array.isArray(txs) && txs.length > 0) {
              txs.forEach(t => {
                const cat = datosUsuario.categories.find(
                  c => String(c.id) === String(t.categoryId)
                );
                if (cat) {
                  if (!cat.transactions) cat.transactions = [];
                  const exists = cat.transactions.some(ct => String(ct.id) === String(t.id));
                  if (!exists) {
                    cat.transactions.push({
                      ...t,
                      date: (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date
                    });
                  }
                }
              });
            }
          } catch {}
        }

        return;
      }
    }
    datosUsuario.categories = CATEGORIAS_PREDETERMINADAS.map(c => ({ ...c, transactions: [] }));
  } catch {}
})();
// Redondea un número a exactamente dos decimales evitando errores de punto flotante.
function redondear2(n) {
  return window.Core.helpers.round2(n);
}

// Genera un ID único delegando a window.Core.helpers.
function generarId(prefix = '') {
  return window.Core.helpers.generateId(prefix);
}

// Genera un ID de categoría con prefijo cat_.
function generarIdCategoria(){
  return generarId('cat');
}

// Crea una versión con antirrebote de una función.
function antirrebote(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

let dataVersion = 0;
// Incrementa el contador global de versión de datos e invalida el caché de filtros.
function marcarCambioDatos() { dataVersion++; cacheFiltros.key = null; }

// Normaliza cualquier ID a string para comparaciones seguras.
function normalizarId(id){ return String(id); }

// Busca y devuelve una categoría por su ID.
function buscarCategoria(categoryId){ const nid = normalizarId(categoryId); return datosUsuario.categories.find(c => normalizarId(c.id) === nid) || null; }

// Parsea una cadena de fecha.
function parseFechaInput(raw) {
  return window.Core.helpers.parseDateInput(raw);
}


const cacheFiltros = { key: null, version: -1, result: [] };
// Genera la clave de caché para un objeto de filtros dado.
function claveFiltros(f) { return `${f.year ?? ''}|${f.month ?? ''}|${(f.searchTerm || '').trim().toLowerCase()}`; }

const { esc, formatCurrency, formatInputAmount, sanitizeAmount, formatDate } = window.Core.helpers;
const { createFirestoreStore } = window.Core.storeFactories;
const store = createFirestoreStore();

function asegurarCategoriasPredeterminadas() {
  let changed = false;
  CATEGORIAS_PREDETERMINADAS.forEach(def => {
    if (!datosUsuario.categories.some(c => c.id === def.id)) {
      datosUsuario.categories.push({ ...def, transactions: [], isPinned: false });
      changed = true;
    }
  });
  return changed;
}

const sortFechaCategorias = new Map();
const sortMontoCategorias = new Map();
const paginaCategorias = new Map();
const expandedCategoryIds = new Set();
const compactExpandedCategoryIds = new Set();

(function _cargarSort() {
  try {
    const sf = JSON.parse(localStorage.getItem('sort_fecha') || '{}');
    const sm = JSON.parse(localStorage.getItem('sort_monto') || '{}');
    Object.entries(sf).forEach(([k,v]) => sortFechaCategorias.set(k, v));
    Object.entries(sm).forEach(([k,v]) => sortMontoCategorias.set(k, v));
  } catch {}
})();

function _guardarSort() {
  try {
    localStorage.setItem('sort_fecha', JSON.stringify(Object.fromEntries(sortFechaCategorias)));
    localStorage.setItem('sort_monto', JSON.stringify(Object.fromEntries(sortMontoCategorias)));
  } catch {}
}

let filtrosActuales = window.CategoriasFilters?.cargarFiltrosPersistidos?.() || { year: null, month: null, searchTerm: '' };

function actualizarIndicadorFiltros() {
  window.CategoriasFilters?.actualizarIndicadorFiltros(filtrosActuales);
}

function generarOpcionesAnio() {
  window.CategoriasFilters?.generarOpcionesAnio(filtrosActuales);
}

function cerrarDrawer() { window.CategoriasModals?.cerrarDrawer(); }
function mostrarBottomDrawer(options) { window.CategoriasModals?.mostrarBottomDrawer(options); }
function esVistaEscritorio() { return window.matchMedia('(min-width: 900px)').matches; }
function mostrarExito(message, options = {}) { return window.Toast?.success(message, options); }
function mostrarError(message, options = {}) { return window.Toast?.error(message, options); }

function abrirModal(modal, triggerElement = null) {
  return window.CategoriasModals?.abrirModal(modal, triggerElement);
}

function cerrarModal(modal) {
  return window.CategoriasModals?.cerrarModal(modal);
}

function limpiarBloqueoScroll() {
  return window.CategoriasModals?.limpiarBloqueoScroll();
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.category-menu-wrapper')) {
    document.querySelectorAll('.category-menu.active').forEach(menu => {
      menu.classList.remove('active');
    });
  }
});

/** Persiste el estado completo de `datosUsuario` en el almacén configurado (Firestore/Local). */
async function persist() {
  try {
    // Asegurar que FirestoreDB esté inicializado antes de guardar
    if (window.FirestoreDB && !window.FirestoreDB.initialized) {
      const uid = (typeof window !== 'undefined' && window.AuthService)
        ? window.AuthService.getUserId()
        : null;
      if (uid && uid !== 'guest') {
        await window.FirestoreDB.init(uid);
        window.FirestoreDB.setCurrentUser(uid);
      }
    }

    const allTransactions = datosUsuario.categories.flatMap(c => 
      (c.transactions || []).map(t => ({
        ...t,
        categoryId: c.id,
        categoryName: c.name,
        date: t.date instanceof Date ? t.date.toISOString() : t.date
      }))
    );

    const snapshot = {
      version: 1,
      ...datosUsuario,
      transactions: allTransactions,
      categories: datosUsuario.categories.map(c => ({
        ...c,
        transactions: (c.transactions || []).map(t => ({
          ...t,
          date: t.date instanceof Date ? t.date.toISOString() : t.date
        }))
      }))
    };
    await store.save(snapshot);
  } catch (err) {
    console.error('Error en persist():', err);
  }
}

/** Carga los datos guardados al iniciar la aplicación y asegura las categorías predeterminadas. */
async function boot() {
  try {
    const saved = await store.load();
    if (saved && saved.categories) {
      saved.categories.forEach(c => {
        c.transactions = (c.transactions || []).map(t => ({
          ...t,
          date: (t.date && typeof t.date === 'string') ? new Date(t.date) : t.date
        }));
        if (typeof c.isPinned !== 'boolean') c.isPinned = false;
      });

      if (Array.isArray(saved.transactions) && saved.transactions.length > 0) {
        saved.transactions.forEach(t => {
          const tDate = (t.date && typeof t.date === 'string') ? new Date(t.date) : (t.date || new Date());
          const cat = saved.categories.find(c => String(c.id) === String(t.categoryId) || (t.categoryId && String(c.name).toLowerCase() === String(t.categoryId).toLowerCase()));
          if (cat) {
            if (!cat.transactions) cat.transactions = [];
            const exists = cat.transactions.some(ct => String(ct.id) === String(t.id));
            if (!exists) {
              cat.transactions.push({ ...t, date: tDate });
            }
          }
        });
      }

      Object.assign(datosUsuario, saved);
      marcarCambioDatos();
    } else {
      // Solo para usuario completamente nuevo sin datos previos
      const changed = asegurarCategoriasPredeterminadas();
      if (changed) await persist();
      marcarCambioDatos();
    }
  } catch (err) {
    console.error('Error en boot():', err);
  }
}

(function initShortcuts() {
  window.CategoriasModals?.setupGlobalShortcuts();
})();

/**
 * Alterna el estado de fijado de una categoría, reordena la lista y persiste el cambio.
 * @param {*} categoryId
 */
async function alternarFijado(categoryId) {
  const category = buscarCategoria(categoryId);
  if (!category) {
    console.error('No se encontró la categoría:', categoryId);
    return;
  }
  category.isPinned = !category.isPinned;

  datosUsuario.categories = obtenerCategoriasMostradas();
  marcarCambioDatos();
  await persist();
  renderizarCategorias();
  document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));
  mostrarExito(category.isPinned ? `Categoría "${category.name}" fijada` : `Categoría "${category.name}" desfijada`);
}

/**
 * Muestra el drawer de confirmación para eliminar todas las transacciones de una categoría.
 * @param {*} categoryId
 * @param {HTMLElement|null} [triggerEl]
 */
function limpiarTransaccionesCategoria(categoryId, triggerEl = null) {
  const category = buscarCategoria(categoryId);
  if (!category) return;

  document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));

  const ejecutar = async () => {
    category.transactions = [];
    marcarCambioDatos();
    renderizarCategorias();
    renderizarGraficos();
    actualizarUIEstadisticasDiarias();
    await persist();
    setTimeout(() => { window.DataEvents.emit('transactionChanged', { action: 'clearAll', categoryId }); }, 100);
    mostrarExito(`Transacciones de "${category.name}" eliminadas`);
  };

  if (window.__appConfirmDelete === false) {
    ejecutar();
    return;
  }

  mostrarBottomDrawer({
    mensajeHtml: `¿Limpiar todas las transacciones de "<strong>${esc(category.name)}</strong>"?`,
    confirmText: 'Limpiar',
    cancelText: 'Cancelar',
    variant: 'danger',
    onConfirm: ejecutar
  });
}

/**
 * Devuelve las categorías de `datosUsuario` ordenadas: fijadas primero, luego el resto.
 * @returns {Array}
 */
function obtenerCategoriasMostradas() {
  const pinned = datosUsuario.categories.filter(c => c.isPinned);
  const unpinned = datosUsuario.categories.filter(c => !c.isPinned);
  return [...pinned, ...unpinned];
}

/**
 * Filtra el arreglo de transacciones de una categoría aplicando los filtros activos
 * (año, mes y término de búsqueda).
 * @param {Array} transactions
 * @returns {Array}
 */
function filtrarTransaccionesPorFecha(transactions) {
  if (window.CategoriasFilters?.filtrarTransaccionesPorFecha) {
    return window.CategoriasFilters.filtrarTransaccionesPorFecha(transactions, filtrosActuales, formatCurrency);
  }
  return transactions || [];
}

function aplicarFiltrosACategorias() {
  const key = claveFiltros(filtrosActuales);
  if (cacheFiltros.key === key && cacheFiltros.version === dataVersion) {
    return cacheFiltros.result;
  }
  const res = window.CategoriasFilters?.aplicarFiltrosACategorias(datosUsuario.categories, filtrosActuales, formatCurrency) || [];
  cacheFiltros.key = key;
  cacheFiltros.version = dataVersion;
  cacheFiltros.result = res;
  return res;
}

function _obtenerNombreArchivoUsuario() {
  return window.CategoriasExport?.obtenerNombreArchivoUsuario() || 'Usuario';
}

/**
 * Serializa todos los datos del usuario a JSON y los descarga como archivo (vía CategoriasExport).
 */
function exportarAJSON() {
  if (typeof window !== 'undefined' && window.CategoriasExport?.exportarAJSON) {
    return window.CategoriasExport.exportarAJSON(datosUsuario, mostrarExito);
  }
}

/**
 * Genera un PDF ejecutivo con el resumen financiero y detalle de transacciones (vía CategoriasExport).
 */
function exportarAPDF() {
  if (typeof window !== 'undefined' && window.CategoriasExport?.exportarAPDF) {
    return window.CategoriasExport.exportarAPDF({
      categorias: aplicarFiltrosACategorias(),
      formatCurrency,
      formatDate,
      mostrarExito,
      mostrarError
    });
  }
}




function abrirSelectorFecha(inputId) {
  let inputEl;
  if (inputId === 'edit') {
    inputEl = document.getElementById('editTransactionDate');
  } else if (inputId === 'gmail') {
    inputEl = document.getElementById('gmailTxDate');
  } else {
    inputEl = document.getElementById(`transaction-date-${inputId}`);
  }
  if (window.DatePicker) {
    window.DatePicker.open(inputEl, { disableFuture: true });
  }
}

function openDatePicker(inputId) {
  abrirSelectorFecha(inputId);
}
window.openDatePicker = openDatePicker;

let rendererInstance = null;
function getRenderer() {
  if (!rendererInstance && window.CategoriasRenderer) {
    rendererInstance = window.CategoriasRenderer.init({
      getCategories: () => datosUsuario.categories,
      setCategories: (cats) => { datosUsuario.categories = cats; },
      getFiltros: () => filtrosActuales,
      sortFechaCategorias,
      sortMontoCategorias,
      paginaCategorias,
      expandedCategoryIds,
      compactExpandedCategoryIds,
      aplicarFiltrosACategorias,
      obtenerCategoriasMostradas,
      actualizarResumenFinanciero,
      renderizarGraficos,
      marcarCambioDatos,
      persist,
      alternarFijado,
      mostrarModalEditarCategoria,
      limpiarTransaccionesCategoria,
      mostrarModalEliminarCategoria,
      agregarTransaccion,
      abrirSelectorFecha,
      editarTransaccion,
      eliminarTransaccion,
      alternarMenuCategoria,
      guardarSort: _guardarSort,
      actualizarIndicadorFiltros
    });
  }
  return rendererInstance;
}

function generarHtmlListaTransacciones(category, transaccionesFiltradas) {
  return getRenderer()?.generarHtmlListaTransacciones(category, transaccionesFiltradas) || '';
}

function actualizarTransaccionesDeTarjeta(catId) {
  getRenderer()?.actualizarTransaccionesDeTarjeta(catId);
}

function configurarListenersCategoria(tarjeta, categoryId) {
  getRenderer()?.configurarListenersCategoria(tarjeta, categoryId);
}

function renderizarCategorias() {
  getRenderer()?.renderizarCategorias();
}


/**
 * Valida y agrega una nueva transacción a la categoría indicada.
 * @param {*} categoryId - ID de la categoría destino.
 */
async function agregarTransaccion(categoryId) {
  if (window.CategoriasTransactions) {
    return window.CategoriasTransactions.agregarTransaccion(categoryId, {
      buscarCategoria,
      onUpdated: async () => {
        marcarCambioDatos();
        await persist();
      },
      renderAll: () => {
        renderizarCategorias();
        renderizarGraficos();
        actualizarUIEstadisticasDiarias();
      }
    });
  }
}

/**
 * Alterna la visibilidad del menú contextual de una categoría,
 * cerrando todos los demás menús abiertos.
 * @param {*} categoryId
 */
function posicionarMenuCategoria(menu) {
  if (!menu) return;

  menu.classList.remove('open-up');

  const wrapper = menu.closest('.category-menu-wrapper');
  if (!wrapper) return;

  const mobileNav = document.querySelector('.mobile-bottom-nav');
  const mobileNavVisible = mobileNav && window.getComputedStyle(mobileNav).display !== 'none';
  const mobileNavHeight = mobileNavVisible ? mobileNav.getBoundingClientRect().height : 0;
  const viewportPadding = 12;
  const blockedBottom = mobileNavHeight + viewportPadding;

  const wasActive = menu.classList.contains('active');
  if (!wasActive) menu.classList.add('active');

  const wrapperRect = wrapper.getBoundingClientRect();
  const menuHeight = menu.getBoundingClientRect().height || menu.scrollHeight || 0;
  const availableBelow = window.innerHeight - wrapperRect.bottom - blockedBottom;
  const availableAbove = wrapperRect.top - viewportPadding;

  if (!wasActive) menu.classList.remove('active');

  if (menuHeight > availableBelow && availableAbove > availableBelow) {
    menu.classList.add('open-up');
  }
}

function alternarMenuCategoria(categoryId) {
  const menu = document.getElementById(`category-menu-${categoryId}`);
  const allMenus = document.querySelectorAll('.category-menu');
  
  allMenus.forEach(m => {
    if (m !== menu) m.classList.remove('active');
  });
  
  if (menu) {
    const shouldOpen = !menu.classList.contains('active');

    if (shouldOpen) {
      posicionarMenuCategoria(menu);
    }

    menu.classList.toggle('active', shouldOpen);
  } else {
    console.error('No se encontró el menú para la categoría:', categoryId);
  }
}

function mostrarModalEditarCategoria(categoryId) {
  if (window.CategoriasModals?.mostrarModalEditarCategoria) {
    window.CategoriasModals.mostrarModalEditarCategoria(categoryId, buscarCategoria, abrirModal);
  }
}

function mostrarModalEliminarCategoria(categoryId) {
  if (window.CategoriasModals?.mostrarModalEliminarCategoria) {
    window.CategoriasModals.mostrarModalEliminarCategoria(categoryId, buscarCategoria, async () => {
      const idx = datosUsuario.categories.findIndex(c => normalizarId(c.id) === normalizarId(categoryId));
      if (idx === -1) return;
      const catName = datosUsuario.categories[idx].name;
      datosUsuario.categories.splice(idx, 1);
      marcarCambioDatos();
      renderizarCategorias();
      renderizarGraficos();
      actualizarUIEstadisticasDiarias();
      await persist();
      mostrarExito(`Categoría "${catName}" eliminada`);
      setTimeout(() => { window.DataEvents.emit('categoryChanged', { action: 'delete', categoryId }); }, 100);
    }, esc);
  }
}

function editarTransaccion(categoryId, transactionId) {
  if (window.CategoriasTransactions) {
    return window.CategoriasTransactions.editarTransaccion(categoryId, transactionId, datosUsuario.categories);
  }
}

async function eliminarTransaccion(categoryId, transactionId) {
  if (window.CategoriasTransactions) {
    return await window.CategoriasTransactions.eliminarTransaccion(categoryId, transactionId, datosUsuario.categories, async () => {
      marcarCambioDatos();
      renderizarCategorias();
      actualizarUIEstadisticasDiarias();
      await persist();
    });
  }
}

function showUndoNotification() { window.CategoriasTransactions?.showUndoNotification?.(); }
function hideUndoNotification() { window.CategoriasTransactions?.hideUndoNotification?.(); }

function recomputeMonthlyDataForYear(year = new Date().getFullYear()) {
  window.CategoriasKPIs?.recomputeMonthlyDataForYear(year, datosUsuario.categories, datosUsuario.monthlyData);
}

function actualizarDatosMensuales() {
  const year = (filtrosActuales && filtrosActuales.year != null) ? filtrosActuales.year : new Date().getFullYear();
  recomputeMonthlyDataForYear(year);
}

function calcularTotalesMes(year, month) {
  return window.CategoriasKPIs?.calcularTotalesMes(year, month, datosUsuario.categories) || { income: 0, expenses: 0 };
}

function pctChangeText(curr, prev) {
  return window.CategoriasKPIs?.pctChangeText(curr, prev) || { pct: 0, sign: '', formatted: '0.0', text: '' };
}

function actualizarResumenFinanciero() {
  window.CategoriasKPIs?.actualizarResumenFinanciero(datosUsuario.categories, aplicarFiltrosACategorias(), filtrosActuales, datosUsuario.monthlyData);
}

function calcularEstadisticasDiarias() {
  return window.CategoriasKPIs?.calcularEstadisticasDiarias(aplicarFiltrosACategorias()) || { incomeToday: 0, expensesToday: 0, avgDaily: 0 };
}

function actualizarUIEstadisticasDiarias() {
  window.CategoriasKPIs?.actualizarUIEstadisticasDiarias(aplicarFiltrosACategorias());
}

/** Marcador de posición reservado para renderizar gráficos. Se invoca explícitamente
 * desde múltiples puntos del flujo de actualización; la implementación real reside
 * en la página de Estadísticas que comparte el contexto de datos. */
function renderizarGraficos() {}

/** Carga el tablero realizando el renderizado inicial de categorías, gráficos y KPIs diarios. */
function cargarTablero() {
  renderizarCategorias();
  renderizarGraficos();
  actualizarUIEstadisticasDiarias();
}

/** Vuelve a renderizar el tablero completo al cambiar los filtros activos. */
function aplicarFiltros() {
  renderizarCategorias();
  renderizarGraficos();
  actualizarUIEstadisticasDiarias();
}

const aplicarFiltrosAntirrebote = antirrebote(aplicarFiltros, 200);

function configurarListenersFiltros() {
  window.CategoriasFilters?.configurarListenersFiltros(filtrosActuales, () => {
    aplicarFiltrosAntirrebote();
  });
}

/**
 * Enlaza todos los listeners de UI globales: modales, formularios, importación/exportación,
 * tema, perfil de usuario, selector de fecha y atajos de teclado.
 */
function configurarListenersEventos() {

  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');

  const categoryModal = document.getElementById('categoryModal');
  const editCategoryModal = document.getElementById('editCategoryModal');
  const editTransactionModal = document.getElementById('editTransactionModal');
  const clearAllModal = document.getElementById('clearAllModal');

  const saveCategoryBtn = document.getElementById('saveCategory');
  const saveEditCategoryBtn = document.getElementById('saveEditCategory');
  const saveEditTransactionBtn = document.getElementById('saveEditTransaction');
  const confirmClearAllBtn = document.getElementById('confirmClearAll');

  const exportDropdownBtn = document.getElementById('exportDropdownBtn');
  const exportDropdown = document.getElementById('exportDropdown');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const importBtn = document.getElementById('importStateBtn');
  const clearAllBtn = document.getElementById('clearAllCategoriesBtn');
  const importFileInput = document.getElementById('importFileInput');

  const categoryNameInput = document.getElementById('categoryName');
  const undoDeleteBtn = document.getElementById('undoDelete');
  const editAmountInput = document.getElementById('editTransactionAmount');
  const amountWarning = document.getElementById('amountWarning');

  // Inicialización centralizada de Tema, Perfil y Logout via BasePage
  BasePage.initThemeToggle();
  BasePage.updateUserProfile();
  BasePage.initUserInfoTooltip();
  BasePage.initLogout();

  window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
      try { renderizarGraficos(); } catch {}
    }
  });

  const categoryTypeSelector = document.getElementById('categoryFixedType');
  if (categoryTypeSelector) {
    const buttons = categoryTypeSelector.querySelectorAll('.category-type-btn');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        buttons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
      });
    });
  }

  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      if (categoryNameInput) categoryNameInput.value = '';
      if (categoryTypeSelector) {
        categoryTypeSelector.querySelectorAll('.category-type-btn').forEach(btn => btn.classList.remove('active'));
      }
      if (categoryModal) abrirModal(categoryModal, addCategoryBtn);
    });
  }

  document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => {
    const m = btn.closest('.modal');
    if (m) cerrarModal(m);
  }));

  document.querySelectorAll('[id^="cancel"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.closest('.modal');
      if (m) cerrarModal(m);
    });
  });

  document.addEventListener('click', limpiarBloqueoScroll);
  document.addEventListener('keyup', limpiarBloqueoScroll);
  window.addEventListener('focus', limpiarBloqueoScroll);

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal && window.innerWidth <= 980) cerrarModal(modal); });
  });

  if (exportDropdownBtn) {
    exportDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.classList.toggle('active');
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.export-dropdown')) {
      if (exportDropdown) exportDropdown.classList.remove('active');
    }
  });

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      exportarAJSON();
      if (exportDropdown) exportDropdown.classList.remove('active');
    });
  }


  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportarAPDF();
      if (exportDropdown) exportDropdown.classList.remove('active');
    });
  } else {
    console.error('No se encontró el botón exportPdfBtn');
  }

  if (importBtn) importBtn.addEventListener('click', () => importFileInput && importFileInput.click());
  if (importFileInput) {
    importFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        if (window.CategoriasExport?.importarArchivo) {
          await window.CategoriasExport.importarArchivo({
            file,
            datosUsuario,
            onDataUpdated: async () => {
              marcarCambioDatos();
              await persist();
              renderizarCategorias();
              renderizarGraficos();
              actualizarUIEstadisticasDiarias();
            },
            mostrarExito,
            mostrarError,
            generarId,
            normalizarId
          });
        }
      } finally {
        importFileInput.value = '';
      }
    });
  }

  const onUpdated = async () => { marcarCambioDatos(); await persist(); };
  const renderAll = () => { renderizarCategorias(); renderizarGraficos(); actualizarUIEstadisticasDiarias(); };

  const ejecutarEliminarTodasCategorias = async () => {
    if (window.CategoriasModals?.eliminarTodasCategorias) {
      await window.CategoriasModals.eliminarTodasCategorias({
        datosUsuario,
        onUpdated,
        renderAll,
        modal: clearAllModal
      });
    }
  };

  if (clearAllBtn) clearAllBtn.addEventListener('click', () => {
    if (window.__appConfirmDelete === false) {
      ejecutarEliminarTodasCategorias();
      return;
    }
    if (esVistaEscritorio()) {
      mostrarBottomDrawer({
        mensajeHtml: '¿Quieres eliminar todas las categorías y sus transacciones?<br>Esta acción no se puede deshacer.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'danger',
        onConfirm: ejecutarEliminarTodasCategorias
      });
      return;
    }
    if (clearAllModal) abrirModal(clearAllModal, clearAllBtn);
  });

  if (confirmClearAllBtn) confirmClearAllBtn.addEventListener('click', ejecutarEliminarTodasCategorias);

  if (undoDeleteBtn) {
    undoDeleteBtn.addEventListener('click', async () => {
      if (window.CategoriasTransactions?.deshacerEliminacion) {
        await window.CategoriasTransactions.deshacerEliminacion(datosUsuario.categories, async () => {
          await onUpdated();
          renderAll();
        });
      }
    });
  }

  if (editAmountInput) {
    editAmountInput.addEventListener('input', function(){
      const caret = this.selectionStart;
      const before = this.value;
      const formatted = formatInputAmount(before);
      this.value = formatted;
      const diff = this.value.length - before.length;
      try { this.setSelectionRange(caret + diff, caret + diff); } catch {}
      amountWarning.style.display = 'none';
    });
  }

  if (saveCategoryBtn) {
    saveCategoryBtn.addEventListener('click', async () => {
      await window.CategoriasModals?.guardarNuevaCategoria?.({
        categories: datosUsuario.categories,
        onUpdated,
        renderAll,
        modal: categoryModal
      });
    });
  }

  if (saveEditCategoryBtn) {
    saveEditCategoryBtn.addEventListener('click', async () => {
      await window.CategoriasModals?.guardarEdicionCategoria?.({
        categories: datosUsuario.categories,
        onUpdated,
        renderAll,
        modal: editCategoryModal
      });
    });
  }

  saveEditTransactionBtn.addEventListener('click', async () => {
    await window.CategoriasTransactions?.guardarEdicionTransaccion?.({
      buscarCategoria,
      onUpdated,
      renderAll,
      modal: editTransactionModal
    });
  });

  if (window.CategoriasFilters?.configurarControlesFiltrosYBusqueda) {
    window.CategoriasFilters.configurarControlesFiltrosYBusqueda(filtrosActuales, () => aplicarFiltrosAntirrebote());
  }

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
          sidebar.classList.remove('mobile-open');
        }
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        sidebar.classList.remove('mobile-open');
      }
    });
  }

}

/**
 * @fileoverview Controlador principal del Dashboard.
 * `CategoriasApp` extiende `BasePage` para heredar funcionalidad común.
 * Inicializa la UI y vincula eventos de Firestore.
 */
class CategoriasApp extends BasePage {
  /**
   * Inicializa Firebase, carga los datos del usuario y monta la UI del Dashboard.
   * Se llama automáticamente tras `DOMContentLoaded` desde `BasePage`.
   * @override
   * @returns {Promise<void>}
   */
  async onDataLoaded() {
    // No se usa data de BasePage — el Dashboard gestiona datosUsuario directamente
    // a través de `boot()` para mantener compatibilidad con las funciones de módulo.
  }

  /**
   * Inicializa Firebase + Firestore y arranca todos los subsistemas del Dashboard.
   * Sobreescribe `_init` de `BasePage` para controlar el orden de operaciones.
   * @override
   * @protected
   */
  async _init() {
    generarOpcionesAnio();
    configurarListenersEventos();
    configurarListenersFiltros();
    initCustomTransactionTooltip();
    this._bindCrossTabEvents();
    if (typeof window.initGmailTransactionListener === 'function') {
      window.initGmailTransactionListener();
    }
    cargarTablero();

    if (typeof firebase !== 'undefined' && firebase.auth) {
      try {
        firebase.auth().onAuthStateChanged(async (currentUser) => {
          if (currentUser && window.FirestoreDB) {
            await window.FirestoreDB.init(currentUser.uid);
            window.FirestoreDB.setCurrentUser(currentUser.uid);
            await boot();
            cargarTablero();
            if (window.gmailNotifManager) {
              window.gmailNotifManager.syncFromFirestore();
            }
            this._triggerBackgroundImapSync();
          }
        });
      } catch {}
    }

    await boot();
    cargarTablero();
    this._triggerBackgroundImapSync();
  }

  /**
   * Sincroniza correos bancarios automáticamente en segundo plano cuando el usuario tiene IMAP configurado.
   * Evita saturar con un intervalo mínimo de 60 segundos entre chequeos automáticos.
   * @private
   */
  async _triggerBackgroundImapSync() {
    try {
      if (window.SyncAPI && typeof window.SyncAPI.syncImapOnDemand === 'function') {
        const user = window.AuthService ? window.AuthService.getUser() : null;
        if (!user || user.provider === 'guest' || user.uid === 'guest') return;
        const lastCheckKey = 'finanzapp:last_bg_sync';
        const lastCheck = parseInt(localStorage.getItem(lastCheckKey) || '0', 10);
        if (Date.now() - lastCheck < 60 * 1000) return;
        localStorage.setItem(lastCheckKey, Date.now().toString());

        window.SyncAPI.syncImapOnDemand().then(result => {
          if (result && result.count > 0) {
            if (window.gmailNotifManager) {
              window.gmailNotifManager.syncFromFirestore();
            }
            window.dispatchEvent(new CustomEvent('finanzapp:gmail:notifications-updated'));
          }
        }).catch(() => {
          // Silencioso en segundo plano si no está configurado IMAP o falla la red
        });
      }
    } catch {}
  }

  /**
   * Suscribe al evento cross-tab `datos:actualizados` para recargar y re-renderizar
   * el tablero cuando otra pestaña modifica los datos.
   * @override
   * @protected
   */
  _bindCrossTabEvents() {
    if (window.DataEvents) {
      window.DataEvents.on('datos:actualizados', async () => {
        await boot();
        marcarCambioDatos();
        cargarTablero();
      });
      window.DataEvents.on('transactions:updated', async () => {
        await boot();
        marcarCambioDatos();
        cargarTablero();
      });
    }
    window.addEventListener('finanzapp:data:updated', async () => {
      await boot();
      marcarCambioDatos();
      cargarTablero();
    });

    // Iniciar suscripción en tiempo real con Firestore
    if (window.FirestoreDB && typeof window.FirestoreDB.subscribeToTransactions === 'function') {
      try {
        window.FirestoreDB.subscribeToTransactions();
      } catch {}
    }
  }
}

/** Instancia global del controlador del Dashboard. */
const _categoriasApp = new CategoriasApp();

window.alternarMenuCategoria = alternarMenuCategoria;
window.alternarFijado = alternarFijado;
window.mostrarModalEditarCategoria = mostrarModalEditarCategoria;
window.mostrarModalEliminarCategoria = mostrarModalEliminarCategoria;
window.limpiarTransaccionesCategoria = limpiarTransaccionesCategoria;
window.agregarTransaccion = agregarTransaccion;
/**
 * Agrega una transacción directamente a una categoría sin pasar por los inputs del DOM.
 * Usada por la integración de Gmail para guardar transacciones detectadas automáticamente.
 * @param {string|number} categoryId
 * @param {'income'|'expense'} type
 * @param {number} amount
 * @param {string} description
 * @param {Date} date
 * @returns {Promise<boolean>}
 */
async function agregarTransaccionDirecta(categoryId, type, amount, description, date) {
  if (window.CategoriasTransactions?.agregarTransaccionDirecta) {
    return window.CategoriasTransactions.agregarTransaccionDirecta(categoryId, type, amount, description, date, {
      buscarCategoria,
      onUpdated: async () => { marcarCambioDatos(); await persist(); },
      renderAll: () => { renderizarCategorias(); renderizarGraficos(); actualizarUIEstadisticasDiarias(); }
    });
  }
  return false;
}
window.agregarTransaccionDirecta = agregarTransaccionDirecta;
window.obtenerCategorias = () => datosUsuario.categories || [];
window.asegurarCategoriasPredeterminadas = asegurarCategoriasPredeterminadas;
window.renderizarCategorias = renderizarCategorias;

function initCustomTransactionTooltip() {
  return window.CategoriasTooltip?.init();
}

window.editarTransaccion = editarTransaccion;
window.eliminarTransaccion = eliminarTransaccion;
window.abrirSelectorFecha = abrirSelectorFecha;
