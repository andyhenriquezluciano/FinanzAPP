/**
 * @fileoverview Constantes centrales y configuración global de FinanzApp.
 * 
 * Centraliza nombres de claves de almacenamiento, eventos del sistema,
 * divisas soportadas y preferencias por defecto, evitando magic strings.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Constants = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEYS = Object.freeze({
    AUTH_USER: 'authUser',
    LOGGED_IN: 'loggedIn',
    LOGOUT_TS: 'logoutTimestamp',
    SETTINGS: 'finanzapp:settings:v1',
    DATA_PREFIX: 'finanzapp:data:v1',
    DEBUG: 'finanzapp:debug',
    THEME: 'theme',
    SORT_FECHA: 'sort_fecha',
    SORT_MONTO: 'sort_monto',
    GMAIL_NOTIFS: 'finanzapp:gmail:pending_notifications',
    LAST_BG_SYNC: 'finanzapp:last_bg_sync',
    LAST_BACKUP: 'finanzapp:last-backup-date'
  });

  const APP_EVENTS = Object.freeze({
    CATEGORIES_UPDATED: 'finanzapp:categories:updated',
    TRANSACTIONS_UPDATED: 'finanzapp:transactions:updated',
    BUDGETS_UPDATED: 'finanzapp:budgets:updated',
    SETTINGS_UPDATED: 'finanzapp:settings:updated',
    THEME_CHANGED: 'finanzapp:theme:changed',
    GMAIL_NOTIFS_UPDATED: 'finanzapp:gmail:notifications-updated',
    SYNC_TRIGGERED: 'finanzapp:sync:triggered'
  });

  const SUPPORTED_CURRENCIES = Object.freeze({
    DOP: { code: 'DOP', symbol: 'RD$', locale: 'es-DO', label: 'Peso Dominicano (DOP)' },
    USD: { code: 'USD', symbol: '$', locale: 'en-US', label: 'Dólar Estadounidense (USD)' },
    EUR: { code: 'EUR', symbol: '€', locale: 'es-ES', label: 'Euro (EUR)' }
  });

  const DEFAULT_SETTINGS = Object.freeze({
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

  return {
    STORAGE_KEYS,
    APP_EVENTS,
    SUPPORTED_CURRENCIES,
    DEFAULT_SETTINGS
  };
});

