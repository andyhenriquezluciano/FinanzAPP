/**
 * @fileoverview Mobile drawer handler para la página de Presupuestos.
 *
 * Gestiona el menú lateral móvil: perfil de usuario, filtros inline
 * (año/mes), subpanel de opciones y cierre por backdrop/click exterior.
 */
(function () {
  document.getElementById('mobileCreateAction')?.addEventListener('click', function () {
    if (window.PresupuestosApp && typeof window.PresupuestosApp.abrirModalCrear === 'function') {
      window.PresupuestosApp.abrirModalCrear();
    } else {
      const trigger = document.getElementById('addBudgetBtn');
      if (trigger) {
        trigger.click();
      }
    }
  });

  (function () {
    const dropdown = document.getElementById('mobileActionsDropdown');
    const toggle = document.getElementById('mobileActionsToggle');
    const panel = document.getElementById('mobileActionsPanel');
    if (!dropdown || !toggle || !panel) return;
    const closeBtn = document.getElementById('mobileActionsClose');

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

    const syncActiveFilters = function () {
      if (!panel) return;
      const yearVal = document.getElementById('yearFilter')?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';
      const monthVal = document.getElementById('monthFilter')?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || '';

      const yearBtn = panel.querySelector('[data-action="year"]');
      const monthBtn = panel.querySelector('[data-action="month"]');

      if (yearBtn) yearBtn.classList.toggle('filter-active', yearVal !== '' || activeSubmenuAction === 'year');
      if (monthBtn) monthBtn.classList.toggle('filter-active', monthVal !== '' || activeSubmenuAction === 'month');
    };

    const filterObserver = new MutationObserver(syncActiveFilters);
    ['yearFilter', 'monthFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) filterObserver.observe(el, { attributes: true, childList: true, subtree: true });
    });

    const clearSubpanel = function () {
      subpanel.classList.remove('open');
      subpanel.classList.remove('is-month');
      subpanel.innerHTML = '';
      activeSubmenuAction = null;
      if (subpanel.parentElement !== panel) {
        panel.appendChild(subpanel);
      }
    };

    const closePanel = function () {
      dropdown.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      clearSubpanel();
    };

    const openInlineSubpanel = function (actionKey, anchorBtn, renderContent) {
      if (!anchorBtn) return;
      if (activeSubmenuAction === actionKey && subpanel.classList.contains('open')) {
        clearSubpanel();
        return;
      }

      clearSubpanel();
      renderContent();
      anchorBtn.insertAdjacentElement('afterend', subpanel);
      subpanel.classList.add('open');
      activeSubmenuAction = actionKey;
      syncActiveFilters();
    };

    const openOptionsSubmenu = function (dropdownId, actionKey, anchorBtn) {
      const dropdownEl = document.getElementById(dropdownId);
      const selectedEl = dropdownEl?.querySelector('.custom-dropdown-selected');
      const options = dropdownEl?.querySelectorAll('.custom-dropdown-option');
      if (!dropdownEl || !selectedEl || !options?.length) return;

      openInlineSubpanel(actionKey, anchorBtn, function () {
        const currentValue = selectedEl.getAttribute('data-value') || '';
        subpanel.innerHTML = '';
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

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      syncDrawerProfile();
      syncActiveFilters();
      dropdown.classList.toggle('open');
      toggle.setAttribute('aria-expanded', dropdown.classList.contains('open') ? 'true' : 'false');
    });

    closeBtn?.addEventListener('click', function (e) {
      e.stopPropagation();
      closePanel();
    });

    panel.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');

      if (action === 'year') {
        openOptionsSubmenu('yearFilter', 'year', btn);
      } else if (action === 'month') {
        openOptionsSubmenu('monthFilter', 'month', btn);
      } else if (action === 'clear') {
        document.getElementById('clearFiltersBtn')?.click();
        clearSubpanel();
      } else if (action === 'theme') {
        document.getElementById('themeToggle')?.click();
        closePanel();
      } else if (action === 'logout') {
        document.getElementById('logoutButton')?.click();
        closePanel();
      }
    });

    const backdrop = document.getElementById('mobileDrawerBackdrop');
    const handleBackdropClose = function (e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      closePanel();
    };

    if (backdrop) {
      backdrop.addEventListener('click', handleBackdropClose);
      backdrop.addEventListener('touchend', handleBackdropClose, { passive: false });
    }

    document.addEventListener('click', function (e) {
      if (dropdown.classList.contains('open') && !dropdown.contains(e.target) && !e.target.closest('.custom-dropdown') && !e.target.closest('.modal')) {
        closePanel();
      }
    });

    window.addEventListener('scroll', closePanel, { passive: true });
  })();
})();

