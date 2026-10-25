/**
 * @fileoverview Controlador del Drawer Móvil y Notificaciones Móviles de Categorías.
 *
 * Gestiona el menú deslizable inferior de acciones móviles, el perfil de usuario móvil,
 * la apertura de subpaneles de filtros (búsqueda, año, mes, exportación) y el menú
 * de notificaciones bancarias móvil.
 *
 * @module CategoriasMobileDrawer
 */

(function () {
  'use strict';

  function initMobileDrawer() {
    const mobileCreateAction = document.getElementById('mobileCreateAction');
    if (mobileCreateAction) {
      mobileCreateAction.addEventListener('click', function () {
        const trigger = document.getElementById('addCategoryBtn');
        if (trigger) trigger.click();
      });
    }

    const dropdown = document.getElementById('mobileActionsDropdown');
    const toggle = document.getElementById('mobileActionsToggle');
    const panel = document.getElementById('mobileActionsPanel');
    if (!dropdown || !toggle || !panel) return;

    const closeBtn = document.getElementById('mobileActionsClose');
    const notifDropdown = document.getElementById('mobileNotificationsDropdown');
    const notifPanel = document.getElementById('mobileNotificationsPanel');
    const notifCloseBtn = document.getElementById('mobileNotificationsClose');
    const notifList = document.getElementById('mobileNotificationsList');
    const notifClearBtn = document.getElementById('mobileNotificationsClearBtn');

    const mobileName = document.getElementById('mobileDrawerName');
    const mobileEmail = document.getElementById('mobileDrawerEmail');
    const mobileAvatar = document.getElementById('mobileDrawerAvatar');

    const syncDrawerProfile = function () {
      try {
        const profile = (typeof window !== 'undefined' && window.AuthService)
          ? (window.AuthService.getUser() || {})
          : (() => {
              const raw = localStorage.getItem('authUser');
              return raw && raw !== 'guest' ? JSON.parse(raw) : {};
            })();
        const fallbackName = document.querySelector('.sidebar .user-name')?.textContent?.trim() || '';
        const fallbackEmail = document.querySelector('.sidebar .user-email')?.textContent?.trim() || '';

        const displayName = profile.name || profile.displayName || fallbackName || 'Invitado';
        const displayEmail = profile.email || fallbackEmail || '';
        const picture = profile.picture || profile.photoURL || '';

        if (mobileName) mobileName.textContent = displayName;
        if (mobileEmail) {
          mobileEmail.textContent = displayEmail || 'Sin correo';
          mobileEmail.style.display = 'block';
        }

        if (mobileAvatar) {
          mobileAvatar.innerHTML = '';
          if (picture) {
            const img = document.createElement('img');
            img.src = picture;
            img.alt = displayName;
            mobileAvatar.appendChild(img);
          } else {
            mobileAvatar.textContent = (displayName || 'Invitado').trim().charAt(0).toUpperCase();
          }
        }
      } catch (_) {}
    };

    syncDrawerProfile();

    const subpanel = document.createElement('div');
    subpanel.id = 'mobileActionsSubpanel';
    subpanel.className = 'mobile-actions-subpanel';
    panel.appendChild(subpanel);
    let activeSubmenuAction = null;
    let openedFromDrawer = false;

    const clearSubpanel = function () {
      panel.classList.remove('has-subpanel');
      subpanel.classList.remove('open');
      subpanel.classList.remove('is-month');
      subpanel.classList.remove('is-search');
      subpanel.innerHTML = '';
      activeSubmenuAction = null;
      if (subpanel.parentElement !== panel) {
        panel.appendChild(subpanel);
      }
      updateFilterButtonState();
    };

    const closePanel = function () {
      dropdown.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      clearSubpanel();
    };

    const closeNotificationsMenu = function () {
      notifDropdown?.classList.remove('open');
    };

    const readMobileNotifications = function () {
      if (window.gmailNotifManager && Array.isArray(window.gmailNotifManager.notifications) && window.gmailNotifManager.notifications.length > 0) {
        return window.gmailNotifManager.notifications;
      }
      try {
        let uid = null;
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.auth === 'function') {
          try { uid = window.firebase.auth().currentUser?.uid; } catch (_) {}
        }
        if (!uid) {
          const authUid = (typeof window !== 'undefined' && window.AuthService)
            ? window.AuthService.getUserId()
            : null;
          if (authUid && authUid !== 'guest') {
            uid = authUid;
          } else {
            const rawAuth = localStorage.getItem('authUser');
            if (rawAuth && rawAuth !== 'guest') {
              try { uid = JSON.parse(rawAuth).uid; } catch (_) {}
            }
          }
        }
        const storageKey = uid ? `finanzapp:gmail:pending_notifications:${uid}` : 'finanzapp:gmail:pending_notifications';
        const raw = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem('finanzapp:gmail:pending_notifications') || localStorage.getItem('finanzapp:gmail:notifications') || '[]');
        if (!Array.isArray(raw)) return [];
        return raw;
      } catch (_) {
        return [];
      }
    };

    const fmtMobileNotifDate = function (rawDate) {
      if (!rawDate) return '';
      const d = (rawDate && typeof rawDate.toDate === 'function') ? rawDate.toDate() : new Date(rawDate);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const fmtMobileNotifAmount = function (amount) {
      if (amount === undefined || amount === null || amount === '') return '';
      const num = Number(amount);
      if (isNaN(num)) return String(amount);
      try {
        if (window.Core?.helpers?.formatCurrency) {
          return window.Core.helpers.formatCurrency(num);
        }
        const raw = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
        if (raw?.censorAmounts === 'on') {
          return (raw?.currency || 'RD$') + ' ••••';
        }
        const curr = raw?.currency || 'RD$';
        return `${curr}${num.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      } catch (_) {
        return `RD$${num.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      }
    };

    const renderNotificationsMenu = function () {
      if (!notifList) return;
      const list = readMobileNotifications();
      notifList.innerHTML = '';

      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'gmail-notif-empty';
        empty.textContent = 'Sin transacciones pendientes';
        empty.style.padding = '28px 16px';
        empty.style.textAlign = 'center';
        empty.style.color = '#6e6a86';
        empty.style.fontSize = '13px';
        notifList.appendChild(empty);
        if (notifClearBtn) notifClearBtn.style.display = 'none';
        return;
      }

      list.forEach(function (n) {
        const item = document.createElement('div');
        item.className = 'gmail-notif-item';
        item.setAttribute('data-id', n.id || '');

        const desc = (n.description || n.merchant || 'Comercio').trim();
        const amount = fmtMobileNotifAmount(n.amount);
        const date = fmtMobileNotifDate(n.date);
        const detail = (n.subject && n.subject !== n.description) ? n.subject : (n.description || 'Notificación bancaria');

        item.innerHTML = `
          <div class="gmail-notif-item-top">
            <span class="gmail-notif-merchant" title="${desc}">${desc}</span>
            <span class="gmail-notif-amount">${amount}</span>
          </div>
          <div class="gmail-notif-item-bottom">
            <span class="gmail-notif-detail" title="${detail}">${detail}</span>
            ${date ? `<span class="gmail-notif-date"><i data-lucide="calendar"></i> ${date}</span>` : ''}
          </div>
        `;
        window.LucideHelper?.refresh(item);

        item.addEventListener('click', function (e) {
          e.stopPropagation();
          closeNotificationsMenu();
          if (window.abrirModalRevisarGmail && typeof window.abrirModalRevisarGmail === 'function') {
            window.abrirModalRevisarGmail(n, n.id, { source: 'mobile' });
          } else {
            window.dispatchEvent(new CustomEvent('finanzapp:gmail:open-review', {
              detail: { id: n.id, source: 'mobile' }
            }));
          }
        });
        notifList.appendChild(item);
      });

      if (notifClearBtn) notifClearBtn.style.display = 'flex';
    };

    const openNotificationsMenu = function () {
      if (!notifPanel || !notifDropdown) return;
      renderNotificationsMenu();
      notifDropdown.classList.add('open');
    };

    window.openMobileNotificationsMenu = openNotificationsMenu;
    window.renderMobileNotificationsMenu = renderNotificationsMenu;
    window.closeMobileNotificationsMenu = closeNotificationsMenu;

    const openInlineSubpanel = function (actionKey, anchorBtn, renderContent) {
      if (!anchorBtn) return false;
      if (activeSubmenuAction === actionKey && subpanel.classList.contains('open')) {
        clearSubpanel();
        return false;
      }

      clearSubpanel();
      renderContent();
      anchorBtn.insertAdjacentElement('afterend', subpanel);
      panel.classList.add('has-subpanel');
      subpanel.classList.add('open');
      activeSubmenuAction = actionKey;
      updateFilterButtonState();
      return true;
    };

    const updateFilterButtonState = function () {
      if (!panel) return;
      const monthVal = document.querySelector('#monthFilter .custom-dropdown-selected')?.getAttribute('data-value') || '';
      const yearVal = document.querySelector('#yearFilter .custom-dropdown-selected')?.getAttribute('data-value') || '';
      const searchVal = (document.getElementById('searchInput')?.value || '').trim();

      const yearBtn = panel.querySelector('[data-action="year"]');
      const monthBtn = panel.querySelector('[data-action="month"]');
      const searchBtn = panel.querySelector('[data-action="search"]');

      if (yearBtn) yearBtn.classList.toggle('filter-active', yearVal !== '' || activeSubmenuAction === 'year');
      if (monthBtn) monthBtn.classList.toggle('filter-active', monthVal !== '' || activeSubmenuAction === 'month');
      if (searchBtn) searchBtn.classList.toggle('filter-active', searchVal !== '' || activeSubmenuAction === 'search');
    };

    const filterObserver = new MutationObserver(updateFilterButtonState);
    ['yearFilter', 'monthFilter'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) filterObserver.observe(el, { attributes: true, childList: true, subtree: true });
    });

    const openPanel = function () {
      syncDrawerProfile();
      updateFilterButtonState();
      closeNotificationsMenu();
      dropdown.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
    };

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dropdown.classList.contains('open')) {
        closePanel();
      } else {
        openPanel();
      }
    });

    closeBtn?.addEventListener('click', function (e) {
      e.stopPropagation();
      closePanel();
    });

    const openOptionsSubmenu = function (dropdownId, actionKey, anchorBtn) {
      const dropdownEl = document.getElementById(dropdownId);
      const selectedEl = dropdownEl?.querySelector('.custom-dropdown-selected');
      const options = dropdownEl?.querySelectorAll('.custom-dropdown-option');
      if (!dropdownEl || !selectedEl || !options?.length) return;

      openInlineSubpanel(actionKey, anchorBtn, function () {
        const currentValue = selectedEl.getAttribute('data-value') || '';
        subpanel.innerHTML = '';
        subpanel.classList.remove('is-search');
        subpanel.classList.toggle('is-month', dropdownId === 'monthFilter');

        options.forEach(function (opt) {
          const value = opt.getAttribute('data-value') || '';
          const text = (opt.textContent || '').trim();
          if (value === '' || text.toLowerCase().startsWith('todos')) return;

          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'mobile-actions-option' + (value === currentValue ? ' active' : '');
          item.textContent = text;
          item.addEventListener('click', function () {
            opt.click();
            closePanel();
          });
          subpanel.appendChild(item);
        });
      });
    };

    const openSearchSubmenu = function (anchorBtn) {
      const source = document.getElementById('searchInput');
      if (!source) return;

      const opened = openInlineSubpanel('search', anchorBtn, function () {
        subpanel.innerHTML = '';
        subpanel.classList.add('is-search');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'mobile-actions-subpanel-input';
        input.placeholder = source.placeholder || 'Buscar...';
        input.value = source.value || '';

        input.addEventListener('input', function () {
          source.value = input.value;
          source.dispatchEvent(new Event('input', { bubbles: true }));
        });

        subpanel.appendChild(input);
      });

      if (opened) {
        setTimeout(function () {
          const input = subpanel.querySelector('.mobile-actions-subpanel-input');
          if (input) input.focus();
        }, 0);
      }
    };

    const openExportSubmenu = function (anchorBtn) {
      openInlineSubpanel('export', anchorBtn, function () {
        subpanel.innerHTML = '';

        const jsonBtn = document.createElement('button');
        jsonBtn.type = 'button';
        jsonBtn.className = 'mobile-actions-option';
        jsonBtn.textContent = 'Exportar JSON';
        jsonBtn.addEventListener('click', function () {
          document.getElementById('exportJsonBtn')?.click();
          closePanel();
        });

        const pdfBtn = document.createElement('button');
        pdfBtn.type = 'button';
        pdfBtn.className = 'mobile-actions-option';
        pdfBtn.textContent = 'Exportar PDF';
        pdfBtn.addEventListener('click', function () {
          document.getElementById('exportPdfBtn')?.click();
          closePanel();
        });

        subpanel.appendChild(jsonBtn);
        subpanel.appendChild(pdfBtn);
      });
    };

    panel.addEventListener('click', function (e) {
      e.stopPropagation();
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');

      if (action === 'search') {
        openSearchSubmenu(btn);
      } else if (action === 'year') {
        openOptionsSubmenu('yearFilter', 'year', btn);
      } else if (action === 'month') {
        openOptionsSubmenu('monthFilter', 'month', btn);
      } else if (action === 'clear') {
        document.getElementById('clearFiltersBtn')?.click();
        clearSubpanel();
        panel.querySelectorAll('.filter-active').forEach(function (b) { b.classList.remove('filter-active'); });
        closePanel();
      } else if (action === 'notifications') {
        openedFromDrawer = true;
        closePanel();
        openNotificationsMenu();
      } else if (action === 'export') {
        openExportSubmenu(btn);
      } else if (action === 'import') {
        document.getElementById('importFileInput')?.click();
        closePanel();
      } else if (action === 'theme') {
        document.getElementById('themeToggle')?.click();
        closePanel();
      } else if (action === 'logout') {
        document.getElementById('logoutButton')?.click();
        closePanel();
      } else if (action === 'deleteAll') {
        document.getElementById('clearAllCategoriesBtn')?.click();
        closePanel();
      }
    });

    const backdrop = document.getElementById('mobileDrawerBackdrop');
    const notifBackdrop = document.getElementById('mobileNotificationsBackdrop');
    const handleBackdropClose = function (e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      openedFromDrawer = false;
      closePanel();
      closeNotificationsMenu();
    };

    if (backdrop) {
      backdrop.addEventListener('click', handleBackdropClose);
      backdrop.addEventListener('touchend', handleBackdropClose, { passive: false });
    }
    if (notifBackdrop) {
      notifBackdrop.addEventListener('click', handleBackdropClose);
      notifBackdrop.addEventListener('touchend', handleBackdropClose, { passive: false });
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('.modal, .custom-alert-overlay, .modal-backdrop, [role="dialog"], .flatpickr-calendar')) {
        return;
      }
      const clickedOutsideMain = !dropdown.contains(e.target) && !toggle.contains(e.target);
      const clickedOutsideNotif = (!notifPanel || !notifPanel.contains(e.target));
      if (clickedOutsideMain && dropdown.classList.contains('open')) {
        closePanel();
      }
      if (clickedOutsideNotif && notifDropdown?.classList.contains('open')) {
        openedFromDrawer = false;
        closeNotificationsMenu();
      }
    });

    notifCloseBtn?.addEventListener('click', function (e) {
      e.stopPropagation();
      closeNotificationsMenu();
      if (openedFromDrawer) {
        openedFromDrawer = false;
        openPanel();
      }
    });

    notifClearBtn?.addEventListener('click', function (e) {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('finanzapp:gmail:clear-all'));
    });

    window.addEventListener('scroll', function () {
      if (document.querySelector('.modal.active') || document.querySelector('.custom-alert-overlay')) return;
      closePanel();
      closeNotificationsMenu();
    }, { passive: true });

    window.addEventListener('finanzapp:gmail:notifications-updated', function () {
      if (notifDropdown?.classList.contains('open')) {
        renderNotificationsMenu();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileDrawer);
  } else {
    initMobileDrawer();
  }
})();

