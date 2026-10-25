/**
 * @fileoverview Clase base para todas las páginas de FinanzApp.
 *
 * Centraliza la funcionalidad compartida entre páginas:
 * - Verificación de autenticación y redirección a Login
 * - Carga y refresco de datos del usuario via DataStore
 * - Aplicación del tema (claro/oscuro)
 * - Actualización del perfil de usuario en el sidebar
 * - Suscripción a eventos cross-tab via DataEvents
 *
 * Las páginas deben extender `BasePage` e implementar los hooks:
 * - `onDataLoaded(data)` - se ejecuta tras la carga inicial de datos
 * - `bindEvents()` - registra los eventos de la página (llamar `super.bindEvents()`)
 *
 * @example
 * class DashboardApp extends BasePage {
 *   async onDataLoaded(data) {
 *     // Renderizar con los datos cargados
 *     this.renderTransactions(data.transactions);
 *   }
 *
 *   bindEvents() {
 *     super.bindEvents();
 *     document.getElementById('btnAgregar')
 *       .addEventListener('click', () => this.abrirFormulario());
 *   }
 * }
 *
 * document.addEventListener('DOMContentLoaded', () => new DashboardApp());
 */
class BasePage {
  /**
   * Datos del usuario actualmente cargados.
   * @type {{ transactions: Array, categories: Array, budgets: Object, user: Object }}
   */
  datosUsuario = {
    transactions: [],
    categories:   [],
    budgets:      {},
    user:         {}
  };

  /** @type {boolean} Indica si los datos fueron cargados al menos una vez */
  dataLoaded = false;

  constructor() {
    this._checkAuth();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._init());
    } else {
      setTimeout(() => this._init(), 0);
    }
  }

  // ---------------------------------------------------------------------------
  // Ciclo de vida y Autenticación
  // ---------------------------------------------------------------------------

  /**
   * Verifica que haya una sesión activa; redirige a Login si no la hay.
   * Normaliza perfiles antiguos de invitado sin requerir recarga forzada.
   * @protected
   */
  _checkAuth() {
    try {
      if (typeof window !== 'undefined' && window.AuthService) {
        if (!window.AuthService.isLoggedIn()) {
          window.location.replace('/pages/Login/Login.html');
          return;
        }
        window.AuthService.normalizeGuestProfile();
        return;
      }
      const loggedIn = localStorage.getItem('loggedIn');
      const authUser = localStorage.getItem('authUser');
      if (!loggedIn || !authUser) {
        window.location.replace('/pages/Login/Login.html');
        return;
      }
    } catch {
      window.location.replace('/pages/Login/Login.html');
    }
  }

  /**
   * Punto de entrada tras DOMContentLoaded.
   * Aplica tema, actualiza perfil, tooltips, logout, carga datos y registra eventos.
   * @protected
   */
  async _init() {
    BasePage.applyTheme();
    BasePage.initThemeToggle();
    BasePage.updateUserProfile();
    BasePage.initUserInfoTooltip();
    BasePage.initLogout();

    await this._loadData();
    this.bindEvents();
    this._bindCrossTabEvents();
    this._triggerBackgroundImapSync();
  }

  /**
   * Sincroniza correos bancarios en segundo plano cuando el usuario tiene IMAP configurado.
   * Evita saturar con un intervalo mínimo de 10 minutos entre chequeos automáticos.
   * @private
   */
  async _triggerBackgroundImapSync() {
    try {
      if (!window.SyncAPI || typeof window.SyncAPI.syncImapOnDemand !== 'function') return;
      const user = window.AuthService ? window.AuthService.getUser() : null;
      if (!user || user.provider === 'guest' || user.uid === 'guest') return;

      const lastCheckKey = 'finanzapp:last_bg_sync';
      const lastCheck = parseInt(localStorage.getItem(lastCheckKey) || '0', 10);
      const MIN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos entre chequeos en segundo plano
      if (Date.now() - lastCheck < MIN_INTERVAL_MS) return;
      localStorage.setItem(lastCheckKey, Date.now().toString());

      window.SyncAPI.syncImapOnDemand().then(result => {
        if (result && result.count > 0) {
          window.dispatchEvent(new CustomEvent('finanzapp:gmail:notifications-updated'));
        }
      }).catch(() => { /* silencioso en segundo plano */ });
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Datos
  // ---------------------------------------------------------------------------

  /**
   * Carga los datos del usuario desde FirestoreStore (con fallback a localStorage).
   * Llama a `onDataLoaded()` con los datos obtenidos.
   * @protected
   */
  async _loadData() {
    try {
      const storeFactory = window.Core?.storeFactories?.createFirestoreStore;
      const store = typeof storeFactory === 'function' ? storeFactory() : null;
      const data  = store ? await store.load() : null;
      if (data) {
        this.datosUsuario.transactions = data.transactions || [];
        this.datosUsuario.categories   = data.categories   || [];
        this.datosUsuario.budgets      = data.budgets      || {};
      }
      this.datosUsuario.user = window.AuthService?.getUser() || {};
      this.dataLoaded = true;

      if (window.appStore && typeof window.appStore.setState === 'function') {
        window.appStore.setState({
          transactions: this.datosUsuario.transactions,
          categories: this.datosUsuario.categories,
          budgets: this.datosUsuario.budgets,
          user: this.datosUsuario.user
        });
      }

      await this.onDataLoaded(this.datosUsuario);
    } catch (err) {
      console.error(`[${this.constructor.name}] Error cargando datos:`, err);
    }
  }

  /**
   * Hook llamado tras la carga (o recarga) de datos.
   * Implementar en la subclase para renderizar la página con los datos recibidos.
   *
   * @param {{ transactions: Array, categories: Array, budgets: Object, user: Object }} data
   * @returns {Promise<void>}
   */
  async onDataLoaded(data) { // eslint-disable-line no-unused-vars
    // Sobreescribir en la subclase
  }

  // ---------------------------------------------------------------------------
  // Tema Centralizado (Estático y de Instancia)
  // ---------------------------------------------------------------------------

  /**
   * Aplica un tema ('light' o 'dark') al documento, actualiza iconos y persiste la elección.
   * @param {'light'|'dark'|null} [requestedTheme] - Si no se especifica, lee de localStorage/settings.
   * @param {boolean} [saveToSettings=true] - Si debe persistirse en settings y Firestore.
   */
  static applyTheme(requestedTheme = null, saveToSettings = true) {
    try {
      let theme = requestedTheme;
      if (!theme) {
        theme = localStorage.getItem('theme');
        if (!theme) {
          const settings = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
          theme = settings?.theme;
        }
      }
      theme = theme === 'light' ? 'light' : 'dark';

      const root = document.documentElement;
      const body = document.body;
      root.setAttribute('data-theme', theme);
      if (body) body.setAttribute('data-theme', theme);

      const bgColor = theme === 'light' ? '#f5efea' : '#191724';
      root.style.backgroundColor = bgColor;
      if (body) body.style.backgroundColor = bgColor;

      localStorage.setItem('theme', theme);

      if (saveToSettings) {
        try {
          const rawSettings = localStorage.getItem('finanzapp:settings:v1');
          const settings = rawSettings ? JSON.parse(rawSettings) : {};
          settings.theme = theme;
          localStorage.setItem('finanzapp:settings:v1', JSON.stringify(settings));
          if (window.FirestoreDB && typeof window.FirestoreDB.saveSettings === 'function' && window.FirestoreDB.currentUserId) {
            window.FirestoreDB.saveSettings(settings).catch(() => {});
          }
        } catch (e) {
          window.Logger?.warn('BasePage', 'Error guardando tema en settings', e);
        }
      }

      BasePage.updateThemeIcons(theme);
    } catch (e) {
      window.Logger?.warn('BasePage', 'Error aplicando tema', e);
    }
  }

  /**
   * Alterna entre modo claro y modo oscuro.
   */
  static toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    BasePage.applyTheme(next, true);
  }

  /**
   * Actualiza los iconos del botón de alternar tema en la interfaz.
   * @param {'light'|'dark'} theme
   */
  static updateThemeIcons(theme) {
    try {
      const toggleButtons = document.querySelectorAll('#themeToggle, .theme-toggle-btn');
      toggleButtons.forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
        }
        if (window.LucideHelper && typeof window.LucideHelper.refresh === 'function') {
          window.LucideHelper.refresh(btn);
        }
      });
    } catch (e) {
      window.Logger?.warn('BasePage', 'Error actualizando iconos de tema', e);
    }
  }

  /**
   * Inicializa el listener del botón de tema y sincronización entre pestañas.
   * @param {string} [buttonId='themeToggle']
   */
  static initThemeToggle(buttonId = 'themeToggle') {
    const btn = document.getElementById(buttonId);
    if (btn && !btn._themeToggleBound) {
      btn._themeToggleBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        BasePage.toggleTheme();
      });
    }

    if (!window._basePageThemeStorageBound) {
      window._basePageThemeStorageBound = true;
      window.addEventListener('storage', (e) => {
        if (e.key === 'theme' && e.newValue) {
          BasePage.applyTheme(e.newValue, false);
        }
      });
    }
  }

  _applyTheme() {
    BasePage.applyTheme();
  }

  // ---------------------------------------------------------------------------
  // Cierre de Sesión Seguro (Logout)
  // ---------------------------------------------------------------------------

  /**
   * Ejecuta el cierre de sesión unificado con confirmación, desconexión de Firebase
   * y redirección segura sin eliminar configuraciones persistentes del usuario.
   * @returns {Promise<boolean>}
   */
  static async handleLogout() {
    const confirmed = await (typeof window.showAlert === 'function'
      ? window.showAlert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', { variant: 'confirm', emphasis: 'danger' })
      : Promise.resolve(window.confirm('¿Estás seguro de que deseas cerrar sesión?') ? 'confirm' : 'cancel'));

    if (confirmed !== 'confirm') return false;

    try {
      sessionStorage.setItem('finanzapp:logged_out', '1');
      localStorage.setItem('logoutTimestamp', Date.now().toString());

      if (window.firebaseAuth && typeof window.firebaseAuth.logout === 'function') {
        await window.firebaseAuth.logout();
      } else if (window.firebase && typeof window.firebase.auth === 'function') {
        try {
          await window.firebase.auth().signOut();
        } catch (e) {
          window.Logger?.warn('BasePage', 'Error cerrando sesión en Firebase', e);
        }
      }
    } catch (err) {
      window.Logger?.error('BasePage', 'Error durante logout', err);
    } finally {
      sessionStorage.setItem('finanzapp:logged_out', '1');
      localStorage.setItem('logoutTimestamp', Date.now().toString());
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('authUser');
      window.location.replace('/pages/Login/Login.html?logout=true');
    }
    return true;
  }

  /**
   * Vincula un botón de cierre de sesión al flujo seguro de BasePage.
   * @param {string} [buttonId='logoutButton']
   */
  static initLogout(buttonId = 'logoutButton') {
    const btn = document.getElementById(buttonId);
    if (btn && !btn._baseLogoutBound) {
      btn._baseLogoutBound = true;
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await BasePage.handleLogout();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Perfil de Usuario y Tooltip
  // ---------------------------------------------------------------------------

  /**
   * Actualiza los elementos del sidebar y perfil con los datos del usuario.
   * @param {Object|null} [userObj]
   */
  static updateUserProfile(userObj = null) {
    if (typeof window !== 'undefined' && window.ProfileSync) {
      window.ProfileSync.sync(userObj);
      return;
    }
    try {
      let user = userObj;
      if (!user) {
        user = (typeof window !== 'undefined' && window.AuthService)
          ? window.AuthService.getUser()
          : null;
        if (!user) {
          try {
            const raw = localStorage.getItem('authUser');
            user = (raw && raw !== 'guest') ? JSON.parse(raw) : null;
          } catch {}
        }
      }

      const name    = user?.name || user?.displayName || user?.email?.split('@')[0] || 'Invitado';
      const email   = user?.email || '';
      const picture = user?.picture || user?.photoURL || '';

      const nameEl     = document.querySelector('.user-name');
      const emailEl    = document.querySelector('.user-email');
      const avatarEl   = document.querySelector('.user-avatar');

      if (nameEl) {
        nameEl.textContent = name;
        nameEl.setAttribute('aria-label', name);
      }
      if (emailEl) {
        emailEl.textContent = email;
        if (email) {
          emailEl.setAttribute('aria-label', email);
          emailEl.style.display = 'block';
        } else {
          emailEl.removeAttribute('aria-label');
          emailEl.style.display = 'none';
        }
      }
      if (avatarEl) {
        avatarEl.innerHTML = '';
        if (picture) {
          const img = document.createElement('img');
          img.src = picture;
          img.alt = name;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
          avatarEl.appendChild(img);
        } else {
          avatarEl.textContent = (name || 'Invitado').trim().charAt(0).toUpperCase() || 'I';
        }
      }

      // Actualizar tooltip flotante si existe en el DOM
      const tooltipName = document.querySelector('#profileTooltip .tooltip-name');
      const tooltipEmail = document.querySelector('#profileTooltip .tooltip-email');
      if (tooltipName) tooltipName.textContent = name;
      if (tooltipEmail) {
        tooltipEmail.textContent = email;
        tooltipEmail.style.display = email ? 'block' : 'none';
      }
    } catch (e) {
      window.Logger?.warn('BasePage', 'Error actualizando perfil de usuario', e);
    }
  }

  /**
   * Inicializa el tooltip flotante para la sección de perfil de usuario.
   * @param {string} [triggerId='userInfoHover']
   * @param {string} [tooltipId='profileTooltip']
   */
  static initUserInfoTooltip(triggerId = 'userInfoHover', tooltipId = 'profileTooltip') {
    if (typeof window !== 'undefined' && window.ProfileSync?.initProfileTooltip) {
      window.ProfileSync.initProfileTooltip();
      return;
    }

    const trigger = document.getElementById(triggerId) || document.querySelector('.user-info');
    const tooltip = document.getElementById(tooltipId);
    if (!trigger || !tooltip || trigger._tooltipBound) return;

    trigger._tooltipBound = true;
    let hideTimeout;

    const showTooltip = () => {
      clearTimeout(hideTimeout);
      tooltip.classList.add('visible', 'show');
    };

    const hideTooltip = () => {
      hideTimeout = setTimeout(() => {
        tooltip.classList.remove('visible', 'show');
      }, 150);
    };

    trigger.addEventListener('mouseenter', showTooltip);
    trigger.addEventListener('mouseleave', hideTooltip);
    tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    tooltip.addEventListener('mouseleave', hideTooltip);
  }

  _updateUserProfile() {
    BasePage.updateUserProfile();
  }


  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------

  /**
   * Registra listeners de eventos cross-tab via `DataEvents`.
   * Por defecto recarga los datos al recibir `datos:actualizados`.
   * Sobreescribir para agregar listeners adicionales.
   * @protected
   */
  _bindCrossTabEvents() {
    if (!window.DataEvents) return;
    window.DataEvents.on('datos:actualizados', () => this._loadData());
  }

  /**
   * Registra los eventos de la página (botones, inputs, etc.).
   * Llamar `super.bindEvents()` al sobreescribir para incluir el comportamiento base.
   * @protected
   */
  bindEvents() {
    // Implementar en la subclase
  }
}

if (typeof window !== 'undefined') {
  window.BasePage = BasePage;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BasePage;
}
