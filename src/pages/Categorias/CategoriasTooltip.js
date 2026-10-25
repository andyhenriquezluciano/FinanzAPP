/**
 * FinanzApp - Categorias Custom Transaction Tooltip Engine
 * Single Responsibility: Interactive floating tooltip for transactions, chips, and buttons
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoriasTooltip = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let customTxnTooltipInitialized = false;

  function initCustomTransactionTooltip() {
    if (customTxnTooltipInitialized || typeof document === 'undefined') return;
    customTxnTooltipInitialized = true;

    let tooltip = document.getElementById('txn-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'txn-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      document.body.appendChild(tooltip);
    }

    let hideTimer = null;

    const positionTooltip = (evt) => {
      const padding = 10;
      const maxWidth = 320;
      tooltip.style.maxWidth = maxWidth + 'px';
      const rect = tooltip.getBoundingClientRect();
      let x = evt.clientX + 14;
      let y = evt.clientY - rect.height - 12;
      const vw = window.innerWidth;
      if (x + rect.width + padding > vw) x = vw - rect.width - padding;
      if (y < padding) y = evt.clientY + 18;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    };

    const showTooltip = (el, evt) => {
      const text = el.getAttribute('title');
      if (!text || !text.trim()) return;
      el.dataset._originalTitle = text;
      el.removeAttribute('title');
      tooltip.textContent = text;
      positionTooltip(evt);
      clearTimeout(hideTimer);
      requestAnimationFrame(() => {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0)';
      });
    };

    const hideTooltip = (el) => {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(-4px)';
      hideTimer = setTimeout(() => {
        if (el && el.dataset._originalTitle) {
          el.setAttribute('title', el.dataset._originalTitle);
          delete el.dataset._originalTitle;
        }
      }, 160);
    };

    const safeClosest = (t, sel) => {
      if (!t) return null;
      if (t.nodeType === 3) t = t.parentElement;
      if (!(t instanceof Element) || typeof t.closest !== 'function') return null;
      return t.closest(sel);
    };

    const forceHide = () => {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(-4px)';
    };

    const TOOLTIP_TARGETS = '.transaction-desc, .transaction-amount, .amount-chip, .sort-btn, [data-tooltip]';

    document.addEventListener('click', forceHide, true);
    document.addEventListener('scroll', forceHide, { capture: true, passive: true });
    document.addEventListener('keydown', forceHide, true);

    document.addEventListener('mouseenter', (e) => {
      const target = safeClosest(e.target, TOOLTIP_TARGETS);
      if (!target) return;
      showTooltip(target, e);
    }, true);

    document.addEventListener('mousemove', (e) => {
      const has = safeClosest(e.target, TOOLTIP_TARGETS);
      if (!has) return;
      positionTooltip(e);
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const target = safeClosest(e.target, TOOLTIP_TARGETS);
      if (!target) return;
      if (target.contains(e.relatedTarget)) return;
      hideTooltip(target);
    }, true);
  }

  const CategoriasTooltipAPI = {
    init: initCustomTransactionTooltip
  };

  if (typeof window !== 'undefined') {
    window.CategoriasTooltip = CategoriasTooltipAPI;
    window.initCustomTransactionTooltip = initCustomTransactionTooltip;
  }

  return CategoriasTooltipAPI;
});

