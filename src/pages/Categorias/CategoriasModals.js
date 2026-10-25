// @fileoverview Módulo de gestión de modales para Categorías.

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoriasModals = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Abre un modal, gestiona la visibilidad ARIA y enfoca el primer elemento interactivo.
  function abrirModal(modal, triggerElement = null) {
    if (!modal || typeof document === 'undefined') return;

    document.querySelectorAll('.modal.active').forEach(m => {
      if (m !== modal) {
        m.classList.remove('active');
        m.setAttribute('aria-hidden', 'true');
      }
    });

    modal.classList.add('active');
    modal.removeAttribute('inert');
    modal.setAttribute('aria-hidden', 'false');
    if (document.body) document.body.classList.add('modal-open');

    const firstFocusable = modal.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      setTimeout(() => {
        try {
          firstFocusable.focus();
        } catch (e) {
          console.warn('No se pudo enfocar el primer elemento del modal:', e);
        }
      }, 100);
    }

    if (triggerElement && document.contains(triggerElement)) {
      modal._triggerElement = triggerElement;
    }
  }

  // Cierra un modal y restaura el foco al elemento disparador.
  function cerrarModal(modal) {
    if (!modal || typeof document === 'undefined') return;
    try {
      const triggerEl = modal._triggerElement || null;
      const hadFocusInside = modal.contains(document.activeElement);

      modal.classList.remove('active');
      modal.setAttribute('inert', '');
      limpiarBloqueoScroll();

      if (hadFocusInside && document.body) {
        try {
          document.body.setAttribute('tabindex', '-1');
          document.body.focus();
        } catch {}
      }

      setTimeout(() => {
        let restored = false;
        try {
          if (triggerEl && typeof triggerEl.focus === 'function' && document.contains(triggerEl) && triggerEl.offsetParent !== null) {
            triggerEl.focus();
            restored = true;
          }
        } catch (e) {
          console.warn('No se pudo restaurar foco al trigger:', e);
        }

        if (!restored) {
          const fallback = document.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (fallback && document.contains(fallback)) {
            try { fallback.focus(); } catch {}
          }
        }

        if (document.body && document.body.getAttribute('tabindex') === '-1') {
          document.body.removeAttribute('tabindex');
        }

        modal.setAttribute('aria-hidden', 'true');
        modal.removeAttribute('inert');
        modal._triggerElement = null;
      }, 40);
    } catch (e) {
      console.error('Error cerrando modal:', e);
    }
  }

  // Restablece el scroll del body cuando no hay modales ni alertas activas.
  function limpiarBloqueoScroll() {
    if (typeof document === 'undefined') return;
    const hasModal = !!document.querySelector('.modal.active');
    const overlay = document.getElementById('alertOverlay');
    const alertBox = document.getElementById('customAlert');
    const alertVisible = (overlay && !overlay.classList.contains('hidden')) || (alertBox && !alertBox.classList.contains('hidden'));
    if (!hasModal && document.body) document.body.classList.remove('modal-open');
    if (!alertVisible && document.body) document.body.classList.remove('no-scroll');
    if (!hasModal && !alertVisible && document.body) document.body.style.overflow = '';
  }

  // Abre el modal de edición de categoría cargando los valores correspondientes.
  function mostrarModalEditarCategoria(categoryId, buscarCategoriaFn, abrirModalFn = abrirModal) {
    if (typeof document === 'undefined') return;
    const category = typeof buscarCategoriaFn === 'function' ? buscarCategoriaFn(categoryId) : null;
    if (!category) {
      console.error('No se encontró la categoría para editar:', categoryId);
      return;
    }

    const editCategoryId = document.getElementById('editCategoryId');
    const editCategoryName = document.getElementById('editCategoryName');
    const editCategoryModal = document.getElementById('editCategoryModal');

    if (editCategoryId) editCategoryId.value = categoryId;
    if (editCategoryName) editCategoryName.value = category.name || '';
    if (editCategoryModal) abrirModalFn(editCategoryModal);

    document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));
  }

  // Muestra la confirmación para eliminar una categoría.
  function mostrarModalEliminarCategoria(categoryId, buscarCategoriaFn, onConfirmCallback, escFn) {
    if (typeof document === 'undefined') return;
    const category = typeof buscarCategoriaFn === 'function' ? buscarCategoriaFn(categoryId) : null;
    if (!category) {
      console.error('No se encontró la categoría para eliminar:', categoryId);
      return;
    }

    document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));

    const escapeText = escFn || ((text) => String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));

    if (window.__appConfirmDelete === false) {
      if (typeof onConfirmCallback === 'function') onConfirmCallback();
      return;
    }

    if (typeof window.mostrarBottomDrawer === 'function') {
      window.mostrarBottomDrawer({
        mensajeHtml: `¿Eliminar la categoría "<strong>${escapeText(category.name)}</strong>"?<br>Se eliminarán todas sus transacciones.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'danger',
        onConfirm: onConfirmCallback
      });
    } else if (typeof window.showAlert === 'function') {
      window.showAlert(
        'Eliminar Categoría',
        `¿Eliminar la categoría "${category.name}"? Se eliminarán todas sus transacciones.`,
        { variant: 'confirm', emphasis: 'danger' }
      ).then(result => {
        if (result === 'confirm' && typeof onConfirmCallback === 'function') {
          onConfirmCallback();
        }
      });
    } else {
      if (window.confirm(`¿Eliminar la categoría "${category.name}"?`)) {
        if (typeof onConfirmCallback === 'function') onConfirmCallback();
      }
    }
  }

  // Abre el modal de atajos de teclado.
  function abrirModalAtajos(triggerEl = null, abrirModalFn = abrirModal) {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('shortcutsModal');
    if (modal) abrirModalFn(modal, triggerEl);
  }

  // Drawer de confirmación inferior
  let activeDrawer = null;
  let drawerOverlay = null;

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
    document.body.appendChild(overlay);
    drawerOverlay = overlay;

    const drawer = document.createElement('div');
    drawer.className = `confirm-drawer confirm-drawer-${variant}`;
    drawer.setAttribute('role', 'dialog');

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
    overlay.addEventListener('click', () => { if (window.innerWidth <= 980) cerrarDrawer(); });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { cerrarDrawer(); document.removeEventListener('keydown', handler); }
    });
  }

  // Atajos globales de teclado
  function setupGlobalShortcuts() {
    const isEditableTarget = (el) => {
      if (!el) return false;
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };

    const openShortcutsModal = () => {
      const modal = document.getElementById('shortcutsModal');
      const fab = document.getElementById('shortcutsFab');
      if (modal) abrirModal(modal, fab || null);
    };

    const fab = document.getElementById('shortcutsFab');
    const modal = document.getElementById('shortcutsModal');
    if (fab) {
      fab.addEventListener('click', () => openShortcutsModal());
    }
    if (modal) {
      modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(modal); });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const shortcutsModal = document.getElementById('shortcutsModal');
        if (shortcutsModal && shortcutsModal.classList.contains('active')) cerrarModal(shortcutsModal);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (window.__appShortcutsEnabled === false) return;
      const isEditing = isEditableTarget(document.activeElement);
      const withOtherMod = e.ctrlKey || e.metaKey;

      if (e.shiftKey && e.key === 'Delete' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const btn = document.getElementById('clearAllCategoriesBtn');
        if (btn) {
          e.preventDefault();
          btn.click();
        }
        return;
      }

      if (!withOtherMod && !e.altKey && (e.key === '?' || (e.shiftKey && e.key === '/')) && !isEditing) {
        e.preventDefault();
        openShortcutsModal();
        return;
      }

      if (!e.altKey || withOtherMod || isEditing) return;

      const key = e.key ? e.key.toLowerCase() : '';
      const code = e.code || '';

      if (key === 'h' || code === 'KeyH') {
        e.preventDefault();
        openShortcutsModal();
        return;
      }

      if (key === 'b' || code === 'KeyB') {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) { e.preventDefault(); searchInput.focus(); }
        return;
      }

      if (key === 'n' || code === 'KeyN') {
        const btn = document.getElementById('addCategoryBtn');
        const modal = document.getElementById('categoryModal');
        if (btn && modal) { e.preventDefault(); abrirModal(modal, btn); }
        return;
      }

      if (key === 'e' || code === 'KeyE') {
        const btn = document.getElementById('exportDropdownBtn');
        const menu = document.getElementById('exportDropdown');
        if (btn && menu) { e.preventDefault(); menu.classList.toggle('active'); btn.focus(); }
        return;
      }

      if (key === 'j' || code === 'KeyJ') {
        const btn = document.getElementById('exportJsonBtn');
        if (btn) { e.preventDefault(); btn.click(); }
        return;
      }

      if (key === 'p' || code === 'KeyP') {
        const btn = document.getElementById('exportPdfBtn');
        if (btn) { e.preventDefault(); btn.click(); }
        return;
      }

      if (key === 'i' || code === 'KeyI') {
        const btn = document.getElementById('importStateBtn');
        if (btn) { e.preventDefault(); btn.click(); }
        return;
      }

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
    });
  }

  // Guarda una nueva categoría desde el modal
  async function guardarNuevaCategoria({ categories, onUpdated, renderAll, modal, maxCategories = 200 }) {
    const categoryNameInput = document.getElementById('categoryName');
    const categoryName = categoryNameInput ? categoryNameInput.value.replace(/\s+/g, ' ').trim() : '';
    const categoryTypeSelector = document.getElementById('categoryFixedType');
    const activeButton = categoryTypeSelector ? categoryTypeSelector.querySelector('.category-type-btn.active') : null;
    const fixedType = activeButton ? activeButton.getAttribute('data-value') || '' : '';
    const selectedText = activeButton ? activeButton.querySelector('span')?.textContent : 'Ninguno';

    const mostrarAlerta = (t, m) => {
      if (typeof window.showAlert === 'function') window.showAlert(t, m, { variant: 'warning' });
      else alert(m);
    };

    if (!categoryName) {
      mostrarAlerta('Advertencia', 'Por favor, ingresa un nombre para la categoría.');
      return;
    }

    if (selectedText === 'Seleccionar tipo') {
      mostrarAlerta('Advertencia', 'Por favor, selecciona un tipo de categoría (Libre, Ingreso o Gasto).');
      return;
    }

    if (categories.length >= maxCategories) {
      mostrarAlerta('Límite alcanzado', `No se pueden agregar más de ${maxCategories} categorías.`);
      return;
    }

    const typeKey = fixedType || '';
    const exists = categories.some(c =>
      ((c.fixedType || '') === typeKey) && (String(c.name || '').trim().toLowerCase() === categoryName.toLowerCase())
    );
    if (exists) {
      if (window.Toast) window.Toast.warning('Ya existe una categoría de ese tipo con ese nombre.');
      return;
    }

    const genId = window.Core?.helpers?.generateId ? window.Core.helpers.generateId('cat') : `cat_${Date.now()}`;
    const newCategory = { id: genId, name: categoryName, transactions: [], isPinned: false };
    if (fixedType === 'income' || fixedType === 'expense') newCategory.fixedType = fixedType;

    categories.push(newCategory);
    if (typeof renderAll === 'function') renderAll();
    if (typeof onUpdated === 'function') await onUpdated();

    if (modal) cerrarModal(modal);

    setTimeout(() => {
      if (window.DataEvents) {
        window.DataEvents.emit('categoryChanged', { action: 'add', categoryId: newCategory.id });
      }
    }, 100);
  }

  // Guarda la edición del nombre de una categoría
  async function guardarEdicionCategoria({ categories, onUpdated, renderAll, modal }) {
    const editCategoryIdInput = document.getElementById('editCategoryId');
    const editCategoryNameInput = document.getElementById('editCategoryName');
    const categoryId = editCategoryIdInput?.value;
    const newName = editCategoryNameInput?.value.replace(/\s+/g, ' ').trim();

    const mostrarAlerta = (t, m) => {
      if (typeof window.showAlert === 'function') window.showAlert(t, m, { variant: 'warning' });
      else alert(m);
    };

    if (!newName) {
      mostrarAlerta('Advertencia', 'Por favor, ingresa un nombre válido para la categoría.');
      return;
    }

    const category = categories.find(c => String(c.id) === String(categoryId));
    if (category) {
      const typeKey = category.fixedType || '';
      const dup = categories.some(c => String(c.id) !== String(categoryId) && (c.fixedType || '') === typeKey && (String(c.name || '').trim().toLowerCase() === newName.toLowerCase()));
      if (dup) {
        if (window.Toast) window.Toast.warning('Ya existe una categoría de ese tipo con ese nombre.');
        return;
      }
      category.name = newName;
      if (modal) cerrarModal(modal);
      if (window.Toast) window.Toast.success(`Categoría renombrada a "${newName}"`);
      if (typeof renderAll === 'function') renderAll();
      if (typeof onUpdated === 'function') await onUpdated();

      setTimeout(() => {
        if (window.DataEvents) {
          window.DataEvents.emit('categoryChanged', { action: 'edit', categoryId });
        }
      }, 100);
    }
  }

  // Elimina todas las categorías y sus transacciones
  async function eliminarTodasCategorias({ datosUsuario, onUpdated, renderAll, modal }) {
    datosUsuario.categories = [];
    try {
      localStorage.removeItem('categories');
      localStorage.removeItem('transactions');
    } catch {}

    if (typeof renderAll === 'function') renderAll();
    if (typeof onUpdated === 'function') await onUpdated();

    setTimeout(() => {
      if (window.DataEvents) {
        window.DataEvents.emit('categoryChanged', { action: 'clearAll', categoriesCount: 0 });
      }
    }, 100);

    if (modal) cerrarModal(modal);
    if (window.Toast) window.Toast.success('Se eliminaron todas las categorías y sus transacciones.');
  }

  const CategoriasModals = {
    abrirModal,
    cerrarModal,
    limpiarBloqueoScroll,
    mostrarModalEditarCategoria,
    mostrarModalEliminarCategoria,
    abrirModalAtajos,
    cerrarDrawer,
    mostrarBottomDrawer,
    setupGlobalShortcuts,
    guardarNuevaCategoria,
    guardarEdicionCategoria,
    eliminarTodasCategorias
  };

  if (typeof window !== 'undefined') {
    window.CategoriasModals = CategoriasModals;
    window.mostrarBottomDrawer = mostrarBottomDrawer;
    window.cerrarDrawer = cerrarDrawer;
  }
  if (typeof globalThis !== 'undefined') globalThis.CategoriasModals = CategoriasModals;

  return CategoriasModals;
});

