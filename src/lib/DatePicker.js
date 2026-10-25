/**
 * FinanzApp - Centralized DatePicker Component
 * Unified calendar date selector modal for Categorias, Presupuestos, etc.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DatePicker = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let currentTargetInput = null;
  let currentDisplayDate = new Date();
  let selectedDate = null;
  let currentOptions = {};

  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  function parseInputDate(val) {
    if (!val) return null;
    if (typeof window !== 'undefined' && window.Core?.helpers?.parseDateInput) {
      return window.Core.helpers.parseDateInput(val);
    }
    if (typeof window !== 'undefined' && window.parseFechaInput) {
      return window.parseFechaInput(val);
    }
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDateForInput(date) {
    if (!date) return '';
    if (typeof window !== 'undefined' && window.Core?.helpers?.formatDateForInput) {
      return window.Core.helpers.formatDateForInput(date);
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function ensureModal() {
    if (typeof document === 'undefined' || !document.body) return null;
    let modal = document.getElementById('datePickerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'datePickerModal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'datePickerTitle');
      modal.setAttribute('inert', '');
      modal.setAttribute('aria-hidden', 'true');

      modal.innerHTML = `
    <div class="modal-content date-picker-modal">
      <div class="modal-header">
        <h2 class="modal-title" id="datePickerTitle">Seleccionar Fecha</h2>
        <button class="modal-close" aria-label="Cerrar modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="date-picker-container">
          <div class="date-picker-header">
            <button class="date-nav-btn" id="prevMonthBtn" type="button" aria-label="Mes anterior">
              <i data-lucide="chevron-left">&#9664;</i>
            </button>
            <h3 id="currentMonthYear"></h3>
            <button class="date-nav-btn" id="nextMonthBtn" type="button" aria-label="Mes siguiente">
              <i data-lucide="chevron-right">&#9654;</i>
            </button>
          </div>
          <div class="date-picker-calendar">
            <div class="calendar-weekdays">
              <div class="weekday">Dom</div>
              <div class="weekday">Lun</div>
              <div class="weekday">Mar</div>
              <div class="weekday">Mié</div>
              <div class="weekday">Jue</div>
              <div class="weekday">Vie</div>
              <div class="weekday">Sáb</div>
            </div>
            <div class="calendar-days" id="calendarDays"></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancelDateBtn" type="button">Cancelar</button>
        <div class="date-actions-right">
          <button class="btn btn-primary" id="todayBtn" type="button">Hoy</button>
          <button class="btn btn-primary" id="selectDateBtn" type="button">Seleccionar</button>
        </div>
      </div>
    </div>`;
      document.body.appendChild(modal);

      if (typeof window !== 'undefined' && window.lucide?.createIcons) {
        try {
          window.lucide.createIcons();
        } catch (_) {}
      }
      bindModalEvents(modal);
    }
    return modal;
  }

  function getModal() {
    return ensureModal();
  }

  function renderizarCalendario() {
    const currentMonthYear = document.getElementById('currentMonthYear');
    const calendarDays = document.getElementById('calendarDays');
    if (!currentMonthYear || !calendarDays) return;

    const year = currentDisplayDate.getFullYear();
    const month = currentDisplayDate.getMonth();

    currentMonthYear.textContent = `${MONTH_NAMES[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    calendarDays.innerHTML = '';

    for (let i = 0; i < startDayOfWeek; i++) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'calendar-day empty';
      calendarDays.appendChild(emptyEl);
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.textContent = day;

      if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
        dayEl.classList.add('selected');
      }

      let isDisabled = false;
      if (currentOptions.disableFuture && date > today) {
        isDisabled = true;
      }
      if (currentOptions.minDate && date < currentOptions.minDate) {
        isDisabled = true;
      }
      if (currentOptions.maxDate && date > currentOptions.maxDate) {
        isDisabled = true;
      }

      if (isDisabled) {
        dayEl.classList.add('disabled');
      } else {
        dayEl.addEventListener('click', () => seleccionarFecha(date));
      }

      calendarDays.appendChild(dayEl);
    }
  }

  function seleccionarFecha(date) {
    selectedDate = date;
    const dayEls = document.querySelectorAll('#calendarDays .calendar-day:not(.empty)');
    dayEls.forEach(el => {
      const dayNum = parseInt(el.textContent, 10);
      const d = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), dayNum);
      if (d.toDateString() === date.toDateString()) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }

  function navegarMes(direction) {
    currentDisplayDate.setMonth(currentDisplayDate.getMonth() + direction);
    if (selectedDate) {
      if (selectedDate.getMonth() !== currentDisplayDate.getMonth() ||
          selectedDate.getFullYear() !== currentDisplayDate.getFullYear()) {
        selectedDate = null;
      }
    }
    renderizarCalendario();
  }

  function establecerHoy() {
    selectedDate = new Date();
    currentDisplayDate = new Date();
    renderizarCalendario();
  }

  function confirmarSeleccion() {
    if (!selectedDate) {
      const selectedEl = document.querySelector('#calendarDays .calendar-day.selected');
      if (selectedEl) {
        const dayNum = parseInt(selectedEl.textContent, 10);
        if (!isNaN(dayNum)) {
          selectedDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), dayNum);
        }
      }
    }

    if (!selectedDate) return;

    let targetEl = null;
    if (typeof currentTargetInput === 'string') {
      targetEl = document.getElementById(currentTargetInput) || document.querySelector(currentTargetInput);
    } else if (currentTargetInput instanceof HTMLElement) {
      targetEl = currentTargetInput;
    }

    const formatted = formatDateForInput(selectedDate);
    if (targetEl) {
      targetEl.value = formatted;
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
      targetEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (typeof currentOptions.onConfirm === 'function') {
      currentOptions.onConfirm(selectedDate, formatted);
    }

    cerrar();
  }

  function cerrar() {
    const modal = getModal();
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('inert', '');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (document.body) {
      document.body.classList.remove('modal-open');
    }
    if (typeof currentOptions.onClose === 'function') {
      currentOptions.onClose();
    }
  }

  function abrir(targetInput, options = {}) {
    currentTargetInput = targetInput;
    currentOptions = options;

    let targetEl = null;
    if (typeof targetInput === 'string') {
      targetEl = document.getElementById(targetInput) || document.querySelector(targetInput);
    } else if (targetInput instanceof HTMLElement) {
      targetEl = targetInput;
    }

    let initialDate = new Date();
    selectedDate = null;

    if (targetEl && targetEl.value) {
      const parsed = parseInputDate(targetEl.value);
      if (parsed) {
        initialDate = parsed;
        selectedDate = parsed;
      }
    }

    currentDisplayDate = new Date(initialDate.getTime());

    const modal = getModal();
    if (modal) {
      modal.classList.add('active');
      modal.removeAttribute('inert');
      modal.setAttribute('aria-hidden', 'false');
      if (document.body) document.body.classList.add('modal-open');
      renderizarCalendario();
    }
  }

  function bindModalEvents(modalEl) {
    const modal = modalEl || document.getElementById('datePickerModal');
    if (!modal || modal._dpBound) return;
    modal._dpBound = true;

    const prevBtn = modal.querySelector('#prevMonthBtn') || modal.querySelector('#prevMonth');
    const nextBtn = modal.querySelector('#nextMonthBtn') || modal.querySelector('#nextMonth');
    const todayBtn = modal.querySelector('#todayBtn');
    const confirmBtn = modal.querySelector('#selectDateBtn') || modal.querySelector('#confirmDate');
    const cancelBtn = modal.querySelector('#cancelDateBtn') || modal.querySelector('#cancelDate');
    const closeBtn = modal.querySelector('.modal-close');

    if (prevBtn) prevBtn.onclick = (e) => { e.preventDefault(); navegarMes(-1); };
    if (nextBtn) nextBtn.onclick = (e) => { e.preventDefault(); navegarMes(1); };
    if (todayBtn) todayBtn.onclick = (e) => { e.preventDefault(); establecerHoy(); };
    if (confirmBtn) confirmBtn.onclick = (e) => { e.preventDefault(); confirmarSeleccion(); };
    if (cancelBtn) cancelBtn.onclick = (e) => { e.preventDefault(); cerrar(); };
    if (closeBtn) closeBtn.onclick = (e) => { e.preventDefault(); cerrar(); };

    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrar();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        cerrar();
      }
    });
  }

  function init() {
    if (typeof document === 'undefined') return;
    ensureModal();
  }

  // Auto-init on DOM ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 0);
    }
  }

  const DatePickerAPI = {
    open: abrir,
    close: cerrar,
    render: renderizarCalendario,
    select: seleccionarFecha,
    navigateMonth: navegarMes,
    setToday: establecerHoy,
    confirm: confirmarSeleccion,
    init: init
  };

  if (typeof window !== 'undefined') {
    window.DatePicker = DatePickerAPI;
    window.openDatePicker = abrir;
  }

  return DatePickerAPI;
});

