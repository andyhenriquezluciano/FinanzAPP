/**
 * FinanzApp - Centralized Toast Notification System
 * Single Source of Truth for Toast notifications across all pages
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Toast = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function asegurarContenedorToast() {
    if (typeof document === 'undefined') return null;
    let c = document.getElementById('toastContainer');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toastContainer';
      c.className = 'toast-container';
      c.setAttribute('aria-live', 'polite');
      c.setAttribute('aria-atomic', 'true');
      document.body.appendChild(c);
    }
    return c;
  }

  function parseToastOptions(tipoOrOptions, duracionOrOptions) {
    let tipo = 'info';
    let duracion = 3000;

    if (tipoOrOptions && typeof tipoOrOptions === 'object') {
      tipo = tipoOrOptions.variant || tipoOrOptions.type || tipoOrOptions.tipo || 'info';
      if (typeof tipoOrOptions.duration === 'number' && tipoOrOptions.duration > 0) {
        duracion = tipoOrOptions.duration;
      } else if (typeof tipoOrOptions.duracion === 'number' && tipoOrOptions.duracion > 0) {
        duracion = tipoOrOptions.duracion;
      }
    } else {
      if (typeof tipoOrOptions === 'string' && tipoOrOptions) {
        tipo = tipoOrOptions;
      }
      if (typeof duracionOrOptions === 'number' && duracionOrOptions > 0) {
        duracion = duracionOrOptions;
      } else if (duracionOrOptions && typeof duracionOrOptions === 'object') {
        if (typeof duracionOrOptions.duration === 'number' && duracionOrOptions.duration > 0) {
          duracion = duracionOrOptions.duration;
        } else if (typeof duracionOrOptions.duracion === 'number' && duracionOrOptions.duracion > 0) {
          duracion = duracionOrOptions.duracion;
        }
      }
    }

    if (tipo === 'exito') tipo = 'success';
    if (tipo === 'advertencia') tipo = 'warning';

    return { tipo, duracion };
  }

  function ocultarToast(toast) {
    if (!toast || toast._isHiding) return;
    toast._isHiding = true;
    if (toast._timer) clearTimeout(toast._timer);
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 380);
  }

  function mostrarToast(mensaje, tipoOrOptions = 'info', duracionOrOptions = 3000) {
    if (typeof document === 'undefined') return null;
    const container = asegurarContenedorToast();
    if (!container) return null;

    const { tipo, duracion } = parseToastOptions(tipoOrOptions, duracionOrOptions);

    // Evitar acumular demasiados toasts
    while (container.children.length > 2) {
      const first = container.firstElementChild;
      ocultarToast(first);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    const isAssertive = tipo === 'error' || tipo === 'warning';
    toast.setAttribute('role', isAssertive ? 'alert' : 'status');
    toast.setAttribute('aria-live', isAssertive ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');

    const content = document.createElement('div');
    content.className = 'toast-content';
    content.textContent = String(mensaje ?? '');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Cerrar notificación');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      ocultarToast(toast);
    });

    toast.appendChild(content);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    if (duracion > 0) {
      toast._timer = setTimeout(() => {
        ocultarToast(toast);
      }, duracion);

      toast.addEventListener('mouseenter', () => {
        if (toast._timer) clearTimeout(toast._timer);
      });
      toast.addEventListener('mouseleave', () => {
        toast._timer = setTimeout(() => ocultarToast(toast), 1500);
      });
    }

    return toast;
  }

  const ToastAPI = {
    show: mostrarToast,
    hide: ocultarToast,
    success: (msg, opts) => mostrarToast(msg, 'success', opts),
    error: (msg, opts) => mostrarToast(msg, 'error', opts),
    warning: (msg, opts) => mostrarToast(msg, 'warning', opts),
    info: (msg, opts) => mostrarToast(msg, 'info', opts)
  };

  if (typeof window !== 'undefined') {
    window.Toast = ToastAPI;
    window.mostrarToast = mostrarToast;
    window.ocultarToast = ocultarToast;
    window.mostrarExito = ToastAPI.success;
    window.mostrarError = ToastAPI.error;
    window.mostrarAdvertencia = ToastAPI.warning;
    window.mostrarInfo = ToastAPI.info;
  }

  return ToastAPI;
});
