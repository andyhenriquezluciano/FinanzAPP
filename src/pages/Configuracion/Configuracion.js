/**
 * @fileoverview Página de Configuración de FinanzApp.
 *
 * Permite gestionar preferencias de visualización (tema, moneda, formato),
 * exportar e importar respaldos JSON, reiniciar datos del usuario y
 * visualizar el perfil de la cuenta activa.
 *
 * @module Configuracion
 */
(function () {
  'use strict';

  const SETTINGS_KEY = 'finanzapp:settings:v1';
  const LAST_BACKUP_KEY = 'finanzapp:lastBackupAt';

  const DEFAULT_SETTINGS = window.Helpers?.DEFAULT_SETTINGS || Object.freeze({
    theme: 'dark',
    categoryViewMode: 'compact',
    currency: 'DOP',
    numberFormat: 'us',
    tooltips: 'on',
    shortcuts: 'on',
    dateFormat: 'dmy',
    confirmDelete: 'on',
    autoRenewBudgets: 'on',
    txPerPage: '10',
    showCents: 'off',
    censorAmounts: 'off'
  });

  const CURRENCY_LOCALE_MAP = {
    DOP: { locale: 'es-DO', currency: 'DOP' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'es-ES', currency: 'EUR' }
  };

  const createFirestoreStore = window.Core?.storeFactories?.createFirestoreStore;
  const store = typeof createFirestoreStore === 'function' ? createFirestoreStore() : null;

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    snapshot: {
      transactions: [],
      categories: [],
      budgets: {}
    }
  };

  const elements = {};

  if (typeof window !== 'undefined' && window.sidebarRenderer) {
    window.sidebarRenderer.render('configuracion');
  }

  async function init() {
    cacheElements();
    attachEvents();

    const initialTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
    window.BasePage.applyTheme(initialTheme, false);

    loadSettings();
    applySettingsToForm();
    initConfigDropdowns();
    updateFormatPreview();
    populateUserInfo();
    window.BasePage.initUserInfoTooltip();

    // 1. Inicializar Firebase de inmediato
    if (window.FirestoreDB?.ensureFirebaseInitialized) {
      window.FirestoreDB.ensureFirebaseInitialized();
    }
    if (window.firebaseAuth && typeof window.firebaseAuth.init === 'function') {
      try { await window.firebaseAuth.init(); } catch (e) { window.Logger?.warn('Configuracion', 'Error inicializando firebaseAuth', e); }
    }

    // 2. Si Firebase Auth aún no ha resuelto el usuario, esperar hasta 3.5s (omitir si es invitado)
    const isGuest = (typeof window !== 'undefined' && window.AuthService)
      ? window.AuthService.isGuest()
      : (() => {
          try {
            const raw = localStorage.getItem('authUser');
            if (!raw || raw === 'guest') return true;
            const p = JSON.parse(raw);
            return p && (p.provider === 'guest' || p.uid === 'guest');
          } catch { return true; }
        })();

    if (!isGuest && window.FirestoreDB?.waitForAuth) {
      try {
        await window.FirestoreDB.waitForAuth(3500);
      } catch (e) {
        window.Logger?.warn('Configuracion', 'Timeout esperando auth en FirestoreDB', e);
      }
    }

    // 3. Poblar perfil y cargar credenciales IMAP con el usuario autenticado
    populateUserInfo();
    await loadImapCredentials();
    await refreshDataSummary();
    refreshBackupMeta();

    // 4. Suscribirse a onAuthStateChanged para cambios posteriores
    if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.auth === 'function') {
      try {
        window.firebase.auth().onAuthStateChanged(async (user) => {
          if (user) {
            try {
              if (window.AuthService) {
                window.AuthService.setUser(user);
              } else {
                localStorage.setItem('authUser', JSON.stringify({
                  name: user.displayName || user.email?.split('@')[0] || 'Usuario',
                  email: user.email || '',
                  picture: user.photoURL || user.providerData?.[0]?.photoURL || '',
                  uid: user.uid,
                  provider: user.providerData?.[0]?.providerId || 'google'
                }));
              }
            } catch (err) {
              window.Logger?.warn('Configuracion', 'Error persistiendo authUser', err);
            }
            populateUserInfo();
            await loadImapCredentials();
            await refreshDataSummary();
          }
        });
      } catch (e) {
        window.Logger?.warn('Configuracion', 'Error en listener onAuthStateChanged', e);
      }
    }
  }

  function cacheElements() {
    elements.themeToggle = document.getElementById('themeToggle');
    elements.logoutButton = document.getElementById('logoutButton');
    elements.themeShortcutBtn = document.getElementById('themeShortcutBtn');
    elements.logoutShortcutBtn = document.getElementById('logoutShortcutBtn');
    elements.logoutNowBtn = document.getElementById('logoutNowBtn');

    elements.preferencesForm = document.getElementById('preferencesForm');
    elements.themePreference = document.getElementById('themePreference');
    elements.categoryViewPreference = document.getElementById('categoryViewPreference');
    elements.currencyPreference = document.getElementById('currencyPreference');
    elements.numberFormatPreference = document.getElementById('numberFormatPreference');
    elements.tooltipsPreference = document.getElementById('tooltipsPreference');
    elements.shortcutsPreference = document.getElementById('shortcutsPreference');
    elements.dateFormatPreference = document.getElementById('dateFormatPreference');
    elements.confirmDeletePreference = document.getElementById('confirmDeletePreference');
    elements.autoRenewBudgetsPreference = document.getElementById('autoRenewBudgetsPreference');
    elements.txPerPagePreference = document.getElementById('txPerPagePreference');
    elements.showCentsPreference = document.getElementById('showCentsPreference');
    elements.censorAmountsPreference = document.getElementById('censorAmountsPreference');
    elements.formatPreview = document.getElementById('formatPreview');
    elements.preferencesStatus = document.getElementById('preferencesStatus');

    elements.resetPreferencesBtn = document.getElementById('resetPreferencesBtn');

    elements.exportBackupBtn = document.getElementById('exportBackupBtn');
    elements.importBackupInput = document.getElementById('importBackupInput');
    elements.clearDataBtn = document.getElementById('clearDataBtn');
    elements.backupStatus = document.getElementById('backupStatus');
    elements.backupMeta = document.getElementById('backupMeta');

    elements.categoriesCount = document.getElementById('categoriesCount');
    elements.transactionsCount = document.getElementById('transactionsCount');
    elements.budgetsCount = document.getElementById('budgetsCount');

    elements.profileName = document.getElementById('profileName');
    elements.profileEmail = document.getElementById('profileEmail');
    elements.profileProvider = document.getElementById('profileProvider');
    elements.profileUid = document.getElementById('profileUid');
    elements.profileAvatarLarge = document.getElementById('profileAvatarLarge');
  }

  function attachEvents() {
    window.BasePage.initThemeToggle('themeToggle');
    window.BasePage.initThemeToggle('themeShortcutBtn');

    window.BasePage.initLogout('logoutButton');
    window.BasePage.initLogout('logoutShortcutBtn');
    window.BasePage.initLogout('logoutNowBtn');

    elements.preferencesForm?.addEventListener('submit', onSavePreferences);
    document.getElementById('savePreferencesBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      onSavePreferences(e);
    });
    elements.resetPreferencesBtn?.addEventListener('click', onResetPreferences);

    elements.exportBackupBtn?.addEventListener('click', onExportBackup);
    elements.importBackupInput?.addEventListener('change', onImportBackup);
    elements.clearDataBtn?.addEventListener('click', onClearData);

    window.addEventListener('storage', (e) => {
      if (e.key === 'theme' && e.newValue) {
        window.BasePage.applyTheme(e.newValue, false);
        setDropdownValue('themePreference', e.newValue);
      }
    });

    initImapSection();
  }

  // ── Sección IMAP ──────────────────────────────────────────────────────────

  function initImapSection() {
    if (window.ConfiguracionImapSync?.initImapSection) {
      window.ConfiguracionImapSync.initImapSection({
        showToast: (msg, type) => {
          if (typeof window._configMostrarToast === 'function') {
            window._configMostrarToast(msg, type);
          } else if (window.Toast?.show) {
            window.Toast.show(msg, type);
          }
        },
        getProfile
      });
    }
  }

  async function loadImapCredentials() {
    if (window.ConfiguracionImapSync?.loadImapCredentials) {
      await window.ConfiguracionImapSync.loadImapCredentials(getProfile);
    }
  }

  // --- Custom dropdown helpers ---

  function getDropdownValue(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.tagName === 'SELECT') return el.value;
    return el.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') ?? '';
  }

  function setDropdownValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') { el.value = String(value); return; }
    const selEl = el.querySelector('.custom-dropdown-selected');
    const opts = el.querySelectorAll('.custom-dropdown-option');
    opts.forEach(opt => {
      const match = opt.getAttribute('data-value') === String(value);
      opt.classList.toggle('selected', match);
      if (match && selEl) {
        selEl.querySelector('span').textContent = opt.textContent.trim();
        selEl.setAttribute('data-value', String(value));
      }
    });
  }

  function initConfigDropdowns() {
    const dropdowns = document.querySelectorAll('.preferences-card .custom-dropdown');
    dropdowns.forEach(dd => {
      const selEl = dd.querySelector('.custom-dropdown-selected');
      if (!selEl) return;

      selEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dd.classList.contains('open');
        document.querySelectorAll('.preferences-card .custom-dropdown.open').forEach(d => d.classList.remove('open'));
        if (!isOpen) dd.classList.add('open');
      });

      selEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selEl.click();
        } else if (e.key === 'Escape') {
          dd.classList.remove('open');
        }
      });

      dd.querySelectorAll('.custom-dropdown-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.getAttribute('data-value');

          // Opcion especial: mostrar/ocultar panel de atajos sin guardar el valor
          if (dd.id === 'shortcutsPreference' && val === 'view') {
            dd.classList.remove('open');
            const panel = document.getElementById('shortcutsList');
            if (panel) {
              const isHidden = panel.classList.toggle('hidden');
              opt.innerHTML = isHidden
                ? '<i data-lucide="keyboard" aria-hidden="true"></i> Ver atajos disponibles'
                : '<i data-lucide="keyboard" aria-hidden="true"></i> Ocultar atajos de teclado';
              if (window.LucideHelper?.refresh) {
                window.LucideHelper.refresh(opt);
              } else if (window.lucide?.createIcons) {
                window.lucide.createIcons();
              }
            }
            return;
          }

          setDropdownValue(dd.id, val);
          dd.classList.remove('open');

          if (dd.id === 'themePreference') {
            window.BasePage.applyTheme(val, true);
            state.settings.theme = val;
            persistSettings();
          }

          updateFormatPreview();
        });
      });
    });

    document.addEventListener('click', () => {
      document.querySelectorAll('.preferences-card .custom-dropdown.open').forEach(d => d.classList.remove('open'));
    });
  }

  // --- End custom dropdown helpers ---

  function sanitizeSettings(raw) {
    const safe = {
      theme: raw?.theme === 'light' ? 'light' : 'dark',
      categoryViewMode: raw?.categoryViewMode === 'extended' ? 'extended' : 'compact',
      currency: CURRENCY_LOCALE_MAP[raw?.currency] ? raw.currency : DEFAULT_SETTINGS.currency,
      numberFormat: raw?.numberFormat === 'eu' ? 'eu' : 'us',
      tooltips: raw?.tooltips === 'off' ? 'off' : 'on',
      shortcuts: raw?.shortcuts === 'off' ? 'off' : 'on',
      dateFormat: raw?.dateFormat === 'mdy' ? 'mdy' : 'dmy',
      confirmDelete: raw?.confirmDelete === 'off' ? 'off' : 'on',
      autoRenewBudgets: raw?.autoRenewBudgets === 'off' ? 'off' : 'on',
      txPerPage: ['10','25','50','all'].includes(String(raw?.txPerPage)) ? String(raw.txPerPage) : '10',
      showCents: raw?.showCents === 'on' ? 'on' : 'off',
      censorAmounts: raw?.censorAmounts === 'on' ? 'on' : 'off'
    };
    return safe;
  }

  function loadSettings() {
    const storedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';

    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      state.settings = { ...DEFAULT_SETTINGS, ...sanitizeSettings(raw) };

      // El tema visual activo es global para toda la app y debe prevalecer
      // sobre cualquier valor historico guardado dentro de SETTINGS_KEY.
      state.settings.theme = storedTheme;
    } catch {
      state.settings = { ...DEFAULT_SETTINGS, theme: storedTheme };
    }

    const activeTheme = state.settings.theme || storedTheme;
    window.BasePage.applyTheme(activeTheme, true);
  }

  function applySettingsToForm() {
    setDropdownValue('themePreference', state.settings.theme || 'dark');
    setDropdownValue('categoryViewPreference', state.settings.categoryViewMode || 'compact');
    setDropdownValue('currencyPreference', state.settings.currency || 'DOP');
    setDropdownValue('numberFormatPreference', state.settings.numberFormat || 'us');
    setDropdownValue('tooltipsPreference', state.settings.tooltips || 'on');
    setDropdownValue('shortcutsPreference', state.settings.shortcuts || 'on');
    setDropdownValue('dateFormatPreference', state.settings.dateFormat || 'dmy');
    setDropdownValue('confirmDeletePreference', state.settings.confirmDelete || 'on');
    setDropdownValue('autoRenewBudgetsPreference', state.settings.autoRenewBudgets || 'on');
    setDropdownValue('txPerPagePreference', state.settings.txPerPage || '10');
    setDropdownValue('showCentsPreference', state.settings.showCents || 'off');
    setDropdownValue('censorAmountsPreference', state.settings.censorAmounts || 'off');
  }

  function readSettingsFromForm() {
    return sanitizeSettings({
      theme: getDropdownValue('themePreference') || state.settings.theme,
      categoryViewMode: getDropdownValue('categoryViewPreference') || state.settings.categoryViewMode,
      currency: getDropdownValue('currencyPreference'),
      numberFormat: getDropdownValue('numberFormatPreference'),
      tooltips: getDropdownValue('tooltipsPreference'),
      shortcuts: getDropdownValue('shortcutsPreference'),
      dateFormat: getDropdownValue('dateFormatPreference'),
      confirmDelete: getDropdownValue('confirmDeletePreference'),
      autoRenewBudgets: getDropdownValue('autoRenewBudgetsPreference'),
      txPerPage: getDropdownValue('txPerPagePreference'),
      showCents: getDropdownValue('showCentsPreference'),
      censorAmounts: getDropdownValue('censorAmountsPreference') || state.settings.censorAmounts
    });
  }

  function onSavePreferences(event) {
    event.preventDefault();
    state.settings = readSettingsFromForm();
    persistSettings();
    window.BasePage.applyTheme(state.settings.theme, true);
    updateFormatPreview();
    window._configMostrarToast('Preferencias guardadas correctamente.', 'success');
  }

  async function onResetPreferences() {
    const result = await confirmAction(
      'Restablecer preferencias',
      'Se restauraran los valores por defecto de visualizacion y formato.'
    );

    if (result !== 'confirm') return;

    state.settings = { ...DEFAULT_SETTINGS };
    persistSettings();
    window.BasePage.applyTheme(state.settings.theme, true);
    applySettingsToForm();
    updateFormatPreview();

    const panel = document.getElementById('shortcutsList');
    if (panel) panel.classList.add('hidden');
    const viewOpt = document.querySelector('#shortcutsPreference .shortcut-view-option');
    if (viewOpt) {
      viewOpt.innerHTML = '<i data-lucide="keyboard" aria-hidden="true"></i> Ver atajos disponibles';
      if (window.LucideHelper?.refresh) {
        window.LucideHelper.refresh(viewOpt);
      } else if (window.lucide?.createIcons) {
        window.lucide.createIcons();
      }
    }

    window._configMostrarToast('Preferencias restablecidas.', 'success');
  }

  function persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
      if (state.settings.theme) {
        localStorage.setItem('theme', state.settings.theme);
      }
      // Actualizar flag global y clase para censura inmediata en esta misma pestaña
      try {
        if (window.Core?.helpers && window.Helpers) {
          window.Helpers.applyAppSettings();
        } else if (window.Helpers) {
          window.Helpers.applyAppSettings();
        }
        // Toggle clase global
        const censored = state.settings.censorAmounts === 'on';
        document.documentElement.classList.toggle('censor-amounts', censored);
        if (document.body) document.body.classList.toggle('censor-amounts', censored);
        window.__appCensorAmounts = censored;
      } catch {}
      // Notificar a otras pestañas / páginas
      try {
        window.dispatchEvent(new CustomEvent('finanzapp:settings:updated', { detail: state.settings }));
        window.dispatchEvent(new StorageEvent('storage', { key: SETTINGS_KEY, newValue: JSON.stringify(state.settings) }));
      } catch {}
    } catch {
      window._configMostrarToast('No se pudieron guardar las preferencias.', 'error');
    }

    // Sincronizar TODA la configuración a Firestore para que se sincronice en tiempo real en todos los dispositivos
    try {
      if (window.FirestoreDB) {
        window.FirestoreDB.saveSettings(state.settings).catch(() => {});
      }
    } catch (e) {
      // No bloquear si Firestore falla
    }
  }

  function updateFormatPreview() {
    if (!elements.formatPreview) return;

    const currency = getDropdownValue('currencyPreference') || DEFAULT_SETTINGS.currency;
    const numberFormat = getDropdownValue('numberFormatPreference') === 'eu' ? 'eu' : 'us';
    const showCents = getDropdownValue('showCentsPreference') !== 'off';

    const sample = 1234.56;
    // La vista previa nunca se censura, incluso si "Censurar montos" está activado
    const money = formatCurrencyBySettings(sample, { currency, numberFormat, showCents });

    const date = formatDatePreview(new Date(), { numberFormat });
    elements.formatPreview.innerHTML = `<span>${money}</span><span class="preview-separator"> · </span><span>${date}</span>`;
  }

  function formatCurrencyBySettings(value, settings) {
    const currencyMeta = CURRENCY_LOCALE_MAP[settings.currency] || CURRENCY_LOCALE_MAP.USD;
    const showCents = settings.showCents !== false && settings.showCents !== 'off';

    // Obtener el símbolo de moneda usando la configuración regional del propio currency
    // y solicitando la forma estrecha ('narrowSymbol') cuando esté disponible. Esto
    // evita que elegir un 'numberFormat' global (p.ej. 'eu') cambie el símbolo usado
    // para monedas locales como COP, que de otra forma podrían mostrarse como 'COP'.
    const symbolFormatter = new Intl.NumberFormat(currencyMeta.locale, {
      style: 'currency',
      currency: currencyMeta.currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0
    });

    const parts = symbolFormatter.formatToParts(value);
    const symbol = parts.filter(p => p.type === 'currency').map(p => p.value).join('').trim();

    // Formatear solo la parte numérica según la preferencia del usuario (US/EU)
    const numericLocale = settings.numberFormat === 'eu' ? 'es-ES' : 'en-US';
    const numberFormatter = new Intl.NumberFormat(numericLocale, {
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
      useGrouping: true
    });

    const amount = numberFormatter.format(value);

    // Para monedas que comparten el símbolo "$" (varios pesos latinoamericanos),
    // mostrar una etiqueta corta junto al signo para evitar ambigüedad.
    const shortLabelMap = {
      COP: 'COL', // Colombia
      DOP: 'RD',  // República Dominicana (RD$ en la UI)
      MXN: 'MX',  // México
      ARS: 'ARS', // Argentina
      CLP: 'CLP'  // Chile
    };

    if (symbol === '$') {
      // Mostrar solo '$' para USD; para los demás pesos mostrar etiqueta corta (COL$, RD$, MX$, etc.)
      if (currencyMeta.currency === 'USD') {
        return `${symbol}${amount}`;
      }
      const short = shortLabelMap[currencyMeta.currency] || currencyMeta.currency;
      return `${short}${symbol}${amount}`;
    }

    return `${symbol}${amount}`;
  }

  function formatDatePreview(date, settings) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    const format = getDropdownValue && typeof getDropdownValue === 'function'
      ? getDropdownValue('dateFormatPreference')
      : settings?.dateFormat;

    if (format === 'mdy') {
      return `${month} / ${day} / ${year}`;
    }

    return `${day} / ${month} / ${year}`;
  }

  async function refreshDataSummary() {
    if (!store) {
      setStatus(elements.backupStatus, 'No se pudo inicializar el almacenamiento de datos.', 'error');
      return;
    }

    try {
      const loaded = await store.load();
      state.snapshot = normalizeState(loaded);

      const categoryCount = state.snapshot.categories.length;
      const txCount = countTransactions(state.snapshot);
      const budgetCount = countBudgets(state.snapshot);

      if (elements.categoriesCount) elements.categoriesCount.textContent = String(categoryCount);
      if (elements.transactionsCount) elements.transactionsCount.textContent = String(txCount);
      if (elements.budgetsCount) elements.budgetsCount.textContent = String(budgetCount);
    } catch (error) {
      console.error('Error cargando resumen de datos:', error);
      setStatus(elements.backupStatus, 'No se pudo leer el estado actual de tus datos.', 'error');
    }
  }

  function normalizeState(raw) {
    return window.ConfiguracionBackup ? window.ConfiguracionBackup.normalizeState(raw) : { transactions: [], categories: [], budgets: {} };
  }

  function countTransactions(snapshot) {
    return window.ConfiguracionBackup ? window.ConfiguracionBackup.countTransactions(snapshot) : 0;
  }

  function countBudgets(snapshot) {
    return window.ConfiguracionBackup ? window.ConfiguracionBackup.countBudgets(snapshot) : 0;
  }

  function hasForbiddenKeys(value) {
    return window.ConfiguracionBackup ? window.ConfiguracionBackup.hasForbiddenKeys(value) : false;
  }

  function isValidImportAmount(amount) {
    return window.ConfiguracionBackup ? window.ConfiguracionBackup.isValidImportAmount(amount) : false;
  }

  function isValidImportDate(value) {
    return window.ConfiguracionBackup ? window.ConfiguracionBackup.isValidImportDate(value) : false;
  }

  function isValidImportString(value) {
    return window.ConfiguracionBackup ? window.ConfiguracionBackup.isValidImportString(value) : false;
  }

  function validateImportPayload(state) {
    return window.ConfiguracionBackup ? window.ConfiguracionBackup.validateImportPayload(state) : false;
  }

  function normalizeImportPayload(parsed) {
    return window.ConfiguracionBackup ? window.ConfiguracionBackup.normalizeImportPayload(parsed, sanitizeSettings) : null;
  }

  async function onExportBackup() {
    if (window.ConfiguracionBackup) {
      await window.ConfiguracionBackup.exportBackup({
        store,
        settings: state.settings,
        onStatus: (msg, type) => setStatus(elements.backupStatus, msg, type),
        showToast: (msg, type) => {
          if (typeof window._configMostrarToast === 'function') {
            window._configMostrarToast(msg, type);
          } else if (window.Toast?.show) {
            window.Toast.show(msg, type);
          }
        }
      });
      refreshBackupMeta();
    }
  }

  async function onImportBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (window.ConfiguracionBackup) {
        await window.ConfiguracionBackup.importBackup({
          file,
          store,
          state,
          defaultSettings: DEFAULT_SETTINGS,
          confirmAction,
          persistSettings,
          applyTheme: (theme) => window.BasePage.applyTheme(theme, true),
          applySettingsToForm,
          updateFormatPreview,
          refreshDataSummary,
          onStatus: (msg, type) => setStatus(elements.backupStatus, msg, type),
          showToast: (msg, type) => {
            if (typeof window._configMostrarToast === 'function') {
              window._configMostrarToast(msg, type);
            } else if (window.Toast?.show) {
              window.Toast.show(msg, type);
            }
          },
          sanitizeSettingsFn: sanitizeSettings
        });
      }
    } finally {
      event.target.value = '';
    }
  }

  async function onClearData() {
    if (window.ConfiguracionBackup) {
      await window.ConfiguracionBackup.clearData({
        store,
        state,
        confirmAction,
        refreshDataSummary,
        onStatus: (msg, type) => setStatus(elements.backupStatus, msg, type),
        showToast: (msg, type) => {
          if (typeof window._configMostrarToast === 'function') {
            window._configMostrarToast(msg, type);
          } else if (window.Toast?.show) {
            window.Toast.show(msg, type);
          }
        }
      });
    }
  }

  function refreshBackupMeta() {
    if (!elements.backupMeta) return;
    const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
    if (!lastBackup) {
      elements.backupMeta.textContent = 'Sin respaldo exportado en esta sesion.';
      return;
    }
    const date = new Date(lastBackup);
    if (Number.isNaN(date.getTime())) {
      elements.backupMeta.textContent = 'Sin respaldo exportado en esta sesion.';
      return;
    }
    elements.backupMeta.textContent = `Ultimo respaldo: ${date.toLocaleString('es-ES')}`;
  }

  const _statusTimers = new WeakMap();

  function setStatus(target, text, type, duration = 5000) {
    if (!target) return;

    if (_statusTimers.has(target)) {
      clearTimeout(_statusTimers.get(target));
      _statusTimers.delete(target);
    }

    target.textContent = text;
    target.classList.remove('is-success', 'is-error');

    if (type === 'error') {
      target.classList.add('is-error');
    } else if (type === 'success') {
      target.classList.add('is-success');
    }

    if (duration > 0 && text) {
      const timer = setTimeout(() => {
        target.textContent = '';
        target.classList.remove('is-success', 'is-error');
        _statusTimers.delete(target);
      }, duration);
      _statusTimers.set(target, timer);
    }
  }

  window._configMostrarToast = function (message, variant, duration = 5000) {
    if (window.__appTooltips === false) return;
    if (window.Toast) {
      window.Toast.show(message, variant || 'success', duration);
    }
  };

  function confirmAction(title, message, options = {}) {
    if (typeof window.showAlert === 'function') {
      return window.showAlert(title, message, {
        variant: 'confirm',
        ...options
      });
    }

    const ok = window.confirm(message);
    return Promise.resolve(ok ? 'confirm' : 'cancel');
  }

  function populateUserInfo() {
    const profile = getProfile();
    const displayName = profile.name || profile.displayName || profile.email?.split('@')[0] || 'Usuario';
    const displayEmail = profile.email || '';
    const provider = profile.provider || (profile.uid === 'guest' ? 'guest' : 'local');
    const providerLabel = provider === 'google' ? 'Google' : (provider === 'guest' ? 'Invitado' : 'Cuenta local');
    const uidShort = profile.uid ? String(profile.uid).slice(0, 12) : 'Sin UID';

    const nameEl = document.getElementById('profileName') || elements.profileName;
    const emailEl = document.getElementById('profileEmail') || elements.profileEmail;
    const providerEl = document.getElementById('profileProvider') || elements.profileProvider;
    const uidEl = document.getElementById('profileUid') || elements.profileUid;
    const avatarLargeEl = document.getElementById('profileAvatarLarge') || elements.profileAvatarLarge;

    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = displayEmail || 'Sin correo asociado';
    if (providerEl) providerEl.textContent = providerLabel;
    if (uidEl) uidEl.textContent = uidShort;

    const sidebarName = document.querySelector('.sidebar .user-name');
    const sidebarEmail = document.querySelector('.sidebar .user-email');
    const sidebarAvatar = document.querySelector('.sidebar .user-avatar');

    if (sidebarName) sidebarName.textContent = displayName;
    if (sidebarEmail) {
      sidebarEmail.textContent = displayEmail;
      sidebarEmail.style.display = displayEmail ? 'block' : 'none';
    }

    renderAvatar(sidebarAvatar, displayName, profile.picture || profile.photoURL);
    renderAvatar(avatarLargeEl, displayName, profile.picture || profile.photoURL);

    const tooltipName = document.querySelector('#profileTooltip .tooltip-name');
    const tooltipEmail = document.querySelector('#profileTooltip .tooltip-email');
    if (tooltipName) tooltipName.textContent = displayName;
    if (tooltipEmail) {
      tooltipEmail.textContent = displayEmail;
      tooltipEmail.style.display = displayEmail ? 'block' : 'none';
    }
  }

  function getProfile() {
    if (typeof window !== 'undefined' && window.AuthService) {
      const u = window.AuthService.getUser();
      if (u) return u;
    }
    if (window.ProfileSync?.getUserData) {
      return window.ProfileSync.getUserData();
    }
    try {
      const raw = localStorage.getItem('authUser');
      return (raw && raw !== 'guest') ? JSON.parse(raw) : { name: 'Invitado', email: '', uid: 'guest', provider: 'guest' };
    } catch {
      return { name: 'Usuario', email: '', uid: 'guest', provider: 'local' };
    }
  }

  function renderAvatar(container, name, pictureUrl) {
    if (window.ProfileSync?.renderAvatar) {
      window.ProfileSync.renderAvatar(container, name, pictureUrl);
    }
  }

  /**
   * Controlador de página que extiende BasePage.
   * Delega el bootstrap completo a `init()` y registra
   * la recarga de datos ante eventos cross-tab.
   *
   * @extends {window.BasePage}
   */
  class ConfiguracionApp extends window.BasePage {
    /**
     * Punto de entrada tras DOMContentLoaded.
     * Llama a `init()` que gestiona DOM, eventos y carga de datos.
     *
     * @override
     * @returns {Promise<void>}
     */
    async _init() {
      await init();
      this._bindCrossTabEvents();
    }

    /**
     * Suscribe a `datos:actualizados` para recargar el resumen
     * de datos cuando otra pestaña persiste cambios.
     *
     * @override
     */
    _bindCrossTabEvents() {
      const handleRemoteUpdate = async () => {
        loadSettings();
        applySettingsToForm();
        updateFormatPreview();
        await refreshDataSummary();
      };

      if (window.DataEvents) {
        window.DataEvents.on('datos:actualizados', handleRemoteUpdate);
      }
      window.addEventListener('finanzapp:data:updated', handleRemoteUpdate);
    }

  }

  const _configuracionApp = new ConfiguracionApp(); // eslint-disable-line no-unused-vars
})();
