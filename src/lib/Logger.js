/**
 * FinanzApp - Centralized Logging & Telemetry Service
 * Enterprise-grade structured logging, error tracking, and telemetry buffer.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Logger = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LOG_LEVELS = Object.freeze({
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  });

  const MAX_BUFFER_SIZE = 50;
  const buffer = [];
  let minLevel = LOG_LEVELS.INFO;
  let globalHandlersInstalled = false;

  function formatLogEntry(level, context, message, meta = null) {
    let errorDetails = null;
    if (meta instanceof Error) {
      errorDetails = {
        name: meta.name,
        message: meta.message,
        stack: meta.stack
      };
    } else if (meta && typeof meta === 'object' && meta.error instanceof Error) {
      errorDetails = {
        name: meta.error.name,
        message: meta.error.message,
        stack: meta.error.stack
      };
    }

    return {
      timestamp: new Date().toISOString(),
      level,
      context: context || 'App',
      message: typeof message === 'string' ? message : String(message),
      meta: errorDetails || meta || undefined
    };
  }

  function pushToBuffer(entry) {
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.shift();
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('finanzapp:log', { detail: entry }));
      } catch (_) {}
    }
  }

  function log(levelKey, context, message, meta = null) {
    const levelVal = LOG_LEVELS[levelKey];
    if (levelVal < minLevel) return;

    const entry = formatLogEntry(levelKey, context, message, meta);
    pushToBuffer(entry);

    const prefix = `[${entry.timestamp.split('T')[1].slice(0, 8)}] [${entry.context}]`;
    const consoleArgs = meta !== null ? [prefix, entry.message, meta] : [prefix, entry.message];

    switch (levelKey) {
      case 'ERROR':
        console.error(...consoleArgs);
        break;
      case 'WARN':
        console.warn(...consoleArgs);
        break;
      case 'DEBUG':
        console.debug(...consoleArgs);
        break;
      default:
        console.log(...consoleArgs);
        break;
    }
  }

  function initGlobalErrorHandler() {
    if (globalHandlersInstalled || typeof window === 'undefined') return;
    globalHandlersInstalled = true;

    window.addEventListener('error', (event) => {
      log('ERROR', 'Window', event.message || 'Uncaught exception', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      log('ERROR', 'Promise', 'Unhandled Promise Rejection', {
        reason: reason instanceof Error ? { name: reason.name, message: reason.message, stack: reason.stack } : reason
      });
    });
  }

  const Logger = {
    LEVELS: LOG_LEVELS,
    setLevel(levelKey) {
      if (LOG_LEVELS[levelKey] !== undefined) {
        minLevel = LOG_LEVELS[levelKey];
      }
    },
    debug(context, message, meta = null) {
      log('DEBUG', context, message, meta);
    },
    info(context, message, meta = null) {
      log('INFO', context, message, meta);
    },
    warn(context, message, meta = null) {
      log('WARN', context, message, meta);
    },
    error(context, message, meta = null) {
      log('ERROR', context, message, meta);
    },
    getRecentLogs() {
      return [...buffer];
    },
    clearLogs() {
      buffer.length = 0;
    },
    initGlobalErrorHandler
  };

  if (typeof window !== 'undefined') {
    window.Logger = Logger;
    initGlobalErrorHandler();
  }

  return Logger;
});
