/**
 * FinanzApp - Presupuestos Rollover Engine
 * Single Responsibility: Periodic budget renewal and date calculation
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PresupuestosRollover = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function addDays(d, days) {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  }

  function getNextPeriodRange(startDate, endDate, period) {
    const s = new Date(startDate);
    const e = new Date(endDate);

    if (period === 'weekly') {
      const newStart = addDays(e, 1);
      const newEnd = addDays(newStart, 6);
      return { newStart, newEnd };
    }

    if (period === 'biweekly') {
      const newStart = addDays(e, 1);
      const newEnd = addDays(newStart, 14);
      return { newStart, newEnd };
    }

    if (period === 'monthly') {
      const newStart = new Date(s.getFullYear(), s.getMonth() + 1, 1);
      const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
      return { newStart, newEnd };
    }

    if (period === 'yearly') {
      const newStart = new Date(s.getFullYear() + 1, 0, 1);
      const newEnd = new Date(newStart.getFullYear(), 11, 31);
      return { newStart, newEnd };
    }

    return { newStart: addDays(e, 1), newEnd: addDays(e, 1) };
  }

  function revisarYRenovarPresupuestos(budgets, calcularGastadoEnRango) {
    if (!Array.isArray(budgets)) return { summaries: [], changed: false };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const summaries = [];
    let changed = false;

    budgets.forEach(budget => {
      if (!budget || budget.period === 'custom') return;

      try {
        let start = new Date(budget.startDate);
        let end = new Date(budget.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        let anyRenewed = false;
        let lastSummary = null;

        while (end < today) {
          const spent = typeof calcularGastadoEnRango === 'function' 
            ? calcularGastadoEnRango(budget.categoryId, start.toISOString(), end.toISOString())
            : 0;
          const status = (spent <= (Number(budget.amount) || 0)) ? 'completed' : 'failed';

          lastSummary = {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            amount: Number(budget.amount) || 0,
            spent,
            status
          };

          const { newStart, newEnd } = getNextPeriodRange(start, end, budget.period);
          start = newStart;
          end = newEnd;
          anyRenewed = true;
        }

        if (anyRenewed && lastSummary) {
          budget.lastPeriodSummary = lastSummary;
          budget.startDate = start.toISOString();
          budget.endDate = end.toISOString();
          budget.lastRenewedAt = new Date().toISOString();
          summaries.push({ id: budget.id, name: budget.name, ...lastSummary });
          changed = true;
        }
      } catch (e) {
        console.error('Error renovando presupuesto:', budget?.id, e);
      }
    });

    return { summaries, changed };
  }

  const PresupuestosRolloverAPI = {
    addDays,
    getNextPeriodRange,
    revisarYRenovarPresupuestos
  };

  if (typeof window !== 'undefined') {
    window.PresupuestosRollover = PresupuestosRolloverAPI;
  }

  return PresupuestosRolloverAPI;
});

