/**
 * FinanzApp - Categorias Transactions CRUD & Form Operations
 * Single Responsibility: Add, edit, delete, and undo transactions within categories
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoriasTransactions = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let lastDeletedTransaction = null;
  let undoTimeout = null;

  function getHelpers() {
    return window.Core?.helpers || window.Helpers || {};
  }

  function round2(val) {
    const h = getHelpers();
    return typeof h.round2 === 'function' ? h.round2(val) : Math.round((val + Number.EPSILON) * 100) / 100;
  }

  function generarId(prefix = '') {
    const h = getHelpers();
    return typeof h.generateId === 'function' ? h.generateId(prefix) : `${prefix ? prefix + '_' : ''}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function parseAmount(str) {
    const h = getHelpers();
    if (typeof h.sanitizeAmount === 'function') {
      const sanitized = h.sanitizeAmount(str, 8, 2);
      return parseFloat(sanitized) || 0;
    }
    return parseFloat(str) || 0;
  }

  function validateTransactionDate(date) {
    if (!date || isNaN(date.getTime())) {
      return { isValid: false, error: 'Fecha inválida' };
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) {
      return { isValid: false, error: 'No se permiten fechas futuras' };
    }
    const minDate = new Date();
    minDate.setFullYear(today.getFullYear() - 10);
    if (date < minDate) {
      return { isValid: false, error: 'Fecha demasiado antigua' };
    }
    return { isValid: true, date };
  }

  function setupEditTransactionTypeButtons() {
    const typeSelector = document.getElementById('editTransactionType');
    if (typeSelector) {
      if (!typeSelector.querySelector('.transaction-type-btn')) return;
      const buttons = typeSelector.querySelectorAll('.transaction-type-btn');
      buttons.forEach(button => {
        button.addEventListener('click', () => {
          buttons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
        });
      });
    }
  }

  function showUndoNotification() {
    const undoNotification = document.getElementById('undoNotification');
    if (undoNotification) undoNotification.classList.add('active');
    if (undoTimeout) clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
      hideUndoNotification();
      lastDeletedTransaction = null;
    }, 6000);
  }

  function hideUndoNotification() {
    const undoNotification = document.getElementById('undoNotification');
    if (undoNotification) undoNotification.classList.remove('active');
  }

  function abrirModalEditarTransaccion(categoryId, transactionId, categories) {
    const category = (categories || []).find(c => c.id === categoryId);
    if (!category) return;

    const transaction = (category.transactions || []).find(t => t.id == transactionId);
    if (!transaction) return;

    const typeSelect = document.getElementById('editTransactionType');
    const amountInput = document.getElementById('editTransactionAmount');
    const descInput = document.getElementById('editTransactionDesc');
    const dateInput = document.getElementById('editTransactionDate');
    const idInput = document.getElementById('editTransactionId');
    const categoryIdInput = document.getElementById('editTransactionCategoryId');
    const amountWarning = document.getElementById('amountWarning');
    const dateWarning = document.getElementById('editDateWarning');
    const editTransactionModal = document.getElementById('editTransactionModal');

    if (typeSelect) {
      if (category.fixedType) {
        const fixed = category.fixedType;
        typeSelect.dataset.mode = 'fixed';
        typeSelect.innerHTML = `
          <div class="type-chip ${fixed}">
            <i data-lucide="${fixed === 'income' ? 'arrow-up' : 'arrow-down'}"></i>
            <span>${fixed === 'income' ? 'Ingreso' : 'Gasto'}</span>
          </div>`;
        window.LucideHelper?.refresh(typeSelect);
        typeSelect.style.opacity = '0.85';
        typeSelect.style.pointerEvents = 'none';
        typeSelect.setAttribute('title', 'Tipo definido por la categoría');

        let hint = document.getElementById('editTypeFixedHint');
        if (!hint) {
          hint = document.createElement('div');
          hint.id = 'editTypeFixedHint';
          hint.innerHTML = '<i data-lucide="lock" style="margin-right:6px;"></i><em>Tipo definido por la categoría</em>';
          window.LucideHelper?.refresh(hint);
          hint.style.marginTop = '6px';
          hint.style.color = 'var(--gray)';
          hint.style.fontSize = '12px';
          const container = typeSelect.parentElement || typeSelect;
          container.insertBefore(hint, typeSelect.nextSibling);
        } else {
          hint.style.display = '';
        }
      } else {
        if (!typeSelect.querySelector('.transaction-type-btn')) {
          typeSelect.innerHTML = `
            <button type="button" class="transaction-type-btn" data-value="income">
              <i data-lucide="arrow-up"></i>
              <span>Ingreso</span>
            </button>
            <button type="button" class="transaction-type-btn" data-value="expense">
              <i data-lucide="arrow-down"></i>
              <span>Gasto</span>
            </button>`;
          window.LucideHelper?.refresh(typeSelect);
        }
        typeSelect.style.opacity = '1';
        typeSelect.style.pointerEvents = 'auto';
        typeSelect.removeAttribute('title');
        const hint = document.getElementById('editTypeFixedHint');
        if (hint) hint.remove();

        const buttons = typeSelect.querySelectorAll('.transaction-type-btn');
        buttons.forEach(btn => {
          btn.classList.remove('active');
          if (btn.getAttribute('data-value') === transaction.type) {
            btn.classList.add('active');
          }
        });
      }
    }

    const h = getHelpers();
    if (amountInput) {
      amountInput.value = typeof h.formatInputAmount === 'function' ? h.formatInputAmount(transaction.amount.toString()) : transaction.amount.toString();
    }
    if (descInput) descInput.value = transaction.description || '';
    if (dateInput) {
      dateInput.value = typeof h.formatDate === 'function' ? h.formatDate(transaction.date) : (transaction.date instanceof Date ? transaction.date.toLocaleDateString() : String(transaction.date));
    }
    if (idInput) idInput.value = transactionId;
    if (categoryIdInput) categoryIdInput.value = categoryId;
    if (amountWarning) amountWarning.style.display = 'none';
    if (dateWarning) dateWarning.style.display = 'none';

    if (editTransactionModal) {
      if (typeof window.abrirModal === 'function') {
        window.abrirModal(editTransactionModal);
      } else if (window.ModalManager) {
        window.ModalManager.open(editTransactionModal);
      }
      setTimeout(setupEditTransactionTypeButtons, 80);
    }
  }

  async function eliminarTransaccion(categoryId, transactionId, categories, onDataChanged) {
    const category = (categories || []).find(c => c.id === categoryId);
    if (!category) return false;

    const idx = (category.transactions || []).findIndex(t => t.id == transactionId);
    if (idx === -1) return false;

    const [deleted] = category.transactions.splice(idx, 1);
    lastDeletedTransaction = { categoryId, transaction: deleted };
    showUndoNotification();

    if (typeof onDataChanged === 'function') {
      await onDataChanged({ action: 'remove', categoryId, transactionId });
    }

    if (window.DataEvents) {
      window.DataEvents.emit('transactionChanged', { action: 'remove', categoryId, transactionId });
    }
    return true;
  }

  async function deshacerEliminacion(categories, onDataChanged) {
    if (!lastDeletedTransaction) return false;

    const { categoryId, transaction } = lastDeletedTransaction;
    const category = (categories || []).find(c => c.id === categoryId);
    if (!category) return false;

    category.transactions = category.transactions || [];
    category.transactions.push(transaction);
    lastDeletedTransaction = null;
    hideUndoNotification();

    if (typeof onDataChanged === 'function') {
      await onDataChanged({ action: 'undo', categoryId, transaction });
    }

    if (window.DataEvents) {
      window.DataEvents.emit('transactionChanged', { action: 'undo', categoryId, transaction });
    }
    return true;
  }

  async function agregarTransaccion(categoryId, { buscarCategoria, onUpdated, renderAll }) {
    const category = typeof buscarCategoria === 'function' ? buscarCategoria(categoryId) : null;
    if (!category) {
      console.error('No se encontró la categoría:', categoryId);
      return;
    }

    const typeSelect = category.fixedType ? null : document.getElementById(`transaction-type-${category.id}`);
    const amountInput = document.getElementById(`transaction-amount-${category.id}`);
    const descInput = document.getElementById(`transaction-desc-${category.id}`);
    const dateInput = document.getElementById(`transaction-date-${category.id}`);

    const typeWarning = category.fixedType ? null : document.getElementById(`type-warning-${category.id}`);
    const amountDigitWarning = document.getElementById(`amount-digit-warning-${category.id}`);
    const amountError = document.getElementById(`amount-error-${category.id}`);
    const dateError = document.getElementById(`date-error-${category.id}`);

    if (!amountInput) {
      console.error('No se encontró el input de monto para la categoría:', categoryId);
      return;
    }

    let typeValue = '';
    if (!category.fixedType) {
      if (!typeSelect) {
        console.error('No se encontró el selector de tipo para la categoría:', categoryId);
        return;
      }
      const activeButton = typeSelect.querySelector('.transaction-type-btn.active');
      typeValue = activeButton ? activeButton.getAttribute('data-value') : '';
      if (!typeValue || typeValue === '') {
        if (typeWarning) typeWarning.style.display = 'block';
        if (activeButton) activeButton.focus();
        return;
      }
    }

    const amountStr = amountInput.value.trim();
    const h = getHelpers();
    const normalizedFromEs = (typeof h.sanitizeAmount === 'function') ? h.sanitizeAmount(amountStr, 8, 2) : amountStr.replace(/,/g, '');
    const description = (descInput.value || '').trim();
    const dateStr = dateInput.value.trim();

    if (!amountStr || !normalizedFromEs) {
      if (amountError) {
        amountError.textContent = 'Por favor, ingresa un monto';
        amountError.style.display = 'block';
      }
      amountInput.focus();
      return;
    }

    if (!dateStr) {
      if (dateError) {
        dateError.textContent = 'Por favor, selecciona una fecha';
        dateError.style.display = 'block';
      }
      dateInput.focus();
      return;
    }

    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) {
      if (dateError) {
        dateError.textContent = 'Formato de fecha inválido';
        dateError.style.display = 'block';
      }
      dateInput.focus();
      return;
    }

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    const inputDate = new Date(year, month, day);

    const dateValidation = typeof h.validateDate === 'function' ? h.validateDate(inputDate) : validateTransactionDate(inputDate);
    if (!dateValidation.isValid) {
      if (dateError) {
        dateError.textContent = dateValidation.error;
        dateError.style.display = 'block';
      }
      dateInput.focus();
      return;
    }

    const amount = round2(parseFloat(normalizedFromEs));
    if (!amount || amount <= 0 || isNaN(amount)) {
      if (amountError) {
        amountError.textContent = 'Por favor, ingresa un monto válido';
        amountError.style.display = 'block';
      }
      amountInput.focus();
      return;
    }

    const type = category.fixedType || typeValue;

    category.transactions = category.transactions || [];
    const newId = generarId('tx');
    category.transactions.push({
      id: newId,
      type,
      amount,
      description: description || 'Sin descripción',
      date: dateValidation.date
    });

    if (typeSelect) {
      const buttons = typeSelect.querySelectorAll('.transaction-type-btn');
      buttons.forEach(btn => btn.classList.remove('active'));
    }
    amountInput.value = '';
    descInput.value = '';
    dateInput.value = typeof h.formatDate === 'function' ? h.formatDate(new Date()) : new Date().toLocaleDateString();

    if (typeWarning) typeWarning.style.display = 'none';
    if (amountError) amountError.style.display = 'none';
    if (amountDigitWarning) amountDigitWarning.style.display = 'none';
    if (dateError) dateError.style.display = 'none';

    if (typeof onUpdated === 'function') await onUpdated();
    if (typeof renderAll === 'function') renderAll();

    setTimeout(() => {
      if (window.DataEvents) {
        window.DataEvents.emit('transactionChanged', { action: 'add', categoryId, transactionId: newId });
      }
    }, 100);
  }

  async function guardarEdicionTransaccion({ buscarCategoria, onUpdated, renderAll, modal }) {
    const transactionIdRaw = document.getElementById('editTransactionId')?.value;
    const categoryIdRaw = document.getElementById('editTransactionCategoryId')?.value;
    const transactionId = isNaN(parseInt(transactionIdRaw, 10)) ? transactionIdRaw : parseInt(transactionIdRaw, 10);
    const categoryId = isNaN(parseInt(categoryIdRaw, 10)) ? categoryIdRaw : parseInt(categoryIdRaw, 10);

    const typeSelect = document.getElementById('editTransactionType');
    const amountInputEl = document.getElementById('editTransactionAmount');
    const descInputEl = document.getElementById('editTransactionDesc');
    const dateInputEl = document.getElementById('editTransactionDate');
    const amountWarning = document.getElementById('amountWarning');

    const amountStr = (amountInputEl?.value || '').trim();
    const dateStr = (dateInputEl?.value || '').trim();

    const mostrarAlerta = (t, m) => {
      if (typeof window.showAlert === 'function') window.showAlert(t, m, { variant: 'warning' });
      else alert(m);
    };

    if (!dateStr) {
      mostrarAlerta('Advertencia', 'Por favor, selecciona una fecha.');
      return;
    }

    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) {
      mostrarAlerta('Advertencia', 'Formato de fecha inválido');
      return;
    }

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    const inputDate = new Date(year, month, day);

    const h = getHelpers();
    const dateValidation = typeof h.validateDate === 'function' ? h.validateDate(inputDate) : validateTransactionDate(inputDate);
    if (!dateValidation.isValid) {
      mostrarAlerta('Advertencia', dateValidation.error);
      return;
    }

    const normalizedRaw = (typeof h.sanitizeAmount === 'function') ? h.sanitizeAmount(amountStr, 8, 2) : amountStr.replace(/,/g, '');
    const finalNumber = parseFloat(normalizedRaw);
    if (!finalNumber || finalNumber <= 0 || isNaN(finalNumber)) {
      if (amountWarning) {
        amountWarning.textContent = 'Monto inválido';
        amountWarning.style.display = 'block';
      }
      amountInputEl?.focus();
      return;
    }
    const amount = round2(finalNumber);

    const category = typeof buscarCategoria === 'function' ? buscarCategoria(categoryId) : null;
    if (!category) return;
    const transaction = (category.transactions || []).find(t => t.id == transactionId);
    if (!transaction) return;

    let transactionType = category.fixedType;
    if (!transactionType && typeSelect) {
      const activeButton = typeSelect.querySelector('.transaction-type-btn.active');
      transactionType = activeButton ? activeButton.getAttribute('data-value') : '';
    }
    transaction.type = transactionType;
    transaction.amount = amount;
    transaction.description = (descInputEl?.value || '').trim();
    transaction.date = dateValidation.date;

    if (modal && typeof window.cerrarModal === 'function') {
      window.cerrarModal(modal);
    } else if (modal && typeof window.CategoriasModals?.cerrarModal === 'function') {
      window.CategoriasModals.cerrarModal(modal);
    }

    if (typeof renderAll === 'function') renderAll();
    if (typeof onUpdated === 'function') await onUpdated();

    setTimeout(() => {
      if (window.DataEvents) {
        window.DataEvents.emit('transactionChanged', { action: 'edit', categoryId, transactionId });
      }
    }, 100);

    if (window.Toast) window.Toast.success('Transacción actualizada correctamente.');
  }

  async function agregarTransaccionDirecta(categoryId, type, amount, description, date, { buscarCategoria, onUpdated, renderAll }) {
    const category = typeof buscarCategoria === 'function' ? buscarCategoria(categoryId) : null;
    if (!category) return false;
    const resolvedType = type || category.fixedType || 'expense';
    const resolvedDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    category.transactions = category.transactions || [];
    category.transactions.push({
      id: generarId('tx'),
      type: resolvedType,
      amount: round2(amount),
      description: (description || 'Sin descripción').substring(0, 100),
      date: resolvedDate
    });

    if (typeof onUpdated === 'function') await onUpdated();
    if (typeof renderAll === 'function') renderAll();

    if (window.DataEvents) {
      window.DataEvents.emit('transactionChanged', { action: 'add', categoryId });
    }
    return true;
  }

  const CategoriasTransactionsAPI = {
    editarTransaccion: abrirModalEditarTransaccion,
    eliminarTransaccion,
    deshacerEliminacion,
    showUndoNotification,
    hideUndoNotification,
    setupEditTransactionTypeButtons,
    validateTransactionDate,
    agregarTransaccion,
    guardarEdicionTransaccion,
    agregarTransaccionDirecta,
    getLastDeleted: () => lastDeletedTransaction
  };

  if (typeof window !== 'undefined') {
    window.CategoriasTransactions = CategoriasTransactionsAPI;
    window.editarTransaccion = abrirModalEditarTransaccion;
    window.eliminarTransaccion = eliminarTransaccion;
  }

  return CategoriasTransactionsAPI;
});

