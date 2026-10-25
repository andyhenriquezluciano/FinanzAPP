(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GmailNotificationManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class GmailNotificationManager {
    constructor() {
      this.notifications = this._loadNotifications();
      this.init();
    }

    _getStorageKey() {
      if (window.FirestoreDB?.ensureFirebaseInitialized) {
        window.FirestoreDB.ensureFirebaseInitialized();
      }
      let uid = null;
      if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.auth === 'function') {
        try {
          uid = window.firebase.auth().currentUser?.uid;
        } catch {}
      }
      if (!uid) {
        const authUid = (typeof window !== 'undefined' && window.AuthService)
          ? window.AuthService.getUserId()
          : null;
        if (authUid && authUid !== 'guest') {
          uid = authUid;
        } else {
          try {
            const rawAuth = localStorage.getItem('authUser');
            if (rawAuth) {
              const parsed = JSON.parse(rawAuth);
              uid = parsed.uid;
            }
          } catch {}
        }
      }
      return uid ? `finanzapp:gmail:pending_notifications:${uid}` : 'finanzapp:gmail:pending_notifications';
    }

    _isRealTransactionNotif(notif) {
      if (!notif || !notif.amount) return false;
      if (notif.source === 'imap' || notif.amount > 0) return true;
      const text = `${notif.description || ''} ${notif.subject || ''}`;
      const spamRegex = /(estado de cuenta|extracto|resumen de cuenta|resumen de saldo|balance de cuenta|balance mensual|informe de cuenta|estado de tarjeta|resumen mensual|alerta de inicio de sesi[oó]n|intento de acceso|cambio de contrase[nñ]a|empleo|vacante|postula|bolet[ií]n|newsletter|publicidad|descuento|ofert|promoci[oó]n|suscr[ií]bete|unsubscribe|darse de baja|ver en navegador|tienes hamb|lugares nuevos|soluciones|ahorro\s*🎨|bolsa de trabajo|linkedIn|glassdoor|indeed|career|hiring|trabajo|pide tu s[uú]per|como pides tu comida|c[oó]digo de verificaci[oó]n|verificar tu correo|clave temporal|otp|security code)/i;
      if (spamRegex.test(text)) return false;
      return true;
    }

    _sortList(list) {
      if (!Array.isArray(list)) return [];
      return list.sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : (a.timestamp || 0);
        const timeB = b.date ? new Date(b.date).getTime() : (b.timestamp || 0);
        const valA = isNaN(timeA) ? 0 : timeA;
        const valB = isNaN(timeB) ? 0 : timeB;
        return valB - valA;
      });
    }

    _loadNotifications() {
      try {
        const key = this._getStorageKey();
        let raw = localStorage.getItem(key);
        if (!raw) {
          raw = localStorage.getItem('finanzapp:gmail:pending_notifications');
        }
        if (!raw) return [];
        const items = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
        const filtered = items.filter(item => this._isRealTransactionNotif(item));
        return this._sortList(filtered);
      } catch {
        return [];
      }
    }

    _saveNotifications() {
      this.notifications = this._sortList(this.notifications);
      const key = this._getStorageKey();
      localStorage.setItem(key, JSON.stringify(this.notifications));
      this.updateBadges();
      this.renderList();
      if (typeof window.renderMobileNotificationsMenu === 'function') {
        window.renderMobileNotificationsMenu();
      }
    }

    addNotification(txn) {
      if (!txn || !txn.amount || !this._isRealTransactionNotif(txn)) return;

      const notif = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        amount: txn.amount,
        description: txn.description || 'Comercio no especificado',
        subject: txn.subject || '',
        date: txn.date || new Date().toISOString(),
        type: txn.type || 'expense',
        timestamp: Date.now()
      };

      const exists = this.notifications.some(n => 
        n.amount === notif.amount && n.description === notif.description && n.date === notif.date
      );
      if (!exists) {
        this.notifications.push(notif);
        this.notifications = this._sortList(this.notifications);
        this._saveNotifications();
      }
    }

    removeNotification(id) {
      this.notifications = this.notifications.filter(n => n.id !== id);
      this._saveNotifications();
    }

    async clearAll() {
      if (!this.notifications || this.notifications.length === 0) return;

      const result = await (typeof window.showAlert === 'function'
        ? window.showAlert('Eliminar notificaciones', '¿Estás seguro de que deseas eliminar todas las notificaciones detectadas?', { variant: 'confirm', emphasis: 'danger', confirmText: 'Eliminar todas', cancelText: 'Cancelar' })
        : Promise.resolve(confirm('¿Estás seguro de que deseas eliminar todas las notificaciones detectadas?')));
        
      if (result !== 'confirm' && result !== true) return;
      
      this.notifications = [];
      this._saveNotifications();
      this.updateBadges();
      this.renderList();
      window.dispatchEvent(new CustomEvent('finanzapp:gmail:notifications-updated'));
    }

    updateBadges() {
      const count = this.notifications.length;
      const badge = document.getElementById('gmailBadge');
      const mobileBadge = document.getElementById('mobileGmailBadge');

      [badge, mobileBadge].forEach(b => {
        if (!b) return;
        b.textContent = count;
        if (count > 0) {
          b.classList.remove('hidden');
          b.style.display = 'inline-flex';
          b.style.alignItems = 'center';
          b.style.justifyContent = 'center';
        } else {
          b.classList.add('hidden');
          b.style.display = 'none';
        }
      });
    }

    renderList() {
      const listEl = document.getElementById('gmailNotifList');
      const footerEl = document.getElementById('gmailNotifFooter');
      if (!listEl) return;

      try {
        this.notifications = this._sortList(this.notifications);

        if (!this.notifications.length) {
          listEl.innerHTML = '<p class="gmail-notif-empty" style="text-align:center; color:#888; padding:20px 10px;">Sin notificaciones bancarias pendientes.</p>';
          if (footerEl) footerEl.style.display = 'none';
          return;
        }

        if (footerEl) footerEl.style.display = 'flex';

        listEl.innerHTML = this.notifications.map(n => {
          const numAmount = Number(n.amount) || 0;
          let formattedAmount;
          try {
            if (window.Core?.helpers?.formatCurrency) {
              formattedAmount = window.Core.helpers.formatCurrency(numAmount);
            } else {
              const raw = JSON.parse(localStorage.getItem('finanzapp:settings:v1') || '{}');
              if (raw?.censorAmounts === 'on') {
                formattedAmount = '$ ••••';
              } else {
                formattedAmount = `$${numAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              }
            }
          } catch {
            formattedAmount = `$${numAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
          let formattedDate = '';
          try {
            if (n.date) {
              const rawDate = (n.date && typeof n.date.toDate === 'function') ? n.date.toDate() : n.date;
              formattedDate = typeof window.formatDate === 'function'
                ? window.formatDate(rawDate)
                : (window.Core?.helpers?.formatDate ? window.Core.helpers.formatDate(rawDate) : new Date(rawDate).toLocaleDateString());
            }
          } catch (_) {}

          const subjectText = (n.subject && n.subject !== n.description) ? n.subject : (n.description || 'Notificación bancaria');
          return `
            <div class="gmail-notif-item" data-id="${n.id}">
              <div class="gmail-notif-item-top">
                <span class="gmail-notif-merchant">${n.description || 'Comercio'}</span>
                <span class="gmail-notif-amount">${formattedAmount}</span>
              </div>
              <div class="gmail-notif-item-bottom">
                <span class="gmail-notif-detail">${subjectText}</span>
                ${formattedDate ? `<span class="gmail-notif-date"><i data-lucide="calendar"></i>${formattedDate}</span>` : ''}
              </div>
            </div>
          `;
        }).join('');

        window.LucideHelper?.refresh(listEl);

        listEl.querySelectorAll('.gmail-notif-item').forEach(item => {
          item.addEventListener('click', () => {
            const id = item.getAttribute('data-id');
            const notif = this.notifications.find(n => n.id === id);
            if (notif) {
              this.togglePanel(false);
              abrirModalRevisarGmail(notif, id);
            }
          });
        });
      } catch (err) {
        console.error('Error rendering notification list:', err);
      }
    }

    positionPanel() {
      const panel = document.getElementById('gmailNotifPanel');
      const bellBtn = document.getElementById('gmailBellBtn');
      if (!panel) return;

      panel.style.zIndex = '999999';

      if (!bellBtn || bellBtn.offsetParent === null) {
        panel.style.top = '70px';
        panel.style.right = '16px';
        panel.style.left = 'auto';
        return;
      }

      const rect = bellBtn.getBoundingClientRect();
      const panelWidth = Math.min(360, window.innerWidth - 32);
      const top = Math.max(10, Math.round(rect.bottom + 8));
      let right = Math.round(window.innerWidth - rect.right);

      if (right < 16) right = 16;
      if (window.innerWidth - right - panelWidth < 16) {
        right = Math.max(16, window.innerWidth - panelWidth - 16);
      }

      panel.style.top = `${top}px`;
      panel.style.right = `${right}px`;
      panel.style.left = 'auto';
    }

    togglePanel(show) {
      const panel = document.getElementById('gmailNotifPanel');
      const overlay = document.getElementById('gmailNotifOverlay');
      if (!panel) return;

      const isHidden = panel.classList.contains('hidden') || panel.style.display === 'none';
      const shouldShow = typeof show === 'boolean' ? show : isHidden;

      if (shouldShow) {
        panel.classList.remove('hidden');
        panel.style.display = 'flex';
        panel.style.zIndex = '999999';
        this.positionPanel();
        if (overlay) {
          overlay.classList.remove('hidden');
          overlay.style.display = 'block';
          overlay.style.zIndex = '999998';
        }
        this.renderList();
      } else {
        panel.classList.add('hidden');
        panel.style.display = 'none';
        if (overlay) {
          overlay.classList.add('hidden');
          overlay.style.display = 'none';
        }
      }
    }

    init() {
      this.updateBadges();

      const bellBtn = document.getElementById('gmailBellBtn');
      if (bellBtn) {
        bellBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.togglePanel();
        };
      }

      const closeBtn = document.getElementById('gmailNotifClose');
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.togglePanel(false);
        };
      }

      const overlay = document.getElementById('gmailNotifOverlay');
      if (overlay) {
        overlay.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.togglePanel(false);
        };
      }

      const clearBtn = document.getElementById('gmailClearAllBtn');
      if (clearBtn) {
        clearBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.clearAll();
        };
      }

      window.addEventListener('resize', () => {
        const panel = document.getElementById('gmailNotifPanel');
        if (panel && !panel.classList.contains('hidden') && panel.style.display !== 'none') {
          this.positionPanel();
        }
      });

      window.addEventListener('scroll', () => {
        const panel = document.getElementById('gmailNotifPanel');
        if (panel && !panel.classList.contains('hidden') && panel.style.display !== 'none') {
          this.positionPanel();
        }
      }, { passive: true });

      document.addEventListener('click', (e) => {
        const panel = document.getElementById('gmailNotifPanel');
        const bell = document.getElementById('gmailBellBtn');
        if (panel && !panel.classList.contains('hidden') && panel.style.display !== 'none') {
          if (e.target.closest('.modal, .custom-alert-overlay, .modal-backdrop, [role="dialog"], .flatpickr-calendar')) {
            return;
          }
          if (!panel.contains(e.target) && (!bell || !bell.contains(e.target))) {
            this.togglePanel(false);
          }
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const panel = document.getElementById('gmailNotifPanel');
          if (panel && !panel.classList.contains('hidden') && panel.style.display !== 'none') {
            this.togglePanel(false);
          }
        }
      });

      window.addEventListener('finanzapp:gmail:open-review', (e) => {
        const id = e?.detail?.id;
        if (!id) return;
        const notif = this.notifications.find(n => n.id === id);
        if (notif) {
          this.togglePanel(false);
          abrirModalRevisarGmail(notif, id, { source: e?.detail?.source || 'desktop' });
        }
      });

      window.addEventListener('finanzapp:gmail:clear-all', () => {
        this.clearAll();
      });

      window.addEventListener('finanzapp:gmail:notifications-updated', () => {
        this.notifications = this._loadNotifications();
        this.updateBadges();
        this.renderList();
      });

      window.addEventListener('storage', (e) => {
        const key = this._getStorageKey();
        if (e.key === key || e.key === 'finanzapp:gmail:pending_notifications' || e.key === 'finanzapp:gmail:notifications') {
          this.notifications = this._loadNotifications();
          this.updateBadges();
          this.renderList();
        }
      });

      if (window.FirestoreDB?.ensureFirebaseInitialized) {
        window.FirestoreDB.ensureFirebaseInitialized();
      }

      if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.auth === 'function') {
        try {
          window.firebase.auth().onAuthStateChanged((user) => {
            if (user) {
              this.notifications = this._loadNotifications();
              this.updateBadges();
              this.renderList();
              this.syncFromFirestore();
            }
          });
        } catch (e) {}
      }

      this.syncFromFirestore();
    }

    async syncFromFirestore() {
      try {
        if (window.FirestoreDB?.ensureFirebaseInitialized) {
          window.FirestoreDB.ensureFirebaseInitialized();
        }
        let uid = null;
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.auth === 'function') {
          try {
            uid = window.firebase.auth().currentUser?.uid;
          } catch (e) {}
        }
        if (!uid) {
          const authUid = (typeof window !== 'undefined' && window.AuthService)
            ? window.AuthService.getUserId()
            : null;
          if (authUid && authUid !== 'guest') {
            uid = authUid;
          } else {
            try {
              const rawAuth = localStorage.getItem('authUser');
              if (rawAuth) uid = JSON.parse(rawAuth).uid;
            } catch {}
          }
        }
        if (!uid || !window.firebase?.apps?.length || !window.firebase?.firestore) {
          return;
        }
        const db = window.firebase.firestore();
        const firestoreNotifs = [];

        // 1. Obtener de la subcolección transactions del usuario
        try {
          const snap = await db.collection('users').doc(uid).collection('transactions').get();
          if (!snap.empty) {
            snap.forEach(doc => {
              const d = doc.data();
              if (d && !d.ignored && !d.processed && d.amount) {
                firestoreNotifs.push({
                  id: doc.id,
                  amount: d.amount,
                  description: d.description || d.merchant || d.subject || 'Transacción Bancaria',
                  subject: d.subject || '',
                  date: d.date ? (d.date.toDate ? d.date.toDate().toISOString() : new Date(d.date).toISOString()) : new Date().toISOString(),
                  type: d.type || 'expense',
                  timestamp: d.createdAt ? (d.createdAt.toMillis ? d.createdAt.toMillis() : Date.now()) : Date.now(),
                  source: d.source || 'imap'
                });
              }
            });
          }
        } catch (subErr) {
          console.warn('[GmailNotifManager] Error leyendo subcolección transactions:', subErr);
        }

        // 2. Obtener también de transactions en el documento raíz
        try {
          const userDoc = await db.collection('users').doc(uid).get();
          if (userDoc.exists) {
            const uData = userDoc.data();
            if (Array.isArray(uData.transactions)) {
              uData.transactions.forEach(t => {
                if (t && t.amount && (t.source === 'imap' || !t.categoryId)) {
                  firestoreNotifs.push({
                    id: t.id || t.originalMessageId || `imap_${t.amount}_${t.date}`,
                    amount: t.amount,
                    description: t.description || t.subject || 'Transacción Bancaria',
                    subject: t.subject || '',
                    date: t.date || new Date().toISOString(),
                    type: t.type || 'expense',
                    timestamp: t.timestamp || Date.now(),
                    source: t.source || 'imap'
                  });
                }
              });
            }
          }
        } catch (rootErr) {
          console.warn('[GmailNotifManager] Error leyendo documento raíz:', rootErr);
        }

        // Filtrar transacciones ya asignadas a categorías
        const assignedIds = new Set();
        const categories = (typeof window.datosUsuario !== 'undefined' && Array.isArray(window.datosUsuario.categories))
          ? window.datosUsuario.categories
          : (typeof window.obtenerCategorias === 'function' ? window.obtenerCategorias() : []);

        categories.forEach(c => {
          (c.transactions || []).forEach(tx => {
            if (tx.id) assignedIds.add(String(tx.id));
            if (tx.originalMessageId) assignedIds.add(String(tx.originalMessageId));
          });
        });

        const currentMap = new Map();
        firestoreNotifs.forEach(n => {
          if (!assignedIds.has(String(n.id))) {
            currentMap.set(n.id || `${n.amount}_${n.description}_${n.date}`, n);
          }
        });

        this._loadNotifications().forEach(n => {
          if (!assignedIds.has(String(n.id))) {
            const key = n.id || `${n.amount}_${n.description}_${n.date}`;
            if (!currentMap.has(key)) currentMap.set(key, n);
          }
        });

        this.notifications = this._sortList(Array.from(currentMap.values()));
        this._saveNotifications();
        this.updateBadges();
        this.renderList();
      } catch (e) {
        console.warn('[GmailNotifManager] Error syncing notifications from Firestore', e);
      }
    }
  }

  let gmailNotifManager = null;

  function ensureGmailNotifManager() {
    if (!gmailNotifManager) {
      gmailNotifManager = new GmailNotificationManager();
      window.gmailNotifManager = gmailNotifManager;
    }
    return gmailNotifManager;
  }

  // Abre el modal de categorización/revisión para una notificación bancaria detectada.
  function abrirModalRevisarGmail(notif, notifId = null, options = {}) {
    const modal = document.getElementById('gmailReviewModal');
    if (!modal) return;

    const wasMobileOpen = options?.source === 'mobile' || !!document.getElementById('mobileNotificationsDropdown')?.classList.contains('open');
    const wasDesktopOpen = options?.source === 'desktop' || (!document.getElementById('gmailNotifPanel')?.classList.contains('hidden') && document.getElementById('gmailNotifPanel')?.style.display !== 'none');

    const oldDynamicModal = document.getElementById('gmail-authorize-modal');
    if (oldDynamicModal) oldDynamicModal.remove();

    const amountInput = document.getElementById('gmailTxAmount');
    const descInput = document.getElementById('gmailTxDesc');
    const dateInput = document.getElementById('gmailTxDate');
    const catDropdown = document.getElementById('gmailTxCategory');
    const saveBtn = document.getElementById('gmailReviewSave');
    const discardBtn = document.getElementById('gmailReviewDiscard');
    const cancelBtn = document.getElementById('gmailReviewCancel');
    const closeBtn = document.getElementById('gmailReviewClose');

    if (amountInput) amountInput.value = notif.amount || '';
    if (descInput) descInput.value = notif.description || '';

    if (dateInput) {
      const formatDateFn = window.formatDate || window.Core?.helpers?.formatDate;
      dateInput.value = formatDateFn ? formatDateFn(notif.date || new Date()) : new Date().toLocaleDateString();
    }

    let currentTxType = notif.type || 'expense';
    const typeSelector = document.getElementById('gmailTxTypeSelector');

    const poblarCategoriasModal = (txType) => {
      const allCategories = (typeof window.datosUsuario !== 'undefined' && window.datosUsuario.categories)
        ? window.datosUsuario.categories
        : (typeof window.obtenerCategorias === 'function' ? window.obtenerCategorias() : []);

      const validCategories = allCategories.filter(c => {
        if (txType === 'expense') return c.fixedType !== 'income';
        if (txType === 'income') return c.fixedType !== 'expense';
        return true;
      });

      let matchedCatId = '';
      let suggestionInfo = null;
      if (typeof window !== 'undefined' && window.MerchantCategorizer && (notif.description || notif.subject) && validCategories.length) {
        suggestionInfo = window.MerchantCategorizer.suggestCategory(
          notif.description || notif.subject,
          validCategories,
          { historyMemory: allCategories, txType }
        );
        if (suggestionInfo) {
          matchedCatId = suggestionInfo.categoryId;
        }
      }

      if (!matchedCatId && notif.description && validCategories.length) {
        const descLower = notif.description.toLowerCase();
        const subjectLower = (notif.subject || '').toLowerCase();
        const matched = validCategories.find(c => {
          const cName = c.name.toLowerCase();
          return descLower.includes(cName) || subjectLower.includes(cName);
        });
        if (matched) matchedCatId = matched.id;
      }

      const selectedCatId = matchedCatId || validCategories[0]?.id || '';

      if (catDropdown) {
        catDropdown.classList.remove('open');
        const optionsContainer = catDropdown.querySelector('.custom-dropdown-options');
        const selectedEl = catDropdown.querySelector('.custom-dropdown-selected');

        if (optionsContainer) {
          if (!validCategories.length) {
            optionsContainer.innerHTML = '<div class="custom-dropdown-option disabled"><span>Sin categorías disponibles</span></div>';
          } else {
            optionsContainer.innerHTML = validCategories.map(c => `
              <div class="custom-dropdown-option ${String(c.id) === String(selectedCatId) ? 'selected' : ''}" data-value="${c.id}">
                <span>${c.name}</span>
              </div>
            `).join('');
          }

          optionsContainer.querySelectorAll('.custom-dropdown-option').forEach(opt => {
            opt.onclick = (e) => {
              e.stopPropagation();
              const val = opt.getAttribute('data-value');
              const catObj = validCategories.find(c => String(c.id) === String(val));
              if (selectedEl) {
                selectedEl.setAttribute('data-value', val || '');
                const span = selectedEl.querySelector('span');
                if (span) span.textContent = catObj ? catObj.name : 'Seleccionar categoría';
              }
              optionsContainer.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('selected'));
              opt.classList.add('selected');
              catDropdown.classList.remove('open');
            };
          });
        }

        if (selectedEl) {
          const selectedCat = validCategories.find(c => String(c.id) === String(selectedCatId));
          selectedEl.setAttribute('data-value', selectedCatId);
          const span = selectedEl.querySelector('span');
          if (span) span.textContent = selectedCat ? selectedCat.name : 'Seleccionar categoría';
          
          selectedEl.onclick = (e) => {
            e.stopPropagation();
            catDropdown.classList.toggle('open');
          };
        }
      }
    };

    if (typeSelector) {
      const btns = typeSelector.querySelectorAll('.transaction-type-btn');
      btns.forEach(b => {
        const val = b.getAttribute('data-value');
        b.classList.toggle('active', val === currentTxType);
        b.onclick = () => {
          btns.forEach(btn => btn.classList.remove('active'));
          b.classList.add('active');
          currentTxType = val;
          poblarCategoriasModal(currentTxType);
        };
      });
    }

    poblarCategoriasModal(currentTxType);

    const abrirModalFn = window.CategoriasModals?.abrirModal || window.abrirModal;
    const cerrarModalFn = window.CategoriasModals?.cerrarModal || window.cerrarModal;

    if (typeof abrirModalFn === 'function') {
      abrirModalFn(modal);
    } else {
      modal.classList.add('active');
    }

    const closeModal = (wasCanceled = false) => {
      if (typeof cerrarModalFn === 'function') {
        cerrarModalFn(modal);
      } else {
        modal.classList.remove('active');
      }
      if (wasCanceled) {
        if (wasMobileOpen) {
          const notifDropdown = document.getElementById('mobileNotificationsDropdown');
          if (notifDropdown) notifDropdown.classList.add('open');
        } else if (wasDesktopOpen && window.gmailNotifManager) {
          window.gmailNotifManager.togglePanel(true);
        }
      }
    };

    if (closeBtn) closeBtn.onclick = () => closeModal(true);
    if (cancelBtn) cancelBtn.onclick = () => closeModal(true);
    if (discardBtn) {
      discardBtn.onclick = () => {
        if (notifId && gmailNotifManager) gmailNotifManager.removeNotification(notifId);
        closeModal(false);
        window.dispatchEvent(new CustomEvent('finanzapp:gmail:notifications-updated'));
      };
    }

    if (saveBtn) {
      saveBtn.onclick = async () => {
        const amountVal = parseFloat(amountInput?.value || notif.amount);
        const descVal = descInput?.value || notif.description;
        const catVal = catDropdown?.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') || null;

        if (!catVal) {
          if (typeof window.showAlert === 'function') {
            window.showAlert('Atención', 'Por favor selecciona una categoría.');
          } else {
            alert('Por favor selecciona una categoría.');
          }
          return;
        }

        const activeTypeBtn = typeSelector?.querySelector('.transaction-type-btn.active');
        const typeVal = activeTypeBtn?.getAttribute('data-value') || notif.type || 'expense';

        if (typeof window.agregarTransaccionDirecta === 'function') {
          const success = await window.agregarTransaccionDirecta(
            catVal,
            typeVal,
            amountVal,
            descVal,
            notif.date ? new Date(notif.date) : new Date()
          );

          if (success) {
            if (notifId && gmailNotifManager) gmailNotifManager.removeNotification(notifId);
            closeModal(false);
            window.dispatchEvent(new CustomEvent('finanzapp:gmail:notifications-updated'));
            if (typeof window._configMostrarToast === 'function') {
              window._configMostrarToast('✓ Transacción agregada exitosamente', 'exito');
            } else if (typeof window.mostrarExito === 'function') {
              window.mostrarExito('✓ Transacción agregada exitosamente');
            }
          }
        }
      };
    }
  }

  async function initGmailTransactionListener() {
    ensureGmailNotifManager();
    if (!window.GmailAPI) return;

    const handleTransaction = (txn) => {
      if (!txn || !txn.amount) return;
      gmailNotifManager.addNotification(txn);
    };

    if (!window.GmailAPI.isSignedIn() && typeof window.GmailAPI.ensureSession === 'function') {
      await window.GmailAPI.ensureSession();
    }

    if (window.GmailAPI.isSignedIn()) {
      window.GmailAPI.startPolling(handleTransaction);
    }

    window.GmailAPI._onStatusChange = (signedIn) => {
      if (signedIn) {
        window.GmailAPI.startPolling(handleTransaction);
      }
    };
  }

  // Exportar al ámbito global
  window.ensureGmailNotifManager = ensureGmailNotifManager;
  window.abrirModalRevisarGmail = abrirModalRevisarGmail;
  window.initGmailTransactionListener = initGmailTransactionListener;
  window.toggleGmailNotifPanel = function (show) {
    const mgr = ensureGmailNotifManager();
    if (mgr) mgr.togglePanel(show);
  };

  // Inicialización automática
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => ensureGmailNotifManager());
    } else {
      ensureGmailNotifManager();
    }
  }

  return {
    GmailNotificationManager,
    ensureGmailNotifManager,
    abrirModalRevisarGmail,
    initGmailTransactionListener
  };
});

