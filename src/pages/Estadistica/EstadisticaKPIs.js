/**
 * FinanzApp - Estadistica KPIs & Analytics Calculations
 * Single Responsibility: Calculate monthly aggregations, category breakdowns, daily stats, and render insight cards
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EstadisticaKPIs = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function defaultFormatCurrency(amount) {
    if (typeof window !== 'undefined' && window.Core?.helpers?.formatCurrency) {
      return window.Core.helpers.formatCurrency(amount);
    }
    const n = Number(amount) || 0;
    return `$${n.toFixed(2)}`;
  }

  const percentFormatter = new Intl.NumberFormat('es-DO', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  function calcularMensual(tx) {
    const inc = Array(12).fill(0);
    const exp = Array(12).fill(0);
    (tx || []).forEach(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const m = d.getMonth();
      if (t.type === 'income') inc[m] += t.amount;
      else if (t.type === 'expense') exp[m] += t.amount;
    });
    return { inc, exp };
  }

  function calcularAcumulado(inc, exp) {
    const cum = [];
    let s = 0;
    for (let i = 0; i < 12; i++) {
      s += ((inc[i] || 0) - (exp[i] || 0));
      cum.push(s);
    }
    return cum;
  }

  function calcularDivisionCategorias(tx) {
    const mapExp = new Map();
    const mapInc = new Map();
    (tx || []).forEach(t => {
      const map = t.type === 'income' ? mapInc : mapExp;
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    });
    const toArr = m => Array.from(m.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { expenses: toArr(mapExp), income: toArr(mapInc) };
  }

  function calcularEstadisticasDiarias(allTx) {
    const today = new Date();
    const start30 = new Date();
    start30.setDate(today.getDate() - 29);

    let incomeToday = 0;
    let expensesToday = 0;
    const netByDate = new Map();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start30);
      d.setDate(start30.getDate() + i);
      netByDate.set(d.toISOString().slice(0, 10), 0);
    }

    (allTx || []).forEach(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const key = d.toISOString().slice(0, 10);

      if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) {
        if (t.type === 'income') incomeToday += t.amount;
        else if (t.type === 'expense') expensesToday += t.amount;
      }

      if (d >= start30 && d <= today) {
        const delta = t.type === 'income' ? t.amount : -t.amount;
        netByDate.set(key, (netByDate.get(key) || 0) + delta);
      }
    });

    let sum = 0;
    let count = 0;
    netByDate.forEach(v => { sum += v; count++; });
    const avgDaily = count ? (sum / count) : 0;
    return { incomeToday, expensesToday, avgDaily };
  }

  function renderizarResumen(tx, fmt) {
    const formatCurrency = fmt || defaultFormatCurrency;
    document.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));

    let inc = 0;
    let exp = 0;
    (tx || []).forEach(t => {
      if (t.type === 'income') inc += t.amount;
      else if (t.type === 'expense') exp += t.amount;
    });
    const bal = inc - exp;
    const monthsCovered = (function () {
      const set = new Set((tx || []).map(t => (t.date instanceof Date ? t.date : new Date(t.date)).getMonth()));
      return Math.max(1, set.size);
    })();
    const el = id => document.getElementById(id);

    const animateValue = (element, value) => {
      if (element) {
        element.style.opacity = '0';
        setTimeout(() => {
          element.textContent = value;
          element.style.opacity = '1';
        }, 150);
      }
    };

    animateValue(el('sumIncome'), formatCurrency(inc));
    animateValue(el('sumExpenses'), formatCurrency(exp));
    animateValue(el('sumBalance'), formatCurrency(bal));

    const setLabeledValue = (id, defaultLabel, amount) => {
      const node = el(id);
      if (!node) return;
      const label = (node.getAttribute('data-label') || (node.textContent.split(':')[0] || defaultLabel)).trim();
      node.setAttribute('data-label', label);
      node.style.opacity = '0';
      setTimeout(() => {
        node.textContent = `${label}: ${formatCurrency(amount)}`;
        node.style.opacity = '1';
      }, 150);
    };

    setLabeledValue('avgIncome', 'Promedio mensual', inc / monthsCovered);
    setLabeledValue('avgExpenses', 'Promedio mensual', exp / monthsCovered);
    setLabeledValue('avgBalance', 'Promedio mensual', bal / monthsCovered);

    animateValue(el('txCount'), String((tx || []).length));
    const ticket = (tx || []).length ? (inc + exp) / tx.length : 0;
    setLabeledValue('avgTicket', 'Ticket promedio', ticket);
  }

  function renderizarKPIsDiarios(allTx, fmt) {
    const formatCurrency = fmt || defaultFormatCurrency;
    const { incomeToday, expensesToday, avgDaily } = calcularEstadisticasDiarias(allTx);
    const el = id => document.getElementById(id);
    if (el('dailyIncome')) el('dailyIncome').textContent = formatCurrency(incomeToday);
    if (el('dailyExpenses')) el('dailyExpenses').textContent = formatCurrency(expensesToday);
    if (el('dailyAverage')) el('dailyAverage').textContent = formatCurrency(avgDaily);
  }

  function actualizarInsights(info, fmt) {
    const formatCurrency = fmt || defaultFormatCurrency;
    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };

    const {
      topCategory,
      topCategoryPercent = 0,
      bestMonthLabel,
      bestMonthNet = 0,
      savingsRate = 0,
      savings = 0,
      totalIncome = 0
    } = info || {};

    if (topCategory) {
      setText('insightTopCategoryValue', formatCurrency(topCategory.amount));
      setText('insightTopCategoryDetail', `${topCategory.name} · ${topCategoryPercent.toFixed(1)}% del gasto`);
    } else {
      setText('insightTopCategoryValue', 'Sin datos');
      setText('insightTopCategoryDetail', 'Aún no hay gastos registrados en este periodo.');
    }

    if (bestMonthLabel) {
      const balanceLabel = `${bestMonthNet >= 0 ? '+' : '− '}${formatCurrency(Math.abs(bestMonthNet))}`;
      setText('insightBestMonthValue', bestMonthLabel);
      setText('insightBestMonthDetail', `Balance neto: ${balanceLabel}`);
    } else {
      setText('insightBestMonthValue', 'Sin datos');
      setText('insightBestMonthDetail', 'Agrega movimientos para conocer tu mejor mes.');
    }

    if (totalIncome > 0) {
      const savingsPercent = percentFormatter.format(savingsRate);
      const savingsLabel = savings >= 0
        ? `Reservaste ${formatCurrency(savings)} de tus ingresos.`
        : `Déficit de ${formatCurrency(Math.abs(savings))}.`;
      setText('insightSavingsValue', savingsPercent);
      setText('insightSavingsDetail', savingsLabel);
    } else {
      setText('insightSavingsValue', 'Sin datos');
      setText('insightSavingsDetail', 'Registra ingresos para calcular tu balance neto.');
    }
  }

  return {
    calcularMensual,
    calcularAcumulado,
    calcularDivisionCategorias,
    calcularEstadisticasDiarias,
    renderizarResumen,
    renderizarKPIsDiarios,
    actualizarInsights
  };
});

