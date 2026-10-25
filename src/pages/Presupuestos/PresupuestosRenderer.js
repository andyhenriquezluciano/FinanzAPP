/**
 * FinanzApp - Presupuestos Renderer Module
 * Single Responsibility: Renderizado de tarjetas de presupuestos, tabla paginada, ordenamiento y búsqueda en tabla.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PresupuestosRenderer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let config = {};
  let paginaActual = 1;
  const itemsPorPagina = (typeof window !== 'undefined' && window.__appTxPerPage) || 10;
  let ordenTabla = {
    key: null,
    direction: 'asc'
  };

  function init(options) {
    config = options || {};
    return {
      renderizarTarjetasPresupuestos,
      renderizarTabla,
      configurarOrdenTabla,
      actualizarIndicadoresOrdenTabla,
      buscarEnTabla,
      cambiarPagina,
      getBudgetDisplayName,
      getPeriodText,
      obtenerIconoCategoria,
      getOrdenTabla: () => ordenTabla,
      getPaginaActual: () => paginaActual,
      setPaginaActual: (p) => { paginaActual = p; }
    };
  }

  function getElementos() {
    return typeof config.getElementos === 'function' ? config.getElementos() : {};
  }

  function getCategories() {
    return typeof config.getCategories === 'function' ? config.getCategories() : [];
  }

  function getFilteredBudgets() {
    return typeof config.getFilteredBudgets === 'function' ? config.getFilteredBudgets() : [];
  }

  function calcularGastado(budget) {
    return typeof config.calcularGastado === 'function' ? config.calcularGastado(budget) : 0;
  }

  function formatCurrency(amount) {
    if (typeof config.formatCurrency === 'function') return config.formatCurrency(amount);
    return window.Core?.helpers?.formatCurrency ? window.Core.helpers.formatCurrency(amount) : `$${Number(amount || 0).toFixed(2)}`;
  }

  function formatDate(date) {
    if (typeof config.formatDate === 'function') return config.formatDate(date);
    return window.Core?.helpers?.formatDate ? window.Core.helpers.formatDate(date) : (date instanceof Date ? date.toISOString().split('T')[0] : '');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function getPeriodText(period) {
    const periods = {
      'weekly': 'Semanal',
      'biweekly': 'Quincenal',
      'monthly': 'Mensual',
      'yearly': 'Anual',
      'custom': 'Personalizado'
    };
    return periods[period] || period;
  }

  function getBudgetDisplayName(budget, categoria = null) {
    const fallback = String(categoria?.name || 'Sin categoría').trim() || 'Sin categoría';
    const rawName = String(budget?.name || '').trim();
    if (!rawName) return fallback;

    return rawName.replace(
      /\s*[·\-|]\s*(Semanal|Quincenal|Mensual|Anual|Personalizado|weekly|biweekly|monthly|yearly|custom)\s*$/i,
      ''
    ).trim() || fallback;
  }

  function obtenerIconoCategoria(nombre) {
    if (window.LucideHelper?.getCategoryIcon) {
      return window.LucideHelper.getCategoryIcon(nombre);
    }
    const n = (nombre || '').toLowerCase();
    if (n.includes('aliment') || n.includes('comida') || n.includes('restaur') || n.includes('super') || n.includes('cena') || n.includes('almuerz')) return 'utensils';
    if (n.includes('transp') || n.includes('gasolin') || n.includes('vehic') || n.includes('auto') || n.includes('carro') || n.includes('uber') || n.includes('taxi') || n.includes('combust')) return 'car';
    if (n.includes('vivien') || n.includes('casa') || n.includes('hogar') || n.includes('alquiler') || n.includes('renta') || n.includes('hipotec')) return 'home';
    if (n.includes('servici') || n.includes('luz') || n.includes('agua') || n.includes('electr') || n.includes('internet') || n.includes('gas') || n.includes('telef')) return 'zap';
    if (n.includes('salud') || n.includes('medic') || n.includes('farmac') || n.includes('doctor') || n.includes('hospital') || n.includes('dent') || n.includes('seguro')) return 'activity';
    if (n.includes('educ') || n.includes('estudio') || n.includes('curso') || n.includes('univers') || n.includes('coleg') || n.includes('libro')) return 'graduation-cap';
    if (n.includes('entreten') || n.includes('ocio') || n.includes('divers') || n.includes('cine') || n.includes('juego') || n.includes('stream') || n.includes('netflix') || n.includes('spotify')) return 'gamepad-2';
    if (n.includes('ropa') || n.includes('vest') || n.includes('calzado') || n.includes('moda') || n.includes('zapat')) return 'shirt';
    if (n.includes('ahorro') || n.includes('invers') || n.includes('fondo') || n.includes('banco')) return 'piggy-bank';
    if (n.includes('viaje') || n.includes('vacac') || n.includes('hotel') || n.includes('vuelo')) return 'plane';
    if (n.includes('mascota') || n.includes('veterin') || n.includes('perro') || n.includes('gato')) return 'paw-print';
    if (n.includes('trabajo') || n.includes('negoc') || n.includes('oficin') || n.includes('emprend')) return 'briefcase';
    if (n.includes('gym') || n.includes('depor') || n.includes('fit') || n.includes('ejercic')) return 'dumbbell';
    if (n.includes('compra') || n.includes('shopping') || n.includes('tienda')) return 'shopping-bag';
    return 'wallet';
  }

  function renderizarTarjetasPresupuestos() {
    const el = getElementos();
    const container = el.budgetsContainer || document.getElementById('budgetsContainer');
    if (!container) return;

    const presupuestosFiltrados = getFilteredBudgets();

    if (presupuestosFiltrados.length === 0) {
      const filtros = typeof config.getFiltros === 'function' ? config.getFiltros() : {};
      const hayFiltros = (filtros.year !== null && filtros.year !== '') || (filtros.month !== null && filtros.month !== '');
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="${hayFiltros ? 'filter' : 'receipt'}"></i>
          <p>${hayFiltros ? 'No se encontraron presupuestos para los filtros seleccionados.' : 'No hay presupuestos creados'}</p>
        </div>
      `;
      window.LucideHelper?.refresh(container);
      return;
    }

    container.innerHTML = '';
    const categories = getCategories();

    presupuestosFiltrados.forEach(budget => {
      const gastado = calcularGastado(budget);
      const restante = budget.amount - gastado;
      const progreso = budget.amount > 0 ? (gastado / budget.amount) * 100 : 0;
      const categoria = categories.find(c => String(c.id) === String(budget.categoryId));

      let statusClass = 'success';
      if (progreso > 100) {
        statusClass = 'danger';
      } else if (progreso > 80) {
        statusClass = 'warning';
      }

      const catDisplayName = escapeHtml(getBudgetDisplayName(budget, categoria));
      const isExceeded = restante < 0;

      let dateRangeText = '';
      if (budget.startDate && budget.endDate) {
        dateRangeText = `${formatDate(new Date(budget.startDate))} - ${formatDate(new Date(budget.endDate))}`;
      } else {
        const now = new Date();
        let sDate, eDate;
        if (budget.period === 'weekly') {
          const day = now.getDay();
          const diffToMonday = day === 0 ? -6 : 1 - day;
          sDate = new Date(now);
          sDate.setDate(now.getDate() + diffToMonday);
          eDate = new Date(sDate);
          eDate.setDate(sDate.getDate() + 6);
        } else if (budget.period === 'biweekly') {
          const day = now.getDay();
          const diffToMonday = day === 0 ? -6 : 1 - day;
          sDate = new Date(now);
          sDate.setDate(now.getDate() + diffToMonday);
          eDate = new Date(sDate);
          eDate.setDate(sDate.getDate() + 13);
        } else if (budget.period === 'yearly') {
          sDate = new Date(now.getFullYear(), 0, 1);
          eDate = new Date(now.getFullYear(), 11, 31);
        } else {
          sDate = new Date(now.getFullYear(), now.getMonth(), 1);
          eDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        dateRangeText = `${formatDate(sDate)} - ${formatDate(eDate)}`;
      }

      const card = document.createElement('div');
      card.className = `budget-card ${isExceeded ? 'budget-exceeded' : ''}`;
      card.innerHTML = `
        <div class="card-top">
          <div class="category-info-box">
            <h3 class="category-title" title="${catDisplayName}">
              ${catDisplayName}
            </h3>
            ${dateRangeText ? `
              <div class="budget-custom-duration">
                <i data-lucide="calendar"></i>
                <span>${dateRangeText}</span>
              </div>
            ` : ''}
          </div>
          <span class="period-chip">${getPeriodText(budget.period)}</span>
        </div>

        <div class="budget-stats">
          <div class="budget-hero-stat">
            <span class="hero-label">${isExceeded ? 'Excedido por' : 'Restante'}</span>
            <strong class="hero-value ${isExceeded ? 'stat-negative' : 'stat-positive'}">
              ${formatCurrency(isExceeded ? Math.abs(restante) : restante)}
            </strong>
          </div>

          <div class="budget-dual-stats">
            <div class="dual-stat-item">
              <span class="dual-label">Presupuestado</span>
              <strong class="dual-value stat-budgeted">${formatCurrency(budget.amount)}</strong>
            </div>
            <div class="dual-stat-divider"></div>
            <div class="dual-stat-item">
              <span class="dual-label">Gastado</span>
              <strong class="dual-value stat-spent">${formatCurrency(gastado)}</strong>
            </div>
          </div>
        </div>
      `;

      card.insertAdjacentHTML('beforeend', `
        <div class="progress-section">
          <div class="progress-header">
            <span>Progreso</span>
            <span class="progress-percentage ${statusClass}">${Math.min(progreso, 100).toFixed(1)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${statusClass}" style="width: ${Math.min(progreso, 100)}%"></div>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn btn-icon btn-sync app-tooltip" data-tooltip="Sincronizar" data-id="${budget.id}">
            <i data-lucide="refresh-cw"></i>
          </button>
          <button type="button" class="btn btn-icon btn-edit app-tooltip" data-tooltip="Editar" data-id="${budget.id}">
            <i data-lucide="pencil"></i>
          </button>
          <button type="button" class="btn btn-icon btn-delete app-tooltip" data-tooltip="Eliminar" data-id="${budget.id}">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `);

      const btnSync = card.querySelector('.btn-sync');
      const btnEdit = card.querySelector('.btn-edit');
      const btnDelete = card.querySelector('.btn-delete');
      if (btnSync && typeof config.sincronizarPresupuesto === 'function') {
        btnSync.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); config.sincronizarPresupuesto(budget.id); });
      }
      if (btnEdit && typeof config.editarPresupuesto === 'function') {
        btnEdit.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); config.editarPresupuesto(budget.id); });
      }
      if (btnDelete && typeof config.eliminarPresupuesto === 'function') {
        btnDelete.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); config.eliminarPresupuesto(budget.id); });
      }

      container.appendChild(card);
    });

    window.LucideHelper?.refresh(container);
  }

  function renderizarTabla() {
    const el = getElementos();
    const tbody = el.budgetsTableBody || document.getElementById('budgetsTableBody');
    if (!tbody) return;

    const searchInput = el.budgetTableSearch || document.getElementById('budgetTableSearch');
    const term = (searchInput?.value || '').trim().toLowerCase();
    const categories = getCategories();

    let filasTabla = getFilteredBudgets().map(budget => {
      const gastado = calcularGastado(budget);
      const restante = budget.amount - gastado;
      const progreso = budget.amount > 0 ? (gastado / budget.amount) * 100 : 0;
      const categoria = categories.find(c => String(c.id) === String(budget.categoryId));

      return {
        budget,
        categoriaNombre: categoria?.name || 'Sin categoría',
        gastado,
        restante,
        progreso
      };
    });

    if (term) {
      filasTabla = filasTabla.filter(item => {
        const texto = [
          getBudgetDisplayName(item.budget, { name: item.categoriaNombre }),
          item.categoriaNombre,
          getPeriodText(item.budget.period),
          formatCurrency(item.budget.amount),
          formatCurrency(item.gastado),
          formatCurrency(item.restante)
        ].join(' ').toLowerCase();

        return texto.includes(term);
      });
    }

    if (ordenTabla.key) {
      const multiplier = ordenTabla.direction === 'asc' ? 1 : -1;

      filasTabla.sort((a, b) => {
        switch (ordenTabla.key) {
          case 'name':
            return getBudgetDisplayName(a.budget, { name: a.categoriaNombre })
              .localeCompare(getBudgetDisplayName(b.budget, { name: b.categoriaNombre }), 'es') * multiplier;
          case 'category':
            return a.categoriaNombre.localeCompare(b.categoriaNombre, 'es') * multiplier;
          case 'amount':
            return (a.budget.amount - b.budget.amount) * multiplier;
          case 'spent':
            return (a.gastado - b.gastado) * multiplier;
          case 'remaining':
            return (a.restante - b.restante) * multiplier;
          case 'progress':
            return (a.progreso - b.progreso) * multiplier;
          default:
            return 0;
        }
      });
    }

    const totalItems = filasTabla.length;

    if (totalItems === 0) {
      const filtros = typeof config.getFiltros === 'function' ? config.getFiltros() : {};
      const hayFiltros = (filtros.year !== null && filtros.year !== '') || (filtros.month !== null && filtros.month !== '') || !!term;
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem;">
            ${hayFiltros ? 'No se encontraron presupuestos para los filtros seleccionados' : 'No hay presupuestos para mostrar'}
          </td>
        </tr>
      `;

      const budgetTableInfo = el.budgetTableInfo || document.getElementById('budgetTableInfo');
      if (budgetTableInfo) budgetTableInfo.textContent = 'Mostrando 0 de 0 presupuestos';

      const pageInfo = el.pageInfo || document.getElementById('pageInfo');
      if (pageInfo) pageInfo.textContent = 'Página 1 de 1';

      const prevBtn = el.prevPageBtn || document.getElementById('prevPageBtn');
      const nextBtn = el.nextPageBtn || document.getElementById('nextPageBtn');
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;

      return;
    }

    const totalPaginas = Math.max(1, Math.ceil(totalItems / itemsPorPagina));
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;
    if (paginaActual < 1) paginaActual = 1;

    const inicio = itemsPorPagina === Infinity ? 0 : (paginaActual - 1) * itemsPorPagina;
    const fin = itemsPorPagina === Infinity ? totalItems : Math.min(inicio + itemsPorPagina, totalItems);
    const filasPagina = filasTabla.slice(inicio, fin);

    tbody.innerHTML = '';

    filasPagina.forEach(item => {
      const { budget, categoriaNombre, gastado, restante, progreso } = item;

      let statusClass = 'success';
      if (progreso > 100) {
        statusClass = 'danger';
      } else if (progreso > 80) {
        statusClass = 'warning';
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(getBudgetDisplayName(budget, { name: categoriaNombre }))}</td>
        <td>${escapeHtml(categoriaNombre)}</td>
        <td>${formatCurrency(budget.amount)}</td>
        <td>${formatCurrency(gastado)}</td>
        <td class="${restante < 0 ? 'text-danger' : ''}">${formatCurrency(restante)}</td>
        <td>
          <div class="progress-bar-small">
            <div class="progress-fill ${statusClass}" style="width: ${Math.min(progreso, 100)}%"></div>
          </div>
          <span class="progress-text">${Math.min(progreso, 100).toFixed(1)}%</span>
        </td>
        <td>
          <button type="button" class="btn btn-sm btn-icon btn-sync app-tooltip" data-tooltip="Sincronizar" data-id="${budget.id}">
            <i data-lucide="refresh-cw"></i>
          </button>
          <button type="button" class="btn btn-sm btn-icon btn-edit app-tooltip" data-tooltip="Editar" data-id="${budget.id}">
            <i data-lucide="pencil"></i>
          </button>
          <button type="button" class="btn btn-sm btn-icon btn-delete app-tooltip" data-tooltip="Eliminar" data-id="${budget.id}">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      `;

      const btnSync = row.querySelector('.btn-sync');
      const btnEdit = row.querySelector('.btn-edit');
      const btnDelete = row.querySelector('.btn-delete');
      if (btnSync && typeof config.sincronizarPresupuesto === 'function') {
        btnSync.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); config.sincronizarPresupuesto(budget.id); });
      }
      if (btnEdit && typeof config.editarPresupuesto === 'function') {
        btnEdit.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); config.editarPresupuesto(budget.id); });
      }
      if (btnDelete && typeof config.eliminarPresupuesto === 'function') {
        btnDelete.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); config.eliminarPresupuesto(budget.id); });
      }

      tbody.appendChild(row);
    });

    window.LucideHelper?.refresh(tbody);

    const budgetTableInfo = el.budgetTableInfo || document.getElementById('budgetTableInfo');
    if (budgetTableInfo) budgetTableInfo.textContent = `Mostrando ${inicio + 1} a ${fin} de ${totalItems} presupuestos`;

    const pageInfo = el.pageInfo || document.getElementById('pageInfo');
    if (pageInfo) pageInfo.textContent = `Página ${paginaActual} de ${totalPaginas}`;

    const prevBtn = el.prevPageBtn || document.getElementById('prevPageBtn');
    if (prevBtn) prevBtn.disabled = paginaActual <= 1;

    const nextBtn = el.nextPageBtn || document.getElementById('nextPageBtn');
    if (nextBtn) nextBtn.disabled = paginaActual >= totalPaginas;
  }

  function configurarOrdenTabla() {
    const headers = document.querySelectorAll('#budgetsTable thead th.sortable');
    if (!headers.length) return;

    headers.forEach(header => {
      header.addEventListener('click', () => {
        const key = header.getAttribute('data-key');
        if (!key) return;

        if (ordenTabla.key === key) {
          ordenTabla.direction = ordenTabla.direction === 'asc' ? 'desc' : 'asc';
        } else {
          ordenTabla.key = key;
          ordenTabla.direction = 'asc';
        }

        paginaActual = 1;
        actualizarIndicadoresOrdenTabla();
        renderizarTabla();
      });
    });

    actualizarIndicadoresOrdenTabla();
  }

  function actualizarIndicadoresOrdenTabla() {
    const headers = document.querySelectorAll('#budgetsTable thead th.sortable');

    headers.forEach(header => {
      const icon = header.querySelector('.sort-icon');
      if (!icon) return;

      if (header.getAttribute('data-key') === ordenTabla.key) {
        icon.setAttribute('data-lucide', ordenTabla.direction === 'asc' ? 'arrow-up' : 'arrow-down');
        icon.style.opacity = '1';
      } else {
        icon.setAttribute('data-lucide', 'chevrons-up-down');
        icon.style.opacity = '0.35';
      }
      window.LucideHelper?.refresh(header);
    });
  }

  function buscarEnTabla() {
    paginaActual = 1;
    renderizarTabla();
  }

  function cambiarPagina(direccion) {
    const nuevaPagina = paginaActual + direccion;
    if (nuevaPagina < 1) return;
    paginaActual = nuevaPagina;
    renderizarTabla();
  }

  const PresupuestosRenderer = {
    init,
    renderizarTarjetasPresupuestos,
    renderizarTabla,
    configurarOrdenTabla,
    actualizarIndicadoresOrdenTabla,
    buscarEnTabla,
    cambiarPagina,
    getBudgetDisplayName,
    getPeriodText,
    obtenerIconoCategoria
  };

  if (typeof window !== 'undefined') window.PresupuestosRenderer = PresupuestosRenderer;
  if (typeof globalThis !== 'undefined') globalThis.PresupuestosRenderer = PresupuestosRenderer;

  return PresupuestosRenderer;
});

