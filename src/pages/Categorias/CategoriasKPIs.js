/**
 * FinanzApp - Categorias KPIs & Summary Calculations
 * Single Responsibility: Calculate financial totals, percentage changes, and daily metrics
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoriasKPIs = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const pctFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function round2(val) {
    if (typeof window !== 'undefined' && window.Core?.helpers?.round2) {
      return window.Core.helpers.round2(val);
    }
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  function formatCurrency(val) {
    if (typeof window !== 'undefined' && window.Core?.helpers?.formatCurrency) {
      return window.Core.helpers.formatCurrency(val);
    }
    return `$${val.toFixed(2)}`;
  }

  function pctChangeText(curr, prev) {
    if (prev === 0) {
      if (curr === 0) return { pct: 0, sign: '', formatted: '0.0', text: '0.0% desde el mes pasado' };
      return { pct: 100, sign: '+', formatted: '100.0', text: '+100.0% desde el mes pasado' };
    }

    const pct = ((curr - prev) / prev) * 100;
    const sign = pct > 0 ? '+' : (pct < 0 ? '-' : '');
    const formatted = pctFormatter.format(Math.abs(pct));
    return { pct, sign, formatted, text: `${sign}${formatted}% desde el mes pasado` };
  }

  function calcularTotalesMes(year, month, categories) {
    const totals = { income: 0, expenses: 0 };
    if (!Array.isArray(categories)) return totals;

    categories.forEach(category => {
      (category.transactions || []).forEach(transaction => {
        const date = transaction.date instanceof Date ? transaction.date : (transaction.date ? new Date(transaction.date) : null);
        if (!date || isNaN(date.getTime())) return;
        if (date.getFullYear() !== year || date.getMonth() !== month) return;
        if (transaction.type === 'income') {
          totals.income = round2(totals.income + transaction.amount);
        } else if (transaction.type === 'expense') {
          totals.expenses = round2(totals.expenses + transaction.amount);
        }
      });
    });
    return totals;
  }

  function recomputeMonthlyDataForYear(year, categories, monthlyDataTarget) {
    if (!monthlyDataTarget) return;
    monthlyDataTarget.income = new Array(12).fill(0);
    monthlyDataTarget.expenses = new Array(12).fill(0);

    (categories || []).forEach(cat => {
      (cat.transactions || []).forEach(t => {
        const d = t.date instanceof Date ? t.date : (t.date ? new Date(t.date) : null);
        if (!d || isNaN(d.getTime()) || d.getFullYear() !== year) return;
        const m = d.getMonth();
        if (t.type === 'income') monthlyDataTarget.income[m] = round2(monthlyDataTarget.income[m] + t.amount);
        else if (t.type === 'expense') monthlyDataTarget.expenses[m] = round2(monthlyDataTarget.expenses[m] + t.amount);
      });
    });
  }

  function calcularEstadisticasDiarias(filteredCategories) {
    const today = new Date();
    const start30 = new Date();
    start30.setDate(today.getDate() - 29);

    let incomeToday = 0;
    let expensesToday = 0;
    let sumNetLast30 = 0;
    let daysCounted = 0;

    const netByDate = new Map();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start30);
      d.setDate(start30.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      netByDate.set(key, 0);
    }

    (filteredCategories || []).forEach(cat => {
      (cat.transactions || []).forEach(t => {
        const d = t.date instanceof Date ? t.date : new Date(t.date);
        if (isNaN(d.getTime())) return;
        const key = d.toISOString().slice(0, 10);

        if (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        ) {
          if (t.type === 'income') incomeToday = round2(incomeToday + t.amount);
          else if (t.type === 'expense') expensesToday = round2(expensesToday + t.amount);
        }

        if (d >= start30 && d <= today) {
          const delta = (t.type === 'income') ? t.amount : -t.amount;
          netByDate.set(key, round2((netByDate.get(key) || 0) + delta));
        }
      });
    });

    netByDate.forEach(v => {
      sumNetLast30 = round2(sumNetLast30 + v);
      daysCounted++;
    });
    const avgDaily = daysCounted > 0 ? round2(sumNetLast30 / daysCounted) : 0;

    return { incomeToday, expensesToday, avgDaily };
  }

  function actualizarUIEstadisticasDiarias(filteredCategories) {
    const incomeEl = document.getElementById('dailyIncome');
    const expenseEl = document.getElementById('dailyExpenses');
    const avgEl = document.getElementById('dailyAverage');
    if (!incomeEl || !expenseEl || !avgEl) return;

    const { incomeToday, expensesToday, avgDaily } = calcularEstadisticasDiarias(filteredCategories);
    incomeEl.textContent = formatCurrency(incomeToday);
    expenseEl.textContent = formatCurrency(expensesToday);
    avgEl.textContent = formatCurrency(avgDaily);
  }

  function actualizarResumenFinanciero(allCategories, filteredCategories, filtrosActuales, monthlyDataTarget) {
    const today = new Date();
    const year = (filtrosActuales && filtrosActuales.year != null) ? filtrosActuales.year : today.getFullYear();
    const month = (filtrosActuales && filtrosActuales.month != null) ? filtrosActuales.month : today.getMonth();

    if (monthlyDataTarget) {
      recomputeMonthlyDataForYear(year, allCategories, monthlyDataTarget);
    }

    let totalIncome = 0;
    let totalExpenses = 0;

    (filteredCategories || []).forEach(category => {
      (category.transactions || []).forEach(transaction => {
        if (transaction.type === 'income') {
          totalIncome = round2(totalIncome + transaction.amount);
        } else if (transaction.type === 'expense') {
          totalExpenses = round2(totalExpenses + transaction.amount);
        }
      });
    });

    const balance = round2(totalIncome - totalExpenses);

    const currentMonthTotals = calcularTotalesMes(year, month, allCategories);
    const currentMonthBalance = round2(currentMonthTotals.income - currentMonthTotals.expenses);

    const previousDate = new Date(year, month - 1, 1);
    const previousTotals = calcularTotalesMes(previousDate.getFullYear(), previousDate.getMonth(), allCategories);
    const prevIncome = previousTotals.income;
    const prevExpenses = previousTotals.expenses;
    const prevBalance = prevIncome - prevExpenses;

    const incomeValue = document.querySelector('.summary-card.income .card-value');
    const expensesValue = document.querySelector('.summary-card.expenses .card-value');
    const balanceValue = document.querySelector('.summary-card.balance .card-value');
    const incomeChange = document.querySelector('.summary-card.income .card-change');
    const expensesChange = document.querySelector('.summary-card.expenses .card-change');
    const balanceChange = document.querySelector('.summary-card.balance .card-change');

    if (incomeValue) incomeValue.textContent = formatCurrency(totalIncome);
    if (expensesValue) expensesValue.textContent = formatCurrency(totalExpenses);
    if (balanceValue) balanceValue.textContent = formatCurrency(balance);

    const pctIncome = pctChangeText(currentMonthTotals.income, prevIncome);
    if (incomeChange) {
      if (pctIncome.pct !== 0) {
        incomeChange.textContent = `${pctIncome.sign}${pctIncome.formatted}% respecto al mes pasado`;
      } else {
        incomeChange.textContent = `0% de cambio respecto al mes pasado`;
      }
    }

    const pctExpenses = pctChangeText(currentMonthTotals.expenses, prevExpenses);
    if (expensesChange) {
      if (pctExpenses.pct !== 0) {
        expensesChange.textContent = `${pctExpenses.sign}${pctExpenses.formatted}% respecto al mes pasado`;
      } else {
        expensesChange.textContent = `0% de cambio respecto al mes pasado`;
      }
    }

    const pctBalance = pctChangeText(currentMonthBalance, prevBalance);
    if (balanceChange) {
      if (pctBalance.pct !== 0) {
        balanceChange.textContent = `${pctBalance.sign}${pctBalance.formatted}% respecto al mes pasado`;
      } else {
        balanceChange.textContent = `0% de cambio respecto al mes pasado`;
      }
    }

    const periodLabel = document.getElementById('filter-period-label');
    if (periodLabel) {
      const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const hayAnio = filtrosActuales && filtrosActuales.year !== null;
      const hayMes = filtrosActuales && filtrosActuales.month !== null;
      let txt = '';
      if (hayAnio || hayMes) {
        txt = 'Mostrando: ';
        if (hayMes) txt += meses[filtrosActuales.month];
        if (hayAnio && hayMes) txt += ' ';
        if (hayAnio) txt += filtrosActuales.year;
      }
      periodLabel.textContent = txt;
      periodLabel.classList.toggle('is-visible', !!txt);
    }
  }

  const CategoriasKPIsAPI = {
    pctChangeText,
    calcularTotalesMes,
    recomputeMonthlyDataForYear,
    calcularEstadisticasDiarias,
    actualizarUIEstadisticasDiarias,
    actualizarResumenFinanciero
  };

  if (typeof window !== 'undefined') {
    window.CategoriasKPIs = CategoriasKPIsAPI;
  }

  return CategoriasKPIsAPI;
});

