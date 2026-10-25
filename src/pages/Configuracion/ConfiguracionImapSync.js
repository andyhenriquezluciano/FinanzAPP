/**
 * FinanzApp - Configuracion IMAP Integration & Sync Engine
 * Single Responsibility: IMAP credentials management, app password validation, tutorial modals, and on-demand synchronization
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ConfiguracionImapSync = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function defaultShowToast(msg, variant = 'info') {
    if (typeof window !== 'undefined' && window.Toast?.show) {
      window.Toast.show(msg, variant);
    }
  }

  async function loadImapCredentials(getProfile) {
    if (typeof window === 'undefined' || !window.FirestoreDB) return;
    try {
      if (window.FirestoreDB.ensureFirebaseInitialized) {
        window.FirestoreDB.ensureFirebaseInitialized();
      }

      try {
        const uid = (typeof window !== 'undefined' && window.AuthService)
          ? window.AuthService.getUserId()
          : null;
        if (uid && uid !== 'guest') {
          localStorage.removeItem(`finanzapp:imap_settings:${uid}`);
        } else {
          const authUser = localStorage.getItem('authUser');
          if (authUser && authUser !== 'guest') {
            const u = JSON.parse(authUser);
            if (u.uid) localStorage.removeItem(`finanzapp:imap_settings:${u.uid}`);
          }
        }
      } catch {}

      const settings = await window.FirestoreDB.getImapSettings();
      const emailEl = document.getElementById('imapEmail');
      const passEl = document.getElementById('imapPassword');
      const sendersEl = document.getElementById('imapSenders');
      const syncBtn = document.getElementById('syncImapBtn');

      if (settings && (settings.configured || settings.email || settings.appPassword)) {
        if (emailEl && settings.email) emailEl.value = settings.email;
        if (passEl && settings.appPassword) passEl.value = settings.appPassword;
        if (passEl) {
          passEl.value = '';
          passEl.placeholder = '•••••••••••••••• (Configurada)';
          passEl.setAttribute('data-is-configured', 'true');
          passEl.removeAttribute('required');
        }
        if (sendersEl && settings.targetSenders) {
          sendersEl.value = Array.isArray(settings.targetSenders) ? settings.targetSenders.join(', ') : settings.targetSenders;
        }
        if (syncBtn && settings.appPassword) syncBtn.style.display = 'inline-flex';
        if (syncBtn) syncBtn.style.display = 'inline-flex';
      } else {
        const profile = typeof getProfile === 'function' ? getProfile() : (window.ProfileSync?.getUserData ? window.ProfileSync.getUserData() : {});
        if (emailEl && !emailEl.value && profile.email) {
          emailEl.value = profile.email;
        }
      }
    } catch (e) {
      console.warn('Error loading IMAP settings', e);
    }
  }

  function initImapSection(options = {}) {
    const showToast = options.showToast || defaultShowToast;
    const getProfile = options.getProfile;

    const saveBtn = document.getElementById('saveImapBtn');
    const syncBtn = document.getElementById('syncImapBtn');
    const openTutorialBtn = document.getElementById('openTutorialBtn');
    const closeTutorialBtn = document.getElementById('closeTutorialBtn');
    const tutorialModal = document.getElementById('tutorialModal');
    const overlay = document.getElementById('alertOverlay');

    if (openTutorialBtn && tutorialModal) {
      openTutorialBtn.addEventListener('click', (e) => {
        e.preventDefault();
        tutorialModal.classList.remove('hidden');
        tutorialModal.style.display = 'block';
        if (overlay) {
          overlay.classList.remove('hidden');
          overlay.style.display = 'block';
        }
      });
    }

    if (closeTutorialBtn && tutorialModal) {
      closeTutorialBtn.addEventListener('click', (e) => {
        e.preventDefault();
        tutorialModal.classList.add('hidden');
        tutorialModal.style.display = 'none';
        if (overlay) {
          overlay.classList.add('hidden');
          overlay.style.display = 'none';
        }
      });
    }

    if (overlay && tutorialModal) {
      overlay.addEventListener('click', () => {
        if (!tutorialModal.classList.contains('hidden') && tutorialModal.style.display !== 'none') {
          tutorialModal.classList.add('hidden');
          tutorialModal.style.display = 'none';
          overlay.classList.add('hidden');
          overlay.style.display = 'none';
        }
      });
    }

    const toggleBtn = document.getElementById('toggleImapPassword');
    const passInput = document.getElementById('imapPassword');
    const passIcon = document.getElementById('toggleImapPasswordIcon');

    if (toggleBtn && passInput) {
      toggleBtn.addEventListener('click', () => {
        const isPassword = passInput.type === 'password';
        passInput.type = isPassword ? 'text' : 'password';
        if (passIcon) {
          passIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
          window.LucideHelper?.refresh(toggleBtn);
        }
      });
    }

    if (!saveBtn) return;

    loadImapCredentials(getProfile);

    saveBtn.addEventListener('click', async () => {
      const email = document.getElementById('imapEmail')?.value.trim();
      const passEl = document.getElementById('imapPassword');
      const password = passEl?.value.replace(/\s+/g, '').trim() || '';
      const senders = (document.getElementById('imapSenders')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
      const isAlreadyConfigured = passEl?.getAttribute('data-is-configured') === 'true';

      if (!email || senders.length === 0 || (!password && !isAlreadyConfigured)) {
        showToast('Por favor completa todos los campos requeridos.', 'error');
        return;
      }

      if (password && password.length !== 16) {
        showToast(`La Contraseña de App de Google debe tener exactamente 16 letras (sin espacios). La que ingresaste tiene ${password.length} caracteres.`, 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Guardando...';
      window.LucideHelper?.refresh(saveBtn);

      try {
        if (window.FirestoreDB) {
          await window.FirestoreDB.saveImapSettings({ email, appPassword: password, targetSenders: senders });
          if (passEl) {
            passEl.value = '';
            passEl.placeholder = '•••••••••••••••• (Configurada)';
            passEl.setAttribute('data-is-configured', 'true');
            passEl.removeAttribute('required');
          }

          if (syncBtn) syncBtn.style.display = 'inline-flex';
          showToast('Credenciales guardadas correctamente.', 'success');
          showToast('Credenciales resguardadas y cifradas de forma segura.', 'success');
        }
      } catch (e) {
        console.error('Error al guardar IMAP', e);
        showToast('Error al guardar. Verifica tu conexión.', 'error');
        showToast(e.message || 'Error al guardar. Verifica tu conexión.', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="save"></i> Guardar';
        window.LucideHelper?.refresh(saveBtn);
      }
    });

    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Sincronizando...';
        window.LucideHelper?.refresh(syncBtn);

        try {
          if (window.SyncAPI && typeof window.SyncAPI.syncImapOnDemand === 'function') {
            const result = await window.SyncAPI.syncImapOnDemand();

            if (result && Array.isArray(result.transactions) && result.transactions.length > 0) {
              try {
                if (window.FirestoreDB?.ensureFirebaseInitialized) {
                  window.FirestoreDB.ensureFirebaseInitialized();
                }
                const user = (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.auth === 'function')
                  ? window.firebase.auth().currentUser
                  : null;
                const storageKey = user ? `finanzapp:gmail:pending_notifications:${user.uid}` : 'finanzapp:gmail:pending_notifications';
                const rawExisting = localStorage.getItem(storageKey) || '[]';
                let existing = Array.isArray(JSON.parse(rawExisting)) ? JSON.parse(rawExisting) : [];
                const existingKeys = new Set(existing.map(n => n.id || `${n.amount}_${n.description}_${n.date}`));

                for (const tx of result.transactions) {
                  const key = tx.id || `${tx.amount}_${tx.description}_${tx.date}`;
                  if (!existingKeys.has(key)) {
                    existing.push({
                      id: tx.id || ('notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
                      amount: tx.amount,
                      description: tx.description || 'Transacción Bancaria',
                      subject: tx.subject || '',
                      date: tx.date || new Date().toISOString(),
                      type: tx.type || 'expense',
                      timestamp: Date.now()
                    });
                    existingKeys.add(key);
                  }
                }

                localStorage.setItem(storageKey, JSON.stringify(existing));
                window.dispatchEvent(new CustomEvent('finanzapp:gmail:notifications-updated'));
              } catch (err) {
                console.warn('Error saving notifications to localStorage', err);
              }
            }

            showToast('Sincronización completada: ' + (result.count || 0) + ' transacciones nuevas.', 'success');
          } else {
            throw new Error('SyncAPI no disponible');
          }
        } catch (e) {
          console.error(e);
          showToast(e.message || 'Error al sincronizar.', 'error');
        } finally {
          syncBtn.disabled = false;
          syncBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Sincronizar';
          window.LucideHelper?.refresh(syncBtn);
        }
      });
    }
  }

  return {
    initImapSection,
    loadImapCredentials
  };
});

