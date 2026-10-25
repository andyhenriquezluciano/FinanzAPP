/**
 * FinanzApp - Categorias Renderer Module
 * Single Responsibility: Render category cards, transaction lists, drag-and-drop ordering, and card event binding.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoriasRenderer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let config = {};
  let sortFechaCategorias = new Map();
  let sortMontoCategorias = new Map();
  let paginaCategorias = new Map();
  let expandedCategoryIds = new Set();
  let compactExpandedCategoryIds = new Set();
  let dragCategoryId = null;

  const MSG_MAX_DIGITS = 'Máximo 8 dígitos enteros permitidos';

  function init(options) {
    config = options || {};
    if (config.sortFechaCategorias) sortFechaCategorias = config.sortFechaCategorias;
    if (config.sortMontoCategorias) sortMontoCategorias = config.sortMontoCategorias;
    if (config.paginaCategorias) paginaCategorias = config.paginaCategorias;
    if (config.expandedCategoryIds) expandedCategoryIds = config.expandedCategoryIds;
    if (config.compactExpandedCategoryIds) compactExpandedCategoryIds = config.compactExpandedCategoryIds;

    return {
      generarHtmlListaTransacciones,
      actualizarTransaccionesDeTarjeta,
      configurarListenersCategoria,
      renderizarCategorias,
      sortFechaCategorias,
      sortMontoCategorias,
      paginaCategorias,
      expandedCategoryIds,
      compactExpandedCategoryIds
    };
  }

  function getCategories() {
    if (typeof config.getCategories === 'function') return config.getCategories();
    return [];
  }

  function getFiltros() {
    if (typeof config.getFiltros === 'function') return config.getFiltros();
    return { year: null, month: null, searchTerm: '' };
  }

  function formatCurrency(val) {
    if (window.Core?.helpers?.formatCurrency) return window.Core.helpers.formatCurrency(val);
    const n = Number(val) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
  }

  function formatDate(d) {
    if (window.Core?.helpers?.formatDate) return window.Core.helpers.formatDate(d);
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-DO');
  }

  function formatInputAmountEs(raw) {
    if (window.Core?.helpers?.formatInputAmount) return window.Core.helpers.formatInputAmount(raw);
    if (raw == null) return '';
    let s = String(raw).replace(/\s+/g, '').replace(/[^\d.]/g, '');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    }
    let [intPart, decPart = ''] = s.split('.');
    intPart = intPart.replace(/^0+(?=\d)/, '').slice(0, 8);
    decPart = decPart.replace(/\D/g, '').slice(0, 2);
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart.length ? `${intFormatted}.${decPart}` : (s.endsWith('.') ? intFormatted + '.' : intFormatted);
  }

  function esc(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function esVistaEscritorio() {
    return window.innerWidth > 980;
  }

  function generarHtmlListaTransacciones(category, transaccionesFiltradas, prefilteredTx) {
    const txVisibles = prefilteredTx || (category.fixedType
      ? (transaccionesFiltradas || []).filter(t => t.type === category.fixedType)
      : (transaccionesFiltradas || []));

    if (txVisibles.length === 0) {
      return '<div class="transaction-list is-empty" style="display: none !important;"></div>';
    }

    const sortFecha = sortFechaCategorias.get(category.id) || 'newest';
    const sortMonto = sortMontoCategorias.get(category.id) || 'off';
    const txOrdenadas = [...txVisibles].sort((a, b) => {
      if (sortMonto === 'amount-desc') return b.amount - a.amount;
      if (sortMonto === 'amount-asc') return a.amount - b.amount;
      return sortFecha === 'oldest' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date);
    });

    const txPerPage = (typeof window.__appTxPerPage === 'number' && window.__appTxPerPage > 0) ? window.__appTxPerPage : Infinity;
    const totalPaginas = txPerPage === Infinity ? 1 : Math.max(1, Math.ceil(txOrdenadas.length / txPerPage));
    const paginaActual = Math.min(paginaCategorias.get(category.id) || 0, totalPaginas - 1);
    paginaCategorias.set(category.id, paginaActual);
    const txPagina = txPerPage === Infinity ? txOrdenadas : txOrdenadas.slice(paginaActual * txPerPage, (paginaActual + 1) * txPerPage);

    const fechaIcon = sortFecha === 'newest' ? 'arrow-down-wide-narrow' : 'arrow-up-narrow-wide';
    const fechaLabel = sortFecha === 'newest' ? 'Más reciente primero' : 'Más antiguo primero';
    const montoIcon = sortMonto === 'amount-desc' ? 'arrow-down-1-0' : sortMonto === 'amount-asc' ? 'arrow-up-0-1' : 'circle-dollar-sign';
    const montoLabel = sortMonto === 'amount-desc' ? 'Mayor monto primero' : sortMonto === 'amount-asc' ? 'Menor monto primero' : 'Ordenar por monto';
    const montoClass = sortMonto === 'amount-desc' ? ' sort-btn--desc' : sortMonto === 'amount-asc' ? ' sort-btn--asc' : '';
    const mostrarTooltipFiltrosTx = esVistaEscritorio();
    const fechaTitleAttr = mostrarTooltipFiltrosTx ? ` title="${fechaLabel}"` : '';
    const montoTitleAttr = mostrarTooltipFiltrosTx ? ` title="${montoLabel}"` : '';

    return `
      <div class="transaction-list">
        <div class="transaction-list-header">
            <span class="transaction-count">${txVisibles.length} ${txVisibles.length === 1 ? 'transacción' : 'transacciones'}${totalPaginas > 1 ? ` · Pág. ${paginaActual + 1}/${totalPaginas}` : ''}</span>
            <div class="sort-btn-group">
              <button class="sort-btn btn-icon" data-action="sortFecha" data-category-id="${category.id}"${fechaTitleAttr}>
                <i data-lucide="${fechaIcon}"></i>
              </button>
              <button class="sort-btn btn-icon${montoClass}" data-action="sortMonto" data-category-id="${category.id}"${montoTitleAttr}>
                <i data-lucide="${montoIcon}"></i>
              </button>
            </div>
          </div>
        ${txPagina.map(t => `
          <div class="transaction-item">
            <div class="transaction-item-header">
              <div class="transaction-amount ${t.type}" title="${t.type === 'income' ? 'Ingreso: ' : 'Gasto: '}${formatCurrency(t.amount)}">
                <span class="tx-type-badge ${t.type}" aria-hidden="true">
                  <i data-lucide="${t.type === 'income' ? 'arrow-up' : 'arrow-down'}"></i>
                </span>
                <span>${formatCurrency(t.amount)}</span>
              </div>
              <div class="transaction-actions">
                <button class="btn-icon" data-action="editarTransaccion" data-category-id="${category.id}" data-transaction-id="${t.id}" aria-label="Editar transacción de ${esc(category.name)}"><i data-lucide="pencil"></i></button>
                <button class="btn-icon" data-action="eliminarTransaccion" data-category-id="${category.id}" data-transaction-id="${t.id}" aria-label="Eliminar transacción de ${esc(category.name)}"><i data-lucide="trash-2"></i></button>
              </div>
            </div>
            <div class="transaction-desc" title="${esc(t.description || 'Sin descripción')}">${esc(t.description || 'Sin descripción')}</div>
            <div class="transaction-date">${formatDate(t.date)}</div>
          </div>
        `).join('')}
        ${totalPaginas > 1 ? `
          <div class="tx-pagination">
            <button class="btn-icon tx-page-btn" data-action="txPrevPage" data-category-id="${category.id}" ${paginaActual === 0 ? 'disabled' : ''} aria-label="Página anterior"><i data-lucide="chevron-left"></i></button>
            <span class="tx-page-info">${paginaActual + 1} / ${totalPaginas}</span>
            <button class="btn-icon tx-page-btn" data-action="txNextPage" data-category-id="${category.id}" ${paginaActual >= totalPaginas - 1 ? 'disabled' : ''} aria-label="Página siguiente"><i data-lucide="chevron-right"></i></button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function actualizarTransaccionesDeTarjeta(catId) {
    const categories = getCategories();
    const category = categories.find(c => String(c.id) === String(catId));
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (!category || !categoriesContainer) {
      renderizarCategorias();
      return;
    }
    const card = categoriesContainer.querySelector(`.category-card[data-category-id="${catId}"]`);
    if (!card) {
      renderizarCategorias();
      return;
    }
    const oldTxList = card.querySelector('.transaction-list');
    if (!oldTxList) {
      renderizarCategorias();
      return;
    }

    const categoriasFiltradas = config.aplicarFiltrosACategorias ? config.aplicarFiltrosACategorias() : categories;
    const catFiltrada = categoriasFiltradas.find(c => String(c.id) === String(catId));
    const transacciones = catFiltrada ? catFiltrada.transactions : [];

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = generarHtmlListaTransacciones(category, transacciones).trim();
    const newTxList = tempDiv.firstElementChild;

    oldTxList.replaceWith(newTxList);
    window.LucideHelper?.refresh(newTxList);
  }

  function configurarListenersCategoria(tarjeta, categoryId) {
    const toggleCategoriaCompacta = () => {
      if (!window.matchMedia('(max-width: 980px)').matches) return;
      tarjeta.classList.toggle('mobile-collapsed');
      if (tarjeta.classList.contains('mobile-collapsed')) {
        expandedCategoryIds.delete(categoryId);
      } else {
        expandedCategoryIds.add(categoryId);
      }
    };

    const encabezadoCategoria = tarjeta.querySelector('.category-header');
    if (encabezadoCategoria) {
      encabezadoCategoria.addEventListener('click', function (e) {
        if (e.target.closest('.category-menu-wrapper') || e.target.closest('.category-drag-handle')) {
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        toggleCategoriaCompacta();
      });
    }

    tarjeta.addEventListener('click', function (e) {
      let target = e.target;
      while (target && !target.getAttribute('data-action') && !target.classList.contains('category-menu-btn') && target !== tarjeta) {
        target = target.parentElement;
      }

      if (!target) return;

      const action = target.getAttribute('data-action');
      const catId = parseInt(target.getAttribute('data-category-id'), 10) || categoryId;

      if (!e.target.closest('.category-menu-wrapper')) {
        document.querySelectorAll('.category-menu.active').forEach(m => m.classList.remove('active'));
      }

      e.stopPropagation();
      e.preventDefault();

      if (target.classList.contains('category-menu-btn')) {
        if (config.alternarMenuCategoria) config.alternarMenuCategoria(categoryId);
        return;
      }

      if (!action) return;

      if (target.classList.contains('category-menu-item')) {
        const menu = document.getElementById(`category-menu-${catId}`);
        if (menu) menu.classList.remove('active');

        if (action === 'alternarFijado' && config.alternarFijado) config.alternarFijado(catId);
        else if (action === 'editarCategoria' && config.mostrarModalEditarCategoria) config.mostrarModalEditarCategoria(catId);
        else if (action === 'limpiarTransacciones' && config.limpiarTransaccionesCategoria) config.limpiarTransaccionesCategoria(catId);
        else if (action === 'eliminarCategoria' && config.mostrarModalEliminarCategoria) config.mostrarModalEliminarCategoria(catId);
        return;
      }

      if (action === 'agregarTransaccion') {
        if (config.agregarTransaccion) config.agregarTransaccion(categoryId);
        return;
      }

      if (action === 'toggleTransactions') {
        const card = target.closest('.category-card');
        if (card) {
          const currentCatId = card.getAttribute('data-category-id') || categoryId;
          const currentCat = (config.obtenerCategoriasMostradas ? config.obtenerCategoriasMostradas() : getCategories()).find(c => String(c.id) === String(currentCatId));
          const txCount = currentCat && currentCat.transactions ? currentCat.transactions.length : 0;
          if (txCount === 0) return;

          const isCurrentlyExpanded = card.classList.contains('tx-expanded');

          document.querySelectorAll('.category-card.tx-expanded').forEach(otherCard => {
            if (otherCard !== card) {
              otherCard.classList.remove('tx-expanded');
              const otherIcon = otherCard.querySelector('.compact-toggle-btn i, .compact-toggle-btn svg');
              if (otherIcon) {
                otherIcon.setAttribute('data-lucide', 'chevron-down');
                window.LucideHelper?.refresh(otherCard.querySelector('.compact-toggle-btn'));
              }
            }
          });

          compactExpandedCategoryIds.clear();

          card.classList.toggle('tx-expanded', !isCurrentlyExpanded);
          if (!isCurrentlyExpanded && currentCatId != null) {
            compactExpandedCategoryIds.add(String(currentCatId));
          }
          const icon = target.querySelector('i, svg');
          if (icon) {
            icon.setAttribute('data-lucide', !isCurrentlyExpanded ? 'chevron-up' : 'chevron-down');
            window.LucideHelper?.refresh(target);
          }
        }
        return;
      }

      if (action === 'abrirSelectorFecha') {
        if (config.abrirSelectorFecha) config.abrirSelectorFecha(categoryId);
        return;
      }

      if (action === 'editarTransaccion' || action === 'eliminarTransaccion') {
        const transactionIdRaw = target.getAttribute('data-transaction-id');
        const transactionId = isNaN(parseInt(transactionIdRaw, 10)) ? transactionIdRaw : parseInt(transactionIdRaw, 10);

        if (action === 'editarTransaccion' && config.editarTransaccion) {
          config.editarTransaccion(catId, transactionId);
        } else if (action === 'eliminarTransaccion' && config.eliminarTransaccion) {
          const itemEl = target.closest('.transaction-item');
          if (itemEl) {
            itemEl.classList.add('is-deleting');
            setTimeout(() => config.eliminarTransaccion(catId, transactionId), 220);
          } else {
            config.eliminarTransaccion(catId, transactionId);
          }
        }
        return;
      }

      if (action === 'sortFecha') {
        const current = sortFechaCategorias.get(catId) || 'newest';
        sortFechaCategorias.set(catId, current === 'newest' ? 'oldest' : 'newest');
        if (config.guardarSort) config.guardarSort();
        actualizarTransaccionesDeTarjeta(catId);
        return;
      }

      if (action === 'sortMonto') {
        const current = sortMontoCategorias.get(catId) || 'off';
        const next = current === 'off' ? 'amount-desc' : current === 'amount-desc' ? 'amount-asc' : 'off';
        sortMontoCategorias.set(catId, next);
        if (config.guardarSort) config.guardarSort();
        actualizarTransaccionesDeTarjeta(catId);
        return;
      }

      if (action === 'txPrevPage') {
        const current = paginaCategorias.get(catId) || 0;
        if (current > 0) {
          paginaCategorias.set(catId, current - 1);
          actualizarTransaccionesDeTarjeta(catId);
        }
        return;
      }

      if (action === 'txNextPage') {
        const current = paginaCategorias.get(catId) || 0;
        paginaCategorias.set(catId, current + 1);
        actualizarTransaccionesDeTarjeta(catId);
        return;
      }

      if (action === 'toggleCollapse') {
        toggleCategoriaCompacta();
      }
    });
  }

  function renderizarCategorias() {
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (!categoriesContainer) return;

    if (!categoriesContainer._menuDelegationBound) {
      categoriesContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-menu-btn, .category-menu-item');
        if (!btn) return;
        const catId = btn.getAttribute('data-category-id') || btn.closest('.category-card')?.getAttribute('data-category-id');
        if (!catId) return;
        if (btn.classList.contains('category-menu-btn')) {
          if (config.alternarMenuCategoria) config.alternarMenuCategoria(catId);
          e.preventDefault();
          return;
        }
        const action = btn.getAttribute('data-action');
        const menu = document.getElementById(`category-menu-${catId}`);
        if (menu) menu.classList.remove('active');
        switch (action) {
          case 'alternarFijado': if (config.alternarFijado) config.alternarFijado(catId); break;
          case 'editarCategoria': if (config.mostrarModalEditarCategoria) config.mostrarModalEditarCategoria(catId); break;
          case 'limpiarTransacciones': if (config.limpiarTransaccionesCategoria) config.limpiarTransaccionesCategoria(catId, btn); break;
          case 'eliminarCategoria': if (config.mostrarModalEliminarCategoria) config.mostrarModalEliminarCategoria(catId); break;
        }
        e.preventDefault();
      });
      categoriesContainer._menuDelegationBound = true;
    }

    if (config.actualizarIndicadorFiltros) config.actualizarIndicadorFiltros();

    categoriesContainer.querySelectorAll('.category-card.tx-expanded').forEach(card => {
      const id = card.getAttribute('data-category-id');
      if (id != null) compactExpandedCategoryIds.add(String(id));
    });

    categoriesContainer.innerHTML = '';
    const categories = getCategories();

    if (categories.length === 0) {
      categoriesContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="tags"></i>
          <p>No hay categorías creadas. Agrega tu primera categoría.</p>
        </div>
      `;
      window.LucideHelper?.refresh(categoriesContainer);
      if (config.actualizarResumenFinanciero) config.actualizarResumenFinanciero();
      return;
    }

    const categoriasFiltradas = config.aplicarFiltrosACategorias ? config.aplicarFiltrosACategorias() : categories;
    const filtrosActuales = getFiltros();
    const hasSearchTerm = Boolean(filtrosActuales.searchTerm && filtrosActuales.searchTerm.trim() !== '');

    let categoriasParaMostrar = config.obtenerCategoriasMostradas ? config.obtenerCategoriasMostradas() : categories;

    // Solo si hay una búsqueda de texto activa se filtran las categorías mostradas
    if (hasSearchTerm) {
      const term = filtrosActuales.searchTerm.trim().toLowerCase();
      categoriasParaMostrar = categoriasParaMostrar.filter(c => {
        const nameMatches = (c.name || '').toLowerCase().includes(term);
        const catFiltrada = categoriasFiltradas.find(cf => cf.id === c.id);
        const hasMatchingTx = catFiltrada && catFiltrada.transactions && catFiltrada.transactions.length > 0;
        return nameMatches || hasMatchingTx;
      });

      if (categoriasParaMostrar.length === 0) {
        categoriesContainer.innerHTML = `
          <div class="empty-state">
            <i data-lucide="filter"></i>
            <p>No se encontraron resultados para la búsqueda "${esc(filtrosActuales.searchTerm)}".</p>
          </div>
        `;
        window.LucideHelper?.refresh(categoriesContainer);
        if (config.actualizarResumenFinanciero) config.actualizarResumenFinanciero();
        return;
      }
    }

    let viewMode = 'compact';
    try {
      const rawSettings = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
      if (rawSettings.categoryViewMode === 'extended') viewMode = 'extended';
    } catch (_) {}

    const filtradasMap = new Map(categoriasFiltradas.map(c => [c.id, c]));

    categoriasParaMostrar.forEach((category, cardIndex) => {
      const categoriaFiltrada = filtradasMap.get(category.id);
      const transaccionesFiltradas = categoriaFiltrada ? (categoriaFiltrada.transactions || []) : [];

      let totalIngresos = 0;
      let totalGastos = 0;
      for (let i = 0; i < transaccionesFiltradas.length; i++) {
        const t = transaccionesFiltradas[i];
        if (t.type === 'income') totalIngresos += t.amount;
        else if (t.type === 'expense') totalGastos += t.amount;
      }

      const controlesTipoHtml = category.fixedType
        ? `<div class="form-group"><div class="type-chip ${category.fixedType}">${category.fixedType === 'income' ? 'Ingreso' : 'Gasto'}</div></div>`
        : `
          <div class="form-group">
            <div class="transaction-type-selector" id="transaction-type-${category.id}">
              <button type="button" class="transaction-type-btn" data-value="income">
                <i data-lucide="arrow-up"></i>
                <span>Ingreso</span>
              </button>
              <button type="button" class="transaction-type-btn" data-value="expense">
                <i data-lucide="arrow-down"></i>
                <span>Gasto</span>
              </button>
            </div>
            <div class="inline-warning" id="type-warning-${category.id}">Por favor, elige un tipo de transacción</div>
          </div>
        `;

      const txVisibles = category.fixedType
        ? transaccionesFiltradas.filter(t => t.type === category.fixedType)
        : transaccionesFiltradas;

      const tarjeta = document.createElement('div');
      const isExpanded = expandedCategoryIds.has(category.id);

      if (txVisibles.length === 0) {
        compactExpandedCategoryIds.delete(String(category.id));
      }
      const isCompactTxExpanded = viewMode === 'compact' && txVisibles.length > 0 && compactExpandedCategoryIds.has(String(category.id));

      tarjeta.className = `category-card fade-in${category.isPinned ? ' pinned' : ''}${viewMode === 'compact' ? ' compact-mode' : (isExpanded ? '' : ' mobile-collapsed')}${isCompactTxExpanded ? ' tx-expanded' : ''}`;
      tarjeta.setAttribute('data-category-id', category.id);
      tarjeta.style.animationDelay = `${cardIndex * 45}ms`;

      tarjeta.innerHTML = `
        <div class="category-header">
          <button
            class="category-drag-handle btn-icon"
            type="button"
            title="Arrastrar para reordenar"
            aria-label="Arrastrar para reordenar"
            ${category.isPinned ? 'disabled' : ''}
          >
            <i data-lucide="grip-vertical" aria-hidden="true"></i>
          </button>
          <div class="category-name">${esc(category.name)}</div>
          
          <div class="category-menu-wrapper">
            <button
              class="category-menu-btn btn-icon"
              type="button"
              title="Opciones"
              aria-label="Opciones de categoría"
              data-category-id="${category.id}"
            >
              <i data-lucide="more-vertical" aria-hidden="true"></i>
            </button>
            
            <div class="category-menu" id="category-menu-${category.id}">
              <button
                class="category-menu-item ${category.isPinned ? 'pin-on' : ''}"
                data-action="alternarFijado"
                data-category-id="${category.id}"
              >
                <i data-lucide="pin"></i>
                ${category.isPinned ? 'Desfijar' : 'Fijar categoría'}
              </button>
              <button
                class="category-menu-item"
                data-action="editarCategoria"
                data-category-id="${category.id}"
              >
                <i data-lucide="pencil"></i>
                Renombrar
              </button>
              <button
                class="category-menu-item"
                data-action="limpiarTransacciones"
                data-category-id="${category.id}"
              >
                <i data-lucide="eraser"></i>
                Limpiar transacciones
              </button>
              <button
                class="category-menu-item"
                data-action="eliminarCategoria"
                data-category-id="${category.id}"
              >
                <i data-lucide="trash-2"></i>
                Eliminar categoría
              </button>
            </div>
          </div>
        </div>

        <div class="category-stats alt">
          <div class="ie-summary">
            ${category.fixedType === 'income' ? `
              <div class="amount-chip income" title="Ingresos">
                <i data-lucide="arrow-up" aria-hidden="true"></i>
                ${formatCurrency(totalIngresos)}
              </div>
            ` : category.fixedType === 'expense' ? `
              <div class="amount-chip expense" title="Total Gastos: ${formatCurrency(totalGastos)}">
                <i data-lucide="arrow-down" aria-hidden="true"></i>
                ${formatCurrency(totalGastos)}
              </div>
            ` : `
              <div class="amount-chip income" title="Total Ingresos: ${formatCurrency(totalIngresos)}">
                <i data-lucide="arrow-up" aria-hidden="true"></i>
                ${formatCurrency(totalIngresos)}
              </div>
              <div class="amount-chip expense" title="Total Gastos: ${formatCurrency(totalGastos)}">
                <i data-lucide="arrow-down" aria-hidden="true"></i>
                ${formatCurrency(totalGastos)}
              </div>
            `}
          </div>
        </div>

        <div class="category-details">
        <div class="transaction-form">
          ${controlesTipoHtml}
          <div class="form-group">
            <input type="text" class="form-control" id="transaction-amount-${category.id}" placeholder="Monto" inputmode="decimal" aria-label="Monto para ${esc(category.name)}">
            <div class="warning-message" id="amount-digit-warning-${category.id}">${MSG_MAX_DIGITS}</div>
            <div class="inline-warning" id="amount-error-${category.id}">Por favor, ingresa un monto válido</div>
          </div>
          <div class="form-group">
            <input type="text" class="form-control" id="transaction-desc-${category.id}" placeholder="Descripción (opcional)" maxlength="80" aria-label="Descripción para ${esc(category.name)}">
          </div>
          <div class="form-group">
            <div class="date-picker-wrapper">
              <input type="text" class="form-control date-picker-input" id="transaction-date-${category.id}" placeholder="Seleccionar fecha" readonly aria-label="Fecha para ${esc(category.name)}">
              <button type="button" class="date-picker-btn" data-action="abrirSelectorFecha" data-category-id="${category.id}">
                <i data-lucide="calendar"></i>
              </button>
            </div>
            <div class="inline-warning" id="date-error-${category.id}">Por favor, ingresa una fecha válida</div>
          </div>
          <button class="btn btn-primary" style="width: 100%;" data-action="agregarTransaccion" data-category-id="${category.id}" aria-label="Agregar transacción a ${esc(category.name)}">Agregar Transacción</button>
        </div>

        ${(viewMode === 'compact' && txVisibles.length > 0) ? `
        <div class="compact-tx-toggle" style="margin-top: 10px; text-align: center;">
          <button class="btn btn-secondary btn-sm compact-toggle-btn" style="width: 100%; padding: 8px; border-radius: 8px; font-weight: 500;" data-action="toggleTransactions" data-category-id="${category.id}">
            <i data-lucide="${isCompactTxExpanded ? 'chevron-up' : 'chevron-down'}"></i> Ver transacciones (${txVisibles.length})
          </button>
        </div>
        ` : ''}

        ${generarHtmlListaTransacciones(category, transaccionesFiltradas, txVisibles)}
        </div>
      `;

      const handleEl = tarjeta.querySelector('.category-drag-handle');
      if (handleEl) {
        handleEl.setAttribute('draggable', String(!category.isPinned));
        handleEl.addEventListener('dragstart', (e) => {
          if (category.isPinned) {
            e.preventDefault();
            return;
          }
          dragCategoryId = category.id;
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', String(category.id)); } catch (_) {}
          }
        });
      }

      tarjeta.addEventListener('dragover', (e) => {
        if (!dragCategoryId) return;
        const dragCat = categories.find(c => c.id === dragCategoryId);
        if (!dragCat) return;
        if (dragCat.isPinned !== category.isPinned) return;
        e.preventDefault();
        tarjeta.classList.add('drag-over');
      });

      tarjeta.addEventListener('dragleave', () => { tarjeta.classList.remove('drag-over'); });

      tarjeta.addEventListener('drop', async (e) => {
        e.preventDefault();
        tarjeta.classList.remove('drag-over');

        const targetId = category.id;
        if (!dragCategoryId || dragCategoryId === targetId) return;

        const displayed = config.obtenerCategoriasMostradas ? config.obtenerCategoriasMostradas() : categories;
        const isPinnedGroup = category.isPinned;

        let pinnedCats = displayed.filter(c => c.isPinned);
        let unpinnedCats = displayed.filter(c => !c.isPinned);
        let group = isPinnedGroup ? pinnedCats.slice() : unpinnedCats.slice();

        const from = group.findIndex(c => c.id === dragCategoryId);
        const to = group.findIndex(c => c.id === targetId);
        if (from === -1 || to === -1) return;

        const [moved] = group.splice(from, 1);
        group.splice(to, 0, moved);

        if (isPinnedGroup) pinnedCats = group; else unpinnedCats = group;

        if (config.setCategories) {
          config.setCategories([...pinnedCats, ...unpinnedCats]);
        }

        dragCategoryId = null;
        renderizarCategorias();
        if (config.renderizarGraficos) config.renderizarGraficos();
        if (config.marcarCambioDatos) config.marcarCambioDatos();
        if (config.persist) await config.persist();
      });

      categoriesContainer.appendChild(tarjeta);
      configurarListenersCategoria(tarjeta, category.id);

      if (!category.fixedType) {
        const transactionTypeSelector = tarjeta.querySelector(`#transaction-type-${category.id}`);
        const typeWarning = document.getElementById(`type-warning-${category.id}`);

        if (transactionTypeSelector && typeWarning) {
          typeWarning.style.display = 'none';
          const buttons = transactionTypeSelector.querySelectorAll('.transaction-type-btn');
          buttons.forEach(button => {
            button.addEventListener('click', () => {
              buttons.forEach(btn => btn.classList.remove('active'));
              button.classList.add('active');
              typeWarning.style.display = 'none';
            });
          });
        }
      }

      const amountInput = document.getElementById(`transaction-amount-${category.id}`);
      const descInput = document.getElementById(`transaction-desc-${category.id}`);
      const dateInput = document.getElementById(`transaction-date-${category.id}`);
      const amountDigitWarning = document.getElementById(`amount-digit-warning-${category.id}`);
      const amountError = document.getElementById(`amount-error-${category.id}`);
      const dateError = document.getElementById(`date-error-${category.id}`);

      if (amountDigitWarning) amountDigitWarning.style.display = 'none';
      if (amountError) amountError.style.display = 'none';
      if (dateError) dateError.style.display = 'none';

      if (dateInput) {
        dateInput.value = formatDate(new Date());
      }

      if (amountInput) {
        amountInput.addEventListener('input', function () {
          const caret = this.selectionStart;
          const before = this.value;
          const formatted = formatInputAmountEs(before);
          this.value = formatted;
          const diff = this.value.length - before.length;
          try { this.setSelectionRange(caret + diff, caret + diff); } catch {}
          if (amountDigitWarning) amountDigitWarning.style.display = 'none';
          if (this.value.trim() !== '' && amountError) amountError.style.display = 'none';
        });

        const submitOnEnter = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (config.agregarTransaccion) config.agregarTransaccion(category.id);
          }
        };
        amountInput.addEventListener('keydown', submitOnEnter);
        if (descInput) descInput.addEventListener('keydown', submitOnEnter);
        if (dateInput) dateInput.addEventListener('keydown', submitOnEnter);
      }
    });

    window.LucideHelper?.refresh(categoriesContainer);
    if (config.actualizarResumenFinanciero) config.actualizarResumenFinanciero();
  }

  return {
    init,
    generarHtmlListaTransacciones,
    actualizarTransaccionesDeTarjeta,
    configurarListenersCategoria,
    renderizarCategorias,
    sortFechaCategorias,
    sortMontoCategorias,
    paginaCategorias,
    expandedCategoryIds,
    compactExpandedCategoryIds
  };
});
