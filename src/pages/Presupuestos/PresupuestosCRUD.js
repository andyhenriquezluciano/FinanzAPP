/**
 * FinanzApp - Presupuestos CRUD & Modals Module
 * Single Responsibility: Budget modal lifecycle, category/period selection, CRUD operations, and sync logic.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PresupuestosCRUD = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let config = {};
  let editingBudgetId = null;
  let activeDrawer = null;
  let drawerOverlay = null;

  function init(options) {
    config = options || {};
    return {
      poblarDropdownCategoriasModal,
      poblarDropdownPeriodoModal,
      abrirModalCrear,
      editarPresupuesto,
      actualizarSeleccionCategoria,
      actualizarSeleccionPeriodo,
      sincronizarPresupuesto,
      aplicarSincronizacion,
      eliminarPresupuesto,
      guardarPresupuesto,
      cerrarModal,
      mostrarModal,
      cerrarDrawer,
      mostrarBottomDrawer,
      getEditingBudgetId: () => editingBudgetId,
      setEditingBudgetId: (id) => { editingBudgetId = id; }
    };
  }

  function getEl() {
    return typeof config.getElementos === 'function' ? config.getElementos() : {};
  }

  function getDatos() {
    return typeof config.getDatosApp === 'function' ? config.getDatosApp() : { categories: [], budgets: [], transactions: [] };
  }

  function notifySuccess(msg) {
    if (typeof config.mostrarExito === 'function') {
      config.mostrarExito(msg);
    } else if (window.Toast) {
      window.Toast.success(msg);
    }
  }

  function notifyWarning(msg) {
    if (typeof config.mostrarAdvertencia === 'function') {
      config.mostrarAdvertencia(msg);
    } else if (window.Toast) {
      window.Toast.warning(msg);
    }
  }

  function formatInputDate(date) {
    if (window.Core?.helpers?.formatDate) return window.Core.helpers.formatDate(date);
    if (!date || !(date instanceof Date)) return '';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${date.getFullYear()}`;
  }

  function parseInputDate(raw) {
    if (window.Core?.helpers?.parseDateInput) return window.Core.helpers.parseDateInput(raw);
    if (!raw) return null;
    const parts = String(raw).trim().split(/[\/\-]/);
    if (parts.length !== 3) return null;
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }

  function sanitizeAmount(raw) {
    if (window.Core?.helpers?.sanitizeAmount) return window.Core.helpers.sanitizeAmount(raw, 8, 2);
    if (!raw) return '';
    const clean = String(raw).replace(/,/g, '').trim();
    return /^\d{1,8}(?:\.\d{0,2})?$/.test(clean) ? clean : '';
  }

  function generateBudgetId() {
    if (window.Core?.helpers?.generateId) return window.Core.helpers.generateId('budget');
    return `budget_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function cerrarDrawer() {
    if (activeDrawer) {
      activeDrawer.classList.remove('drawer-show');
      if (drawerOverlay) drawerOverlay.classList.remove('drawer-overlay-show');
      const d = activeDrawer;
      const o = drawerOverlay;
      setTimeout(() => {
        if (d && d.parentNode) d.parentNode.removeChild(d);
        if (o && o.parentNode) o.parentNode.removeChild(o);
      }, 280);
      activeDrawer = null;
      drawerOverlay = null;
    }
  }

  function mostrarBottomDrawer({ mensaje, mensajeHtml, confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'danger', onConfirm }) {
    cerrarDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.style.zIndex = '2147483645';
    document.body.appendChild(overlay);
    drawerOverlay = overlay;

    const drawer = document.createElement('div');
    drawer.className = `confirm-drawer confirm-drawer-${variant}`;
    drawer.setAttribute('role', 'dialog');
    drawer.style.zIndex = '2147483646';

    const handle = document.createElement('div');
    handle.className = 'confirm-drawer-handle';

    const msgEl = document.createElement('p');
    msgEl.className = 'confirm-drawer-msg';
    if (mensajeHtml !== undefined) {
      msgEl.innerHTML = String(mensajeHtml ?? '');
    } else {
      msgEl.textContent = String(mensaje ?? '');
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'confirm-drawer-cancel';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = `confirm-drawer-confirm confirm-drawer-confirm-${variant}`;
    confirmBtn.textContent = confirmText;

    const btnsEl = document.createElement('div');
    btnsEl.className = 'confirm-drawer-btns';
    btnsEl.append(cancelBtn, confirmBtn);

    drawer.append(handle, msgEl, btnsEl);
    document.body.appendChild(drawer);
    activeDrawer = drawer;

    requestAnimationFrame(() => {
      drawer.classList.add('drawer-show');
      overlay.classList.add('drawer-overlay-show');
    });

    cancelBtn.addEventListener('click', cerrarDrawer);
    confirmBtn.addEventListener('click', () => {
      cerrarDrawer();
      if (onConfirm) onConfirm();
    });
    overlay.addEventListener('click', cerrarDrawer);

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        cerrarDrawer();
        document.removeEventListener('keydown', handler);
      }
    });
  }

  function poblarDropdownCategoriasModal(selectedCatId = '') {
    const elementos = getEl();
    const datosApp = getDatos();
    const budgetDropdown = elementos.budgetCategoryDropdown;
    const categorySelect = elementos.budgetCategory;
    if (!budgetDropdown) return;

    const selectedEl = budgetDropdown.querySelector('.custom-dropdown-selected');
    const optionsContainer = budgetDropdown.querySelector('.custom-dropdown-options');
    if (!selectedEl || !optionsContainer) return;

    const categoriasPresupuestables = (datosApp.categories || []).filter(cat => {
      const ft = String(cat?.fixedType || '').trim().toLowerCase();
      return ft !== 'income' && ft !== 'ingreso';
    });

    if (categorySelect) {
      categorySelect.innerHTML = '<option value="" disabled selected hidden>Selecciona una categoría</option>';
      categoriasPresupuestables.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        if (String(cat.id) === String(selectedCatId)) option.selected = true;
        categorySelect.appendChild(option);
      });
      categorySelect.value = selectedCatId || '';
    }

    const selectedCat = categoriasPresupuestables.find(c => String(c.id) === String(selectedCatId));
    selectedEl.setAttribute('data-value', selectedCatId || '');
    const spanEl = selectedEl.querySelector('span');
    if (spanEl) spanEl.textContent = selectedCat ? selectedCat.name : 'Selecciona una categoría';

    optionsContainer.innerHTML = '';
    const currentVal = selectedCatId || '';

    if (categoriasPresupuestables.length === 0) {
      const emptyOpt = document.createElement('div');
      emptyOpt.className = 'custom-dropdown-option disabled';
      emptyOpt.style.opacity = '0.6';
      emptyOpt.style.cursor = 'default';
      emptyOpt.textContent = 'Sin categorías disponibles';
      optionsContainer.appendChild(emptyOpt);
    } else {
      categoriasPresupuestables.forEach(cat => {
        const opt = document.createElement('div');
        opt.textContent = cat.name;
        opt.setAttribute('data-value', String(cat.id));
        opt.className = 'custom-dropdown-option' + (String(cat.id) === String(currentVal) ? ' selected' : '');

        opt.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();

          const val = String(cat.id);
          const chosenCat = categoriasPresupuestables.find(c => String(c.id) === val) || null;

          selectedEl.setAttribute('data-value', val);
          const sp = selectedEl.querySelector('span');
          if (sp) sp.textContent = chosenCat ? chosenCat.name : 'Selecciona una categoría';
          if (categorySelect) categorySelect.value = val;

          optionsContainer.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          budgetDropdown.classList.remove('open');
        };

        optionsContainer.appendChild(opt);
      });
    }

    selectedEl.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        if (d !== budgetDropdown) d.classList.remove('open');
      });
      budgetDropdown.classList.toggle('open');
    };
  }

  function poblarDropdownPeriodoModal(selectedPeriod = 'monthly') {
    const elementos = getEl();
    const periodDropdown = elementos.budgetPeriodDropdown;
    const periodSelect = elementos.budgetPeriod;
    if (!periodDropdown) return;

    const optionsContainer = periodDropdown.querySelector('.custom-dropdown-options');
    const selectedEl = periodDropdown.querySelector('.custom-dropdown-selected');
    if (!optionsContainer || !selectedEl) return;

    const periods = [
      { value: 'weekly', label: 'Semanal' },
      { value: 'biweekly', label: 'Quincenal' },
      { value: 'monthly', label: 'Mensual' },
      { value: 'yearly', label: 'Anual' },
      { value: 'custom', label: 'Personalizado' }
    ];

    const currentVal = selectedPeriod || 'monthly';
    optionsContainer.innerHTML = '';

    periods.forEach(p => {
      const opt = document.createElement('div');
      opt.className = 'custom-dropdown-option' + (p.value === currentVal ? ' selected' : '');
      opt.setAttribute('data-value', p.value);
      opt.textContent = p.label;

      opt.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        selectedEl.setAttribute('data-value', p.value);
        if (selectedEl.querySelector('span')) {
          selectedEl.querySelector('span').textContent = p.label;
        }
        if (periodSelect) {
          periodSelect.value = p.value;
          periodSelect.dispatchEvent(new Event('change'));
        }
        optionsContainer.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        periodDropdown.classList.remove('open');

        if (p.value === 'custom') {
          if (elementos.customPeriodGroup) elementos.customPeriodGroup.style.display = 'block';
          if (elementos.customEndGroup) elementos.customEndGroup.style.display = 'block';
        } else {
          if (elementos.customPeriodGroup) elementos.customPeriodGroup.style.display = 'none';
          if (elementos.customEndGroup) elementos.customEndGroup.style.display = 'none';
        }
      };

      optionsContainer.appendChild(opt);
    });

    const activePeriod = periods.find(p => p.value === currentVal) || periods[2];
    selectedEl.setAttribute('data-value', activePeriod.value);
    if (selectedEl.querySelector('span')) {
      selectedEl.querySelector('span').textContent = activePeriod.label;
    }
    if (periodSelect) {
      periodSelect.value = activePeriod.value;
    }

    if (activePeriod.value === 'custom') {
      if (elementos.customPeriodGroup) elementos.customPeriodGroup.style.display = 'block';
      if (elementos.customEndGroup) elementos.customEndGroup.style.display = 'block';
    } else {
      if (elementos.customPeriodGroup) elementos.customPeriodGroup.style.display = 'none';
      if (elementos.customEndGroup) elementos.customEndGroup.style.display = 'none';
    }

    selectedEl.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        if (d !== periodDropdown) d.classList.remove('open');
      });
      periodDropdown.classList.toggle('open');
    };
  }

  function abrirModalCrear() {
    const elementos = getEl();
    editingBudgetId = null;

    if (elementos.budgetModalTitle) {
      elementos.budgetModalTitle.innerHTML = '<i data-lucide="plus"></i> Crear Presupuesto';
      window.LucideHelper?.refresh(elementos.budgetModalTitle);
    }

    if (elementos.budgetForm) {
      elementos.budgetForm.reset();
    }

    poblarDropdownCategoriasModal('');
    poblarDropdownPeriodoModal('monthly');

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    if (elementos.budgetStartDate) {
      elementos.budgetStartDate.value = formatInputDate(firstDay);
    }

    if (elementos.budgetEndDate) {
      elementos.budgetEndDate.value = formatInputDate(lastDay);
    }

    mostrarModal(elementos.budgetModal);
  }

  function editarPresupuesto(budgetId) {
    const elementos = getEl();
    const datosApp = getDatos();
    const budget = (datosApp.budgets || []).find(b => String(b.id) === String(budgetId));
    if (!budget) {
      console.warn('Presupuesto no encontrado: ' + budgetId);
      return;
    }

    editingBudgetId = budgetId;

    if (elementos.budgetModalTitle) {
      elementos.budgetModalTitle.innerHTML = '<i data-lucide="pencil"></i> Editar Presupuesto';
      window.LucideHelper?.refresh(elementos.budgetModalTitle);
    }

    poblarDropdownCategoriasModal(budget.categoryId);
    poblarDropdownPeriodoModal(budget.period || 'monthly');

    if (elementos.budgetAmount) {
      const n = Number(budget.amount) || 0;
      const parts = n % 1 === 0 ? [String(n), ''] : n.toFixed(2).split('.');
      const formattedInt = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      elementos.budgetAmount.value = (parts[1] && parts[1] !== '00') ? formattedInt + '.' + parts[1] : formattedInt;
    }

    if (budget.period === 'custom') {
      if (elementos.customPeriodGroup) elementos.customPeriodGroup.style.display = 'block';
      if (elementos.customEndGroup) elementos.customEndGroup.style.display = 'block';

      if (elementos.budgetStartDate && budget.startDate) {
        elementos.budgetStartDate.value = formatInputDate(new Date(budget.startDate));
      }
      if (elementos.budgetEndDate && budget.endDate) {
        elementos.budgetEndDate.value = formatInputDate(new Date(budget.endDate));
      }
    } else {
      if (elementos.customPeriodGroup) elementos.customPeriodGroup.style.display = 'none';
      if (elementos.customEndGroup) elementos.customEndGroup.style.display = 'none';
    }

    mostrarModal(elementos.budgetModal);
  }

  function actualizarSeleccionCategoria(value) {
    const dropdown = getEl().budgetCategoryDropdown;
    if (!dropdown) return;

    const selected = dropdown.querySelector('.custom-dropdown-selected');
    const options = dropdown.querySelector('.custom-dropdown-options');
    if (!selected || !options) return;

    const optionsList = Array.from(options.querySelectorAll('.custom-dropdown-option'));
    optionsList.forEach(opt => opt.classList.remove('selected'));

    const valueStr = value == null ? '' : String(value);
    const match = optionsList.find(opt => opt.getAttribute('data-value') === valueStr);

    if (match) {
      match.classList.add('selected');
      selected.querySelector('span').textContent = match.textContent;
      selected.setAttribute('data-value', valueStr);
    } else {
      selected.querySelector('span').textContent = 'Selecciona una categoría';
      selected.setAttribute('data-value', '');
    }
  }

  function actualizarSeleccionPeriodo(value) {
    const dropdown = getEl().budgetPeriodDropdown;
    if (!dropdown) return;

    const selected = dropdown.querySelector('.custom-dropdown-selected');
    const options = dropdown.querySelector('.custom-dropdown-options');
    if (!selected || !options) return;

    const optionsList = Array.from(options.querySelectorAll('.custom-dropdown-option'));
    optionsList.forEach(opt => opt.classList.remove('selected'));

    const valueStr = value == null ? 'monthly' : String(value);
    const match = optionsList.find(opt => opt.getAttribute('data-value') === valueStr);

    if (match) {
      match.classList.add('selected');
      selected.querySelector('span').textContent = match.textContent;
      selected.setAttribute('data-value', valueStr);
    }
  }

  function sincronizarPresupuesto(budgetId) {
    const datosApp = getDatos();
    const budget = (datosApp.budgets || []).find(b => String(b.id) === String(budgetId));
    if (!budget) return;

    if (budget.period === 'custom') {
      notifyWarning('Los presupuestos personalizados no se pueden sincronizar automáticamente. Usa Editar para ajustar las fechas.');
      return;
    }

    const categoria = (datosApp.categories || []).find(c => String(c.id) === String(budget.categoryId));
    const nombre = config.getBudgetDisplayName ? config.getBudgetDisplayName(budget, categoria) : (categoria?.name || 'Presupuesto');

    cerrarDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.style.zIndex = '2147483645';
    document.body.appendChild(overlay);
    drawerOverlay = overlay;

    const drawer = document.createElement('div');
    drawer.className = 'confirm-drawer confirm-drawer-primary';
    drawer.setAttribute('role', 'dialog');
    drawer.style.zIndex = '2147483646';
    drawer.innerHTML = `
      <div class="confirm-drawer-handle"></div>
      <div class="sync-drawer-header">
        <div class="sync-icon-wrapper"><i data-lucide="refresh-cw"></i></div>
        <h3>Sincronizar <strong>${escapeHtml(nombre)}</strong></h3>
        <p>¿Desde cuándo quieres que este presupuesto cuente transacciones?</p>
      </div>
      <div class="sync-drawer-options">
        <button class="btn-sync-option btn-sync-desde-hoy">
          <div class="sync-option-icon"><i data-lucide="calendar"></i></div>
          <div class="sync-option-content">
            <h4>Desde hoy</h4>
            <span>Solo transacciones futuras</span>
          </div>
        </button>
        <button class="btn-sync-option btn-sync-con-historial">
          <div class="sync-option-icon"><i data-lucide="history"></i></div>
          <div class="sync-option-content">
            <h4>Incluir historial</h4>
            <span>Contar transacciones de este período</span>
          </div>
        </button>
      </div>
      <button class="btn btn-secondary sync-drawer-cancel-btn confirm-drawer-cancel">Cancelar</button>
    `;
    document.body.appendChild(drawer);
    window.LucideHelper?.refresh(drawer);
    activeDrawer = drawer;

    requestAnimationFrame(() => {
      drawer.classList.add('drawer-show');
      overlay.classList.add('drawer-overlay-show');
    });

    drawer.querySelector('.confirm-drawer-cancel').addEventListener('click', cerrarDrawer);
    overlay.addEventListener('click', cerrarDrawer);

    drawer.querySelector('.btn-sync-desde-hoy').addEventListener('click', () => {
      cerrarDrawer();
      aplicarSincronizacion(budget, 'fresh');
    });

    drawer.querySelector('.btn-sync-con-historial').addEventListener('click', () => {
      cerrarDrawer();
      aplicarSincronizacion(budget, 'history');
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        cerrarDrawer();
        document.removeEventListener('keydown', handler);
      }
    });
  }

  function aplicarSincronizacion(budget, modo) {
    const datosApp = getDatos();
    const now = new Date();
    let startDate, endDate;

    if (modo === 'fresh') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (budget.period === 'weekly') {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
      } else if (budget.period === 'biweekly') {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 13);
      } else if (budget.period === 'monthly') {
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else {
        endDate = new Date(now.getFullYear(), 11, 31);
      }
    } else {
      const matchCategory = config.transaccionPerteneceACategoria || ((t, catId) => String(t?.categoryId) === String(catId));
      const txsCategoria = (datosApp.transactions || []).filter(t => matchCategory(t, budget.categoryId));
      const parseDate = config.parseFechaFlexible || (d => new Date(d));
      const fechas = txsCategoria.map(t => parseDate(t.date)).filter(Boolean);

      if (fechas.length > 0) {
        startDate = new Date(Math.min(...fechas.map(d => d.getTime())));
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      endDate = new Date(now.getFullYear() + 1, 11, 31);
      endDate.setHours(23, 59, 59, 999);
    }

    const idx = (datosApp.budgets || []).findIndex(b => String(b.id) === String(budget.id));
    if (idx === -1) return;

    datosApp.budgets[idx] = {
      ...datosApp.budgets[idx],
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (config.guardarPresupuestos) config.guardarPresupuestos();
    if (config.renderizarTodo) config.renderizarTodo();
    notifySuccess(modo === 'fresh' ? 'Presupuesto reiniciado desde hoy.' : 'Presupuesto sincronizado con el período actual.');
  }

  async function eliminarPresupuesto(budgetId) {
    const datosApp = getDatos();
    const budget = (datosApp.budgets || []).find(b => String(b.id) === String(budgetId));
    if (!budget) return;
    const categoria = (datosApp.categories || []).find(c => String(c.id) === String(budget.categoryId));

    const getDisplayName = config.getBudgetDisplayName || ((b, c) => c?.name || b?.name || 'Presupuesto');
    const safeName = getDisplayName(budget, categoria)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const ejecutar = () => {
      datosApp.budgets = datosApp.budgets.filter(b => String(b.id) !== String(budgetId));
      if (config.guardarPresupuestos) config.guardarPresupuestos();
      if (config.renderizarTodo) config.renderizarTodo();
      notifySuccess('Presupuesto eliminado correctamente');
    };

    if (window.__appConfirmDelete === false) {
      ejecutar();
      return;
    }

    mostrarBottomDrawer({
      mensajeHtml: `¿Estás seguro de que deseas eliminar el presupuesto "<strong>${safeName}</strong>"?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
      onConfirm: ejecutar
    });
  }

  function guardarPresupuesto() {
    const elementos = getEl();
    const datosApp = getDatos();

    const categoryValue =
      elementos.budgetCategory?.value ||
      elementos.budgetCategoryDropdown?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') ||
      '';

    if (!categoryValue) {
      notifyWarning('Debes seleccionar una categoría');
      const cd = elementos.budgetCategoryDropdown;
      if (cd) {
        cd.classList.add('open');
        cd.querySelector('.custom-dropdown-selected')?.focus();
      } else {
        elementos.budgetCategory?.focus();
      }
      return;
    }

    if (elementos.budgetCategory) {
      elementos.budgetCategory.value = categoryValue;
    }

    const amountStr = (elementos.budgetAmount?.value || '').trim();
    const normalized = sanitizeAmount(amountStr);
    if (!normalized) {
      notifyWarning('El monto debe ser un número mayor a 0');
      elementos.budgetAmount?.focus();
      return;
    }
    const amount = parseFloat(normalized);
    if (isNaN(amount) || amount <= 0) {
      notifyWarning('El monto debe ser un número mayor a 0');
      elementos.budgetAmount?.focus();
      return;
    }

    const period =
      elementos.budgetPeriod?.value ||
      elementos.budgetPeriodDropdown?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') ||
      '';

    if (elementos.budgetPeriod) {
      elementos.budgetPeriod.value = period;
    }

    if (!period) {
      notifyWarning('Selecciona un período para el presupuesto');
      const pd = elementos.budgetPeriodDropdown;
      if (pd) {
        pd.classList.add('open');
        const sel = pd.querySelector('.custom-dropdown-selected');
        if (sel && sel.focus) {
          sel.setAttribute('tabindex', '-1');
          sel.focus();
        }
      }
      return;
    }

    let startDate, endDate;

    if (period === 'custom') {
      if (!elementos.budgetStartDate?.value || !elementos.budgetEndDate?.value) {
        notifyWarning('Debes especificar las fechas de inicio y fin');
        return;
      }

      startDate = parseInputDate(elementos.budgetStartDate.value);
      endDate = parseInputDate(elementos.budgetEndDate.value);

      if (!startDate || !endDate) {
        notifyWarning('Las fechas ingresadas no son válidas');
        return;
      }

      if (endDate < startDate) {
        notifyWarning('La fecha de fin no puede ser anterior a la fecha de inicio');
        return;
      }
    } else {
      const now = new Date();
      if (period === 'weekly') {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        startDate = new Date(now);
        startDate.setDate(now.getDate() + diffToMonday);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
      } else if (period === 'biweekly') {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        startDate = new Date(now);
        startDate.setDate(now.getDate() + diffToMonday);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 13);
      } else if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
      }
    }

    const cat = (datosApp.categories || []).find(c => String(c.id) === String(categoryValue));
    if (!cat) {
      notifyWarning('Por favor selecciona una categoría válida');
      return;
    }

    const budgetData = {
      id: editingBudgetId || generateBudgetId(),
      name: String(cat.name).trim(),
      categoryId: String(cat.id),
      amount: amount,
      period: period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdAt: editingBudgetId
        ? (datosApp.budgets.find(b => String(b.id) === String(editingBudgetId))?.createdAt || new Date().toISOString())
        : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingBudgetId) {
      const index = datosApp.budgets.findIndex(b => String(b.id) === String(editingBudgetId));
      if (index !== -1) {
        datosApp.budgets[index] = budgetData;
        notifySuccess('Presupuesto actualizado correctamente');
      }
    } else {
      const duplicado = datosApp.budgets.find(b => String(b.categoryId) === String(categoryValue));
      if (duplicado) {
        notifyWarning(`Ya existe un presupuesto para la categoría "${duplicado.name || 'esta categoría'}"`);
        return;
      }
      datosApp.budgets.push(budgetData);
      notifySuccess('Presupuesto creado correctamente');
    }

    if (config.guardarPresupuestos) config.guardarPresupuestos();
    cerrarModal();
    if (config.renderizarTodo) config.renderizarTodo();
  }

  function cerrarModal() {
    const elementos = getEl();
    if (elementos.budgetModal) {
      elementos.budgetModal.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
      elementos.budgetModal.classList.add('hidden');
      elementos.budgetModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }

    editingBudgetId = null;

    if (elementos.budgetForm) {
      elementos.budgetForm.reset();
    }

    if (elementos.budgetStartDate) elementos.budgetStartDate.value = '';
    if (elementos.budgetEndDate) elementos.budgetEndDate.value = '';
    if (elementos.customPeriodGroup) elementos.customPeriodGroup.style.display = 'none';
    if (elementos.customEndGroup) elementos.customEndGroup.style.display = 'none';
  }

  function mostrarModal(modal) {
    if (!modal) {
      console.warn('modal is null');
      return;
    }

    document.querySelectorAll('.modal-overlay').forEach(m => {
      m.classList.add('hidden');
      m.style.display = 'none';
    });

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    const firstInput = modal.querySelector('input, select, textarea');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  return {
    init,
    poblarDropdownCategoriasModal,
    poblarDropdownPeriodoModal,
    abrirModalCrear,
    editarPresupuesto,
    actualizarSeleccionCategoria,
    actualizarSeleccionPeriodo,
    sincronizarPresupuesto,
    aplicarSincronizacion,
    eliminarPresupuesto,
    guardarPresupuesto,
    cerrarModal,
    mostrarModal,
    cerrarDrawer,
    mostrarBottomDrawer
  };
});
