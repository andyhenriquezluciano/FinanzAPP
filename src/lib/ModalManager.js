/**
 * FinanzApp - Centralized Modal & Drawer Manager
 * Unified accessible modal dialog handling, focus trapping, and scroll management
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ModalManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function resolveModal(modal) {
    if (typeof modal === 'string') {
      return document.getElementById(modal) || document.querySelector(modal);
    }
    return modal;
  }

  function abrirModal(modalRef, triggerElement = null) {
    const modal = resolveModal(modalRef);
    if (!modal || typeof document === 'undefined') return;

    document.querySelectorAll('.modal.active').forEach(m => {
      if (m !== modal) {
        m.classList.remove('active');
        m.setAttribute('inert', '');
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
        try { firstFocusable.focus(); } catch (_) {}
      }, 80);
    }

    if (triggerElement && document.contains(triggerElement)) {
      modal._triggerElement = triggerElement;
    }
  }

  function cerrarModal(modalRef) {
    const modal = resolveModal(modalRef);
    if (!modal || typeof document === 'undefined') return;

    try {
      const triggerEl = modal._triggerElement || null;
      const hadFocusInside = modal.contains(document.activeElement);

      modal.classList.remove('active');
      modal.setAttribute('inert', '');
      modal.setAttribute('aria-hidden', 'true');
      limpiarBloqueoScroll();

      if (hadFocusInside && document.body) {
        try {
          document.body.setAttribute('tabindex', '-1');
          document.body.focus();
        } catch (_) {}
      }

      setTimeout(() => {
        let restored = false;
        try {
          if (triggerEl && typeof triggerEl.focus === 'function' && document.contains(triggerEl) && triggerEl.offsetParent !== null) {
            triggerEl.focus();
            restored = true;
          }
        } catch (_) {}

        if (!restored) {
          const fallback = document.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (fallback && document.contains(fallback)) {
            try { fallback.focus(); } catch (_) {}
          }
        }

        if (document.body && document.body.getAttribute('tabindex') === '-1') {
          document.body.removeAttribute('tabindex');
        }

        modal._triggerElement = null;
      }, 40);
    } catch (e) {
      console.error('Error cerrando modal:', e);
    }
  }

  function limpiarBloqueoScroll() {
    if (typeof document === 'undefined') return;
    const hasModal = !!document.querySelector('.modal.active');
    const overlay = document.getElementById('alertOverlay');
    const alertBox = document.getElementById('customAlert');
    const drawer = document.getElementById('confirmDrawer');
    const alertVisible = (overlay && !overlay.classList.contains('hidden')) || 
                         (alertBox && !alertBox.classList.contains('hidden')) ||
                         (drawer && drawer.classList.contains('open'));

    if (!hasModal && document.body) document.body.classList.remove('modal-open');
    if (!alertVisible && document.body) document.body.classList.remove('no-scroll');
    if (!hasModal && !alertVisible && document.body) document.body.style.overflow = '';
  }

  function bindCloseButtons() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
      if (btn._modalBound) return;
      btn._modalBound = true;
      btn.addEventListener('click', (e) => {
        const modal = btn.closest('.modal');
        if (modal) cerrarModal(modal);
      });
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindCloseButtons);
    } else {
      setTimeout(bindCloseButtons, 0);
    }
  }

  const ModalManagerAPI = {
    open: abrirModal,
    close: cerrarModal,
    clearScrollLock: limpiarBloqueoScroll,
    bindCloseButtons: bindCloseButtons
  };

  if (typeof window !== 'undefined') {
    window.ModalManager = ModalManagerAPI;
    window.abrirModal = abrirModal;
    window.cerrarModal = cerrarModal;
    window.limpiarBloqueoScroll = limpiarBloqueoScroll;
  }

  return ModalManagerAPI;
});

