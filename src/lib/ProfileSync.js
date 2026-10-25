/**
 * FinanzApp - Centralized Profile & Avatar Synchronizer
 * Single Source of Truth for user profile synchronization (desktop sidebar + mobile drawer)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ProfileSync = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getUserData(userObj = null) {
    if (userObj && typeof userObj === 'object') return userObj;
    if (typeof window !== 'undefined' && window.AuthService) {
      const u = window.AuthService.getUser();
      return u || {};
    }
    try {
      const raw = localStorage.getItem('authUser');
      if (raw && raw !== 'guest') {
        return JSON.parse(raw);
      }
    } catch (_) {}
    return {};
  }

  function syncProfile(userObj = null) {
    if (typeof document === 'undefined') return;

    try {
      const user = getUserData(userObj);
      const name = user?.name || user?.displayName || user?.email?.split('@')[0] || 'Invitado';
      const email = user?.email || '';
      const picture = user?.picture || user?.photoURL || '';

      // Desktop Sidebar elements
      const nameEl = document.querySelector('.user-name');
      const emailEl = document.querySelector('.user-email');
      const avatarEl = document.querySelector('.user-avatar');

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
        renderAvatar(avatarEl, name, picture);
      }

      // Mobile Drawer elements
      const drawerName = document.getElementById('mobileDrawerName');
      const drawerEmail = document.getElementById('mobileDrawerEmail');
      const drawerAvatar = document.getElementById('mobileDrawerAvatar');

      if (drawerName) drawerName.textContent = name;
      if (drawerEmail) {
        drawerEmail.textContent = email;
        drawerEmail.style.display = email ? 'block' : 'none';
      }
      if (drawerAvatar) {
        renderAvatar(drawerAvatar, name, picture);
      }

      // Floating tooltip
      const tooltipName = document.querySelector('#profileTooltip .tooltip-name');
      const tooltipEmail = document.querySelector('#profileTooltip .tooltip-email');
      if (tooltipName) tooltipName.textContent = name;
      if (tooltipEmail) {
        tooltipEmail.textContent = email;
        tooltipEmail.style.display = email ? 'block' : 'none';
      }
    } catch (e) {
      console.warn('Error sincronizando perfil:', e);
    }
  }

  function initProfileTooltip() {
    if (typeof document === 'undefined') return;
    const userInfo = document.getElementById('userInfoHover') || document.querySelector('.sidebar .user-info');
    const tooltip = document.getElementById('profileTooltip');
    const userProfile = document.querySelector('.user-profile');
    if (!tooltip || !userProfile) return;

    const targets = userProfile.querySelectorAll('.user-avatar, .user-info, #userInfoHover');
    let hideTimer = null;
    if (!userInfo || !tooltip || userInfo._profileTooltipBound) return;
    userInfo._profileTooltipBound = true;

    const show = () => {
      clearTimeout(hideTimer);
      syncProfile();
      tooltip.classList.add('show', 'visible');
    };

    const hide = () => {
      hideTimer = setTimeout(() => {
        tooltip.classList.remove('show', 'visible');
      }, 120);
    };

    targets.forEach(el => {
      if (el._tooltipBound) return;
      el._tooltipBound = true;
      el.addEventListener('mouseenter', show);
      el.addEventListener('mouseleave', hide);
    });

    if (!tooltip._tooltipBound) {
      tooltip._tooltipBound = true;
      tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      tooltip.addEventListener('mouseleave', hide);
    }

    const actionButtons = userProfile.querySelectorAll('#themeToggle, #logoutButton');
    actionButtons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        clearTimeout(hideTimer);
        tooltip.classList.remove('show', 'visible');
      });
    });
  }

  function renderAvatar(containerEl, name, picture) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    if (picture) {
      const img = document.createElement('img');
      img.src = picture;
      img.alt = name;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
      img.onerror = () => {
        containerEl.innerHTML = '';
        containerEl.textContent = (name || 'Invitado').trim().charAt(0).toUpperCase() || 'I';
      };
      containerEl.appendChild(img);
    } else {
      containerEl.textContent = (name || 'Invitado').trim().charAt(0).toUpperCase() || 'I';
    }
  }

  const ProfileSyncAPI = {
    sync: syncProfile,
    renderAvatar: renderAvatar,
    getUserData: getUserData,
    initProfileTooltip: initProfileTooltip
  };

  if (typeof window !== 'undefined') {
    window.ProfileSync = ProfileSyncAPI;
    window.syncDrawerProfile = syncProfile;

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          syncProfile();
          initProfileTooltip();
        });
      } else {
        syncProfile();
        initProfileTooltip();
      }
    }
  }

  return ProfileSyncAPI;
});


