/**
 * @fileoverview Servicio centralizado de sesión y autenticación para FinanzApp.
 * 
 * Centraliza la lectura, guardado, validación y normalización del estado
 * de autenticación del usuario en el navegador (localStorage y Firebase).
 * Elimina la duplicación de accesos directos a 'authUser' y 'loggedIn'.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AuthService = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEYS = {
    AUTH_USER: 'authUser',
    LOGGED_IN: 'loggedIn',
    LOGOUT_TS: 'logoutTimestamp',
    SETTINGS: 'finanzapp:settings:v1'
  };

  const DEFAULT_GUEST_USER = Object.freeze({
    uid: 'guest',
    id: 'guest',
    name: 'Invitado',
    email: '',
    provider: 'guest',
    photoURL: null
  });

  class AuthService {
    static get KEYS() {
      return STORAGE_KEYS;
    }

    /**
     * Obtiene los datos del usuario autenticado actual desde el almacenamiento local.
     * Si no hay sesión o hay un error de parseo, retorna null o el perfil invitado si está marcado.
     * @returns {Object|null}
     */
    static getUser() {
      try {
        if (typeof localStorage === 'undefined') return null;
        const raw = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
        if (!raw) return null;

        if (raw === 'guest') {
          return { ...DEFAULT_GUEST_USER };
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;

        // Normalizar UID/ID
        if (!parsed.uid && parsed.id) {
          parsed.uid = parsed.id;
        }

        return parsed;
      } catch (err) {
        console.warn('[AuthService] Error leyendo authUser de localStorage:', err);
        return null;
      }
    }

    /**
     * Obtiene el identificador único (UID) del usuario activo o 'guest' si no hay sesión.
     * @returns {string}
     */
    static getUserId() {
      const user = AuthService.getUser();
      if (!user) return 'guest';
      return user.uid || user.id || user.email || 'guest';
    }

    /**
     * Determina si el usuario actual es un usuario invitado (sin cuenta Firebase).
     * @returns {boolean}
     */
    static isGuest() {
      const user = AuthService.getUser();
      if (!user) return true;
      return user.provider === 'guest' || user.uid === 'guest' || !user.uid;
    }

    /**
     * Verifica si hay una sesión activa válida.
     * @returns {boolean}
     */
    static isLoggedIn() {
      try {
        if (typeof localStorage === 'undefined') return false;
        const loggedIn = localStorage.getItem(STORAGE_KEYS.LOGGED_IN);
        const user = AuthService.getUser();
        return (loggedIn === 'true' || loggedIn === '1') && !!user;
      } catch {
        return false;
      }
    }

    /**
     * Guarda los datos del usuario autenticado en localStorage.
     * @param {Object|string} user - Objeto de usuario o 'guest'
     */
    static setUser(user) {
      try {
        if (typeof localStorage === 'undefined') return;
        if (!user) {
          localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
          return;
        }

        if (user === 'guest') {
          localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(DEFAULT_GUEST_USER));
          localStorage.setItem(STORAGE_KEYS.LOGGED_IN, 'true');
          return;
        }

        const photo = user.photoURL || user.picture || null;
        const normalized = {
          uid: user.uid || user.id || 'guest',
          name: user.name || user.displayName || 'Usuario',
          email: user.email || '',
          provider: user.provider || (user.providerData?.[0]?.providerId) || 'password',
          photoURL: photo,
          picture: photo
        };

        localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(normalized));
        localStorage.setItem(STORAGE_KEYS.LOGGED_IN, 'true');
      } catch (err) {
        console.error('[AuthService] Error guardando sesión en localStorage:', err);
      }
    }

    /**
     * Normaliza perfiles antiguos de invitado en localStorage sin recargar la página.
     * @returns {boolean} true si se normalizó un perfil antiguo
     */
    static normalizeGuestProfile() {
      try {
        if (typeof localStorage === 'undefined') return false;
        const raw = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
        if (!raw) return false;

        if (raw === 'guest') {
          localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(DEFAULT_GUEST_USER));
          return true;
        }

        try {
          const profile = JSON.parse(raw);
          if (profile && profile.provider === 'guest' &&
             (profile.email === 'invitado@finanzapp.com' || profile.name === 'Usuario Invitado' || !profile.uid)) {
            profile.name = 'Invitado';
            profile.email = '';
            profile.uid = 'guest';
            localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(profile));
            return true;
          }
        } catch {}
      } catch {}
      return false;
    }

    /**
     * Cierra la sesión activa y limpia los registros en localStorage.
     * @param {number} [blockMarginMs=1500]
     */
    static clearSession(blockMarginMs = 1500) {
      try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.LOGOUT_TS, String(Date.now()));
        localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
        localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      } catch (err) {
        console.warn('[AuthService] Error limpiando sesión:', err);
      }
    }
  }

  return AuthService;
});
