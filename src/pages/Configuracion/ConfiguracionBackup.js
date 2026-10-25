/**
 * FinanzApp - Configuracion Backup & Data Management Module
 * Single Responsibility: Import, export, validate, and reset financial data and settings
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ConfiguracionBackup = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const MAX_IMPORT_STRING_LENGTH = 500;
  const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const LAST_BACKUP_KEY = 'finanzapp:last-backup-date';

  function hasForbiddenKeys(value) {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(hasForbiddenKeys);
    return Object.keys(value).some(key => FORBIDDEN_KEYS.has(key)) ||
           Object.values(value).some(hasForbiddenKeys);
  }

  function isValidImportAmount(amount) {
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? '').replace(/[^0-9.-]/g, ''));
    return !Number.isNaN(num) && Number.isFinite(num) && Math.abs(num) <= 1e12;
  }

  function isValidImportDate(value) {
    if (value instanceof Date) return !isNaN(value.getTime());
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return true;
    if (typeof value !== 'string' || !value.trim()) return false;
    return !isNaN(new Date(value).getTime());
  }

  function isValidImportString(value) {
    return typeof value !== 'string' || value.length <= MAX_IMPORT_STRING_LENGTH;
  }

  function validateImportPayload(state) {
    if (!state || typeof state !== 'object') return false;

    const transactions = Array.isArray(state.transactions) ? state.transactions : [];
    for (const t of transactions) {
      if (!isValidImportAmount(t?.amount)) return false;
      if (!isValidImportDate(t?.date)) return false;
      if (!isValidImportString(t?.description)) return false;
      if (!isValidImportString(t?.id)) return false;
    }

    const categories = Array.isArray(state.categories) ? state.categories : [];
    for (const c of categories) {
      if (!isValidImportString(c?.name)) return false;
      if (!isValidImportString(c?.id)) return false;
      const nested = Array.isArray(c?.transactions) ? c.transactions : [];
      for (const t of nested) {
        if (!isValidImportAmount(t?.amount)) return false;
        if (!isValidImportDate(t?.date)) return false;
        if (!isValidImportString(t?.description)) return false;
        if (!isValidImportString(t?.id)) return false;
      }
    }

    return true;
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') {
      return {
        transactions: [],
        categories: [],
        budgets: {}
      };
    }

    if (hasForbiddenKeys(raw)) {
      throw new Error('Formato de respaldo no válido.');
    }

    let rawCategories = Array.isArray(raw)
      ? raw
      : (Array.isArray(raw?.categories) ? raw.categories : (Array.isArray(raw?.data?.categories) ? raw.data.categories : []));

    let rawTransactions = Array.isArray(raw?.transactions)
      ? raw.transactions
      : (Array.isArray(raw?.data?.transactions) ? raw.data.transactions : []);

    if (rawTransactions.length === 0 && rawCategories.length > 0) {
      rawCategories.forEach(cat => {
        if (Array.isArray(cat?.transactions)) {
          rawTransactions.push(...cat.transactions.map(t => ({
            ...t,
            categoryId: cat.id,
            categoryName: cat.name
          })));
        }
      });
    }

    if (rawTransactions.length > 0 && rawCategories.length > 0) {
      rawCategories = rawCategories.map(cat => {
        const catTxs = Array.isArray(cat.transactions) ? [...cat.transactions] : [];
        rawTransactions.forEach(t => {
          if (String(t.categoryId) === String(cat.id) || (t.categoryName && String(cat.name).toLowerCase() === String(t.categoryName).toLowerCase())) {
            if (!catTxs.some(ct => String(ct.id) === String(t.id))) {
              catTxs.push(t);
            }
          }
        });
        return { ...cat, transactions: catTxs };
      });
    }

    const rawBudgets = raw?.budgets || raw?.data?.budgets;
    const normalizedBudgets = rawBudgets && typeof rawBudgets === 'object' ? rawBudgets : {};

    return {
      transactions: rawTransactions,
      categories: rawCategories,
      budgets: normalizedBudgets
    };
  }

  function countTransactions(snapshot) {
    const topLevel = Array.isArray(snapshot?.transactions) ? snapshot.transactions.length : 0;
    const nested = (snapshot?.categories || []).reduce((sum, category) => {
      return sum + (Array.isArray(category?.transactions) ? category.transactions.length : 0);
    }, 0);

    return Math.max(topLevel, nested);
  }

  function countBudgets(snapshot) {
    if (Array.isArray(snapshot?.budgets)) {
      return snapshot.budgets.length;
    }

    if (snapshot?.budgets && typeof snapshot.budgets === 'object') {
      return Object.keys(snapshot.budgets).length;
    }

    return 0;
  }

  function normalizeImportPayload(parsed, sanitizeSettingsFn) {
    if (!parsed || typeof parsed !== 'object' || hasForbiddenKeys(parsed)) return null;

    const sourceState = parsed.state && typeof parsed.state === 'object'
      ? parsed.state
      : parsed;

    if (!sourceState || hasForbiddenKeys(sourceState)) return null;

    const normalizedState = normalizeState(sourceState);

    if (!validateImportPayload(normalizedState)) return null;

    const hasData =
      normalizedState.transactions.length > 0 ||
      normalizedState.categories.length > 0 ||
      countBudgets(normalizedState) > 0;

    if (!hasData && !parsed.state) {
      return null;
    }

    const settings = parsed.settings && typeof sanitizeSettingsFn === 'function'
      ? sanitizeSettingsFn(parsed.settings)
      : (parsed.settings || null);

    return {
      state: normalizedState,
      settings
    };
  }

  async function exportBackup({ store, settings, onStatus, showToast }) {
    if (!store) return;

    try {
      const loaded = await store.load();
      const snapshot = normalizeState(loaded);

      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: settings || {},
        state: snapshot
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const filename = `finanzapp-respaldo-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      localStorage.setItem(LAST_BACKUP_KEY, payload.exportedAt);
      refreshBackupMeta();

      if (typeof showToast === 'function') {
        showToast('Respaldo exportado correctamente.', 'success');
      } else if (typeof onStatus === 'function') {
        onStatus('Respaldo exportado correctamente.', 'success');
      }
      return snapshot;
    } catch (error) {
      console.error('Error exportando respaldo:', error);
      if (typeof onStatus === 'function') {
        onStatus('No se pudo exportar el respaldo.', 'error');
      }
      throw error;
    }
  }

  async function importBackup({ file, store, state, defaultSettings, confirmAction, persistSettings, applyTheme, applySettingsToForm, updateFormatPreview, refreshDataSummary, onStatus, showToast, sanitizeSettingsFn }) {
    if (!file) return;

    try {
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        throw new Error('El archivo de respaldo es demasiado grande.');
      }

      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = normalizeImportPayload(parsed, sanitizeSettingsFn);

      if (!payload) {
        throw new Error('Formato de respaldo inválido.');
      }

      const result = await confirmAction(
        'Importar respaldo',
        'Esta acción reemplazará tus datos actuales por los del archivo seleccionado.',
        { emphasis: 'danger' }
      );

      if (result !== 'confirm') {
        return;
      }

      if (!store) {
        throw new Error('No hay almacenamiento disponible para importar datos.');
      }

      await store.save(payload.state);
      state.snapshot = payload.state;

      try {
        localStorage.setItem('categories', JSON.stringify(payload.state.categories || []));
        localStorage.setItem('transactions', JSON.stringify(payload.state.transactions || []));
        localStorage.setItem('finanzapp:budgets', JSON.stringify(payload.state.budgets || {}));
        localStorage.setItem('budgets', JSON.stringify(payload.state.budgets || {}));
      } catch (e) {
        console.warn('Error writing to root localStorage for import:', e);
      }

      if (payload.settings) {
        state.settings = { ...(defaultSettings || {}), ...payload.settings };
        if (typeof persistSettings === 'function') persistSettings();
        if (typeof applyTheme === 'function') applyTheme(state.settings.theme, true);
        if (typeof applySettingsToForm === 'function') applySettingsToForm();
        if (typeof updateFormatPreview === 'function') updateFormatPreview();
      }

      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      refreshBackupMeta();
      if (typeof refreshDataSummary === 'function') await refreshDataSummary();

      if (typeof onStatus === 'function') {
        onStatus('Respaldo importado y aplicado correctamente.', 'success');
      }

      try {
        if (window.DataEvents) {
          window.DataEvents.emit('datos:actualizados', payload.state);
          window.DataEvents.emit('dataImported', { categoriesCount: payload.state.categories.length });
          window.DataEvents.emit('budgetChanged', { action: 'imported' });
        }
        window.dispatchEvent(new CustomEvent('finanzapp:data:updated', { detail: payload.state }));
      } catch (_) {}

      if (typeof showToast === 'function') {
        showToast('Respaldo importado y aplicado correctamente.', 'success');
      }
    } catch (error) {
      console.error('Error importando respaldo:', error);
      if (typeof onStatus === 'function') {
        onStatus('No se pudo importar el respaldo. Verifica el archivo.', 'error');
      }
      throw error;
    }
  }

  async function clearData({ store, state, confirmAction, refreshDataSummary, onStatus, showToast }) {
    const result = await confirmAction(
      'Reiniciar datos financieros',
      'Se eliminarán todas tus categorías y presupuestos. Esta acción no se puede deshacer.',
      { emphasis: 'danger' }
    );

    if (result !== 'confirm') return;

    try {
      if (!store) {
        throw new Error('No se pudo acceder al almacenamiento para borrar datos.');
      }

      const emptyState = {
        transactions: [],
        categories: [],
        budgets: {}
      };

      await store.save(emptyState);
      state.snapshot = emptyState;

      try {
        if (window.FirestoreDB && window.firebase) {
          if (!window.FirestoreDB.initialized || !window.FirestoreDB.currentUserId) {
            try {
              const uid = await window.FirestoreDB.waitForAuth(3000);
              if (uid) {
                await window.FirestoreDB.init(uid);
                window.FirestoreDB.setCurrentUser(uid);
              }
            } catch {}
          }
          if (window.FirestoreDB.initialized && window.FirestoreDB.currentUserId && window.FirestoreDB.db) {
            const userRef = window.FirestoreDB._userDoc();
            try {
              const txSnap = await userRef.collection('transactions').get();
              const catSnap = await userRef.collection('categories').get();
              const allDocs = [...(txSnap.docs || []), ...(catSnap.docs || [])];
              if (allDocs.length > 0) {
                const chunks = [];
                for (let i = 0; i < allDocs.length; i += 450) chunks.push(allDocs.slice(i, i + 450));
                for (const chunk of chunks) {
                  const batch = window.FirestoreDB.db.batch();
                  chunk.forEach(d => batch.delete(d.ref));
                  await batch.commit();
                }
              }
            } catch (e) {
              console.warn('[ConfiguracionBackup] No se pudieron borrar subcolecciones:', e);
            }
            await window.FirestoreDB.saveAll(emptyState);
          }
        }
      } catch (e) {
        console.warn('[ConfiguracionBackup] No se pudo limpiar Firestore directamente:', e);
      }

      try {
        const prefix = 'finanzapp:data:v1';
        const uids = new Set();
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith(prefix + ':')) continue;
          const parts = k.split(':');
          if (parts.length >= 4) {
            const uid = parts.slice(3, parts.length - 1).join(':');
            if (uid) uids.add(uid);
          }
        }
        const curUid = (typeof window !== 'undefined' && window.AuthService)
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
        uids.add(curUid);

        uids.forEach(uid => {
          try {
            localStorage.setItem(`${prefix}:${uid}:categories`, '[]');
            localStorage.setItem(`${prefix}:${uid}:transactions`, '[]');
            localStorage.setItem(`${prefix}:${uid}:budgets`, '{}');
          } catch {}
        });

        localStorage.setItem('categories', '[]');
        localStorage.setItem('transactions', '[]');
        localStorage.setItem('budgets', '{}');
        localStorage.setItem('finanzapp:budgets', JSON.stringify([]));
        try { localStorage.removeItem('finanzapp:budgets:backup'); } catch {}
      } catch (e) {}

      try {
        window.dispatchEvent(new CustomEvent('finanzapp:data:updated', { detail: emptyState }));
        if (window.DataEvents && typeof window.DataEvents.emit === 'function') {
          window.DataEvents.emit('datos:actualizados', emptyState);
          window.DataEvents.emit('transactionChanged', { action: 'clearAll' });
        }
      } catch {}

      if (typeof refreshDataSummary === 'function') await refreshDataSummary();
      if (typeof showToast === 'function') {
        showToast('Categorías y presupuestos eliminados correctamente.', 'success');
      } else if (typeof onStatus === 'function') {
        onStatus('Categorías y presupuestos eliminados correctamente.', 'success');
      }
    } catch (error) {
      console.error('Error reiniciando datos:', error);
      if (typeof onStatus === 'function') {
        onStatus('No fue posible reiniciar los datos.', 'error');
      }
      throw error;
    }
  }

  function refreshBackupMeta() {
    const backupMetaEl = document.getElementById('backupMeta');
    if (!backupMetaEl) return;

    const last = localStorage.getItem(LAST_BACKUP_KEY);
    if (!last) {
      backupMetaEl.textContent = 'Sin respaldos recientes';
      return;
    }

    const date = new Date(last);
    if (isNaN(date.getTime())) {
      backupMetaEl.textContent = 'Sin respaldos recientes';
      return;
    }

    const formatted = new Intl.DateTimeFormat('es-DO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);

    backupMetaEl.textContent = `Último respaldo: ${formatted}`;
  }

  return {
    hasForbiddenKeys,
    isValidImportAmount,
    isValidImportDate,
    isValidImportString,
    validateImportPayload,
    normalizeState,
    countTransactions,
    countBudgets,
    normalizeImportPayload,
    exportBackup,
    importBackup,
    clearData,
    refreshBackupMeta
  };
});

