/**
 * FinanzApp - Estadistica Charts Module
 * Single Responsibility: Chart.js configuration, lifecycle, responsive rendering, and theme adaptation
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EstadisticaCharts = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let chartCashflowArea = null;
  let chartIncomeByCategory = null;
  let chartExpenseByCategory = null;
  let chartIncomeByDay = null;
  let chartSavingsGauge = null;
  let chartRadar = null;
  let chartHeatmap = null;

  function getCurrencyMeta() {
    if (typeof window !== 'undefined' && window.Core?.helpers?.getCurrencyMeta) {
      return window.Core.helpers.getCurrencyMeta();
    }
    return { locale: 'es-DO', symbol: 'RD$', currency: 'DOP' };
  }

  function getThemeColor(variableName, fallback) {
    try {
      const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
      return value?.trim() || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function colorWithAlpha(color, alpha = 1) {
    if (!color) return `rgba(255, 255, 255, ${alpha})`;
    const value = color.trim();
    if (value.startsWith('#')) {
      let hex = value.slice(1);
      if (hex.length === 3) {
        hex = hex.split('').map(ch => ch + ch).join('');
      }
      if (hex.length === 6) {
        const num = parseInt(hex, 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(',').map(part => Number(part.trim()));
      const [r = 255, g = 255, b = 255] = parts;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return value;
  }

  function aplicarConfiguracionTema() {
    if (typeof window === 'undefined' || !window.Chart) return;

    const defaults = window.Chart.defaults;
    const esTemaOscuro = window.themeManager?.currentTheme === 'dark' ||
                         localStorage.getItem('theme') === 'dark';

    defaults.color = esTemaOscuro ? '#E0E0E0' : '#333333';
    defaults.borderColor = esTemaOscuro ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    if (defaults.plugins?.legend?.labels) {
      defaults.plugins.legend.labels.color = esTemaOscuro ? '#E0E0E0' : '#333333';
    }

    defaults.font = defaults.font || {};
    defaults.font.family = "'Inter', sans-serif";
    defaults.font.size = 11;

    const escalas = defaults.scales || (defaults.scales = {});
    const grilla = escalas.grid || (escalas.grid = {});
    grilla.color = 'rgba(110, 106, 134, 0.2)';
    grilla.borderColor = 'rgba(110, 106, 134, 0.2)';
    grilla.drawBorder = true;
    grilla.drawOnChartArea = true;
    grilla.drawTicks = false;
    grilla.lineWidth = 1;
  }

  function destruirGraficos() {
    [
      chartCashflowArea,
      chartIncomeByCategory,
      chartExpenseByCategory,
      chartIncomeByDay,
      chartSavingsGauge,
      chartRadar,
      chartHeatmap
    ].forEach((instance) => {
      if (!instance) return;
      try {
        instance.destroy();
      } catch (error) {}
    });

    chartCashflowArea = chartIncomeByCategory = chartExpenseByCategory = chartIncomeByDay = chartSavingsGauge = chartRadar = chartHeatmap = null;

    const canvasIds = [
      'chartCashflowArea',
      'chartIncomeByCategory',
      'chartExpenseByCategory',
      'chartIncomeByDay',
      'chartSavingsGauge',
      'chartRadar',
      'chartHeatmap'
    ];

    canvasIds.forEach(id => {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      if (typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function') {
        try {
          const chartInstance = window.Chart.getChart(canvas);
          if (chartInstance) chartInstance.destroy();
        } catch (error) {}
      }
    });
  }

  function renderizarGraficos(tx, options = {}) {
    if (typeof window === 'undefined' || !window.Chart) {
      return;
    }

    aplicarConfiguracionTema();
    destruirGraficos();

    const appCurrency = options.appCurrency || getCurrencyMeta();
    const formatCurrencyCard = options.formatCurrency || function (amount) {
      if (window.Core?.helpers?.formatCurrency) return window.Core.helpers.formatCurrency(amount);
      return `$${Number(amount || 0).toFixed(2)}`;
    };

    const kpisModule = options.kpis || window.EstadisticaKPIs;

    const isDarkTheme = window.themeManager?.currentTheme === 'dark' ||
                        localStorage.getItem('theme') === 'dark';
    const gridColor = isDarkTheme ? '#26233a' : '#e5e5e5';
    const tickColor = isDarkTheme ? '#908caa' : '#9893a5';

    const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const MONTH_LABELS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const { inc, exp } = kpisModule.calcularMensual(tx);
    const netMonthly = inc.map((income, index) => income - exp[index]);
    const cumulativeBalance = kpisModule.calcularAcumulado(inc, exp);
    const totalIncome = inc.reduce((sum, value) => sum + value, 0);
    const totalExpenses = exp.reduce((sum, value) => sum + value, 0);
    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? savings / totalIncome : 0;

    const splits = kpisModule.calcularDivisionCategorias(tx);
    const expenseItems = splits.expenses.filter(item => item.amount > 0);
    const topExpenseCategories = expenseItems.slice(0, 8);
    const totalExpensesForPercent = expenseItems.reduce((sum, item) => sum + item.amount, 0) || 1;
    const topCategory = topExpenseCategories.length ? topExpenseCategories[0] : null;
    const topCategoryPercent = topCategory ? (topCategory.amount / totalExpensesForPercent) * 100 : 0;

    const hasNetMovement = netMonthly.some(value => Math.abs(value) > 0.01);
    const bestMonthIndex = hasNetMovement ? netMonthly.reduce((best, value, index) => (value > netMonthly[best] ? index : best), 0) : null;
    const bestMonthLabel = bestMonthIndex !== null ? MONTH_LABELS_FULL[bestMonthIndex] : null;
    const bestMonthNet = bestMonthIndex !== null ? netMonthly[bestMonthIndex] : 0;

    const expenseByDay = Array(31).fill(0);
    const incomeByDay = Array(31).fill(0);
    (tx || []).forEach(transaction => {
      const date = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
      if (Number.isNaN(date.getTime())) return;
      const dayIndex = Math.max(0, Math.min(30, date.getDate() - 1));
      if (transaction.type === 'income') {
        incomeByDay[dayIndex] += transaction.amount;
      } else if (transaction.type === 'expense') {
        expenseByDay[dayIndex] += transaction.amount;
      }
    });

    kpisModule.actualizarInsights({
      topCategory,
      topCategoryPercent,
      bestMonthLabel,
      bestMonthNet,
      savingsRate,
      savings,
      totalIncome
    }, formatCurrencyCard);

    const cashflowSummary = document.getElementById('cashflowSummary');
    if (cashflowSummary) {
      cashflowSummary.textContent = '';
      cashflowSummary.style.display = 'none';
    }

    const percentFormatter = new Intl.NumberFormat(appCurrency.locale || 'es-DO', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });

    const detailedCurrencyFormatter = new Intl.NumberFormat(appCurrency.locale || 'es-DO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const gaugeLabel = document.getElementById('savingsGaugeLabel');
    if (gaugeLabel) {
      if (totalIncome > 0) {
        gaugeLabel.textContent = percentFormatter.format(savingsRate);
        gaugeLabel.classList.toggle('negative', savings < 0);
      } else {
        gaugeLabel.textContent = 'Sin datos';
        gaugeLabel.classList.remove('negative');
      }
    }

    const getCtx = id => {
      const canvas = document.getElementById(id);
      if (!canvas) return null;
      if (typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function') {
        try {
          const existing = window.Chart.getChart(canvas);
          if (existing) existing.destroy();
        } catch (e) {}
      }
      return canvas.getContext('2d');
    };

    const successBase = getThemeColor('--success', '#2D957B');
    const dangerBase = isDarkTheme ? getThemeColor('--danger', '#eb6f92') : '#b4637a';
    const fillOpacity = isDarkTheme ? 0.25 : 0.20;
    const successFill = colorWithAlpha(successBase, fillOpacity);
    const successSolid = colorWithAlpha(successBase, 0.95);
    const successLine = colorWithAlpha(successBase, 1);
    const dangerFill = colorWithAlpha(dangerBase, fillOpacity);
    const dangerSolid = colorWithAlpha(dangerBase, 0.95);
    const dangerLine = colorWithAlpha(dangerBase, 1);

    const baseLegend = {
      labels: {
        font: {
          family: 'Inter, sans-serif',
          size: 12,
          weight: '600'
        },
        color: tickColor,
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 12
      }
    };

    const baseTooltip = {
      backgroundColor: isDarkTheme ? '#232136' : '#FFFAF3',
      titleColor: isDarkTheme ? '#FFFAF3' : '#575279',
      bodyColor: isDarkTheme ? '#FFFAF3' : '#575279',
      borderColor: isDarkTheme ? '#EB6F92' : '#B4637A',
      borderWidth: 2,
      padding: 12,
      cornerRadius: 12,
      titleFont: {
        family: 'Inter, sans-serif',
        size: 13,
        weight: '700'
      },
      bodyFont: {
        family: 'Inter, sans-serif',
        size: 12
      },
      displayColors: false
    };

    const legendMarginPlugin = {
      id: 'legendMargin',
      beforeInit(chart) {
        const originalFit = chart.legend.fit;
        chart.legend.fit = function () {
          originalFit.call(this);
          this.height += 18;
        };
      }
    };

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 14,
          right: 18,
          top: 6,
          bottom: 6
        }
      },
      animation: {
        duration: 900,
        easing: 'easeInOutQuart'
      },
      plugins: {
        legend: baseLegend,
        tooltip: { ...baseTooltip }
      }
    };

    // 1. Cashflow Area Chart
    const cashflowCtx = getCtx('chartCashflowArea');
    if (cashflowCtx) {
      try {
        chartCashflowArea = new Chart(cashflowCtx, {
          type: 'line',
          plugins: [legendMarginPlugin],
          data: {
            labels: MONTH_LABELS,
            datasets: [
              {
                label: 'Ingresos',
                data: inc,
                backgroundColor: successFill,
                borderColor: successLine,
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: successLine,
                pointBorderColor: successLine,
                pointBorderWidth: 2
              },
              {
                label: 'Gastos',
                data: exp,
                backgroundColor: dangerFill,
                borderColor: dangerLine,
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: dangerLine,
                pointBorderColor: dangerLine,
                pointBorderWidth: 2
              },
              {
                label: 'Balance neto',
                data: netMonthly,
                borderColor: isDarkTheme ? '#c4a7e7' : '#9c6bd7',
                borderWidth: 3,
                fill: false,
                tension: 0.35,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: isDarkTheme ? '#c4a7e7' : '#9c6bd7',
                pointBorderColor: isDarkTheme ? '#c4a7e7' : '#9c6bd7',
                borderDash: [8, 4]
              }
            ]
          },
          options: {
            ...baseOptions,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              ...baseOptions.plugins,
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  title: context => {
                    const idx = context[0]?.dataIndex ?? 0;
                    return MONTH_LABELS_FULL[idx] || '';
                  },
                  label: context => {
                    const label = context.dataset.label || '';
                    const value = context.parsed.y || 0;
                    return `${label}: ${formatCurrencyCard(value)}`;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: tickColor,
                  font: { family: 'Inter, sans-serif', size: 12, weight: '500' }
                }
              },
              y: {
                beginAtZero: true,
                grid: { color: gridColor, drawBorder: false },
                ticks: {
                  color: tickColor,
                  font: { size: 11 },
                  callback: value => `${appCurrency.symbol}${Intl.NumberFormat('es-DO', { notation: 'compact', compactDisplay: 'short' }).format(value)}`
                }
              }
            }
          }
        });
      } catch (error) {}
    }

    // 2. Income by Category Chart
    const incomeCtx = getCtx('chartIncomeByCategory');
    if (incomeCtx) {
      try {
        const incomeByCat = new Map();
        (tx || []).forEach(t => {
          if (t.type === 'income') {
            const current = incomeByCat.get(t.category) || 0;
            incomeByCat.set(t.category, current + t.amount);
          }
        });

        const incomeCategories = Array.from(incomeByCat.entries())
          .map(([name, amount]) => ({ name, amount }))
          .filter(cat => cat.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);

        const incomeLabels = incomeCategories.length ? incomeCategories.map(cat => cat.name) : ['Sin datos'];
        const incomeData = incomeCategories.length ? incomeCategories.map(cat => cat.amount) : [0];
        const totalIncomeChart = incomeData.reduce((sum, val) => sum + val, 0);
        const incomePercentages = incomeCategories.length
          ? incomeCategories.map(cat => totalIncomeChart > 0 ? (cat.amount / totalIncomeChart) * 100 : 0)
          : [0];

        chartIncomeByCategory = new Chart(incomeCtx, {
          type: 'bar',
          data: {
            labels: incomeLabels,
            datasets: [{
              label: 'Ingreso total',
              data: incomeData,
              backgroundColor: successSolid,
              borderColor: successLine,
              hoverBackgroundColor: successLine,
              borderRadius: 6,
              borderSkipped: 'start',
              minBarLength: 4,
              barPercentage: 0.65,
              categoryPercentage: 0.75,
              barThickness: 16,
              maxBarThickness: 16
            }]
          },
          options: {
            ...baseOptions,
            indexAxis: 'y',
            plugins: {
              ...baseOptions.plugins,
              legend: { display: false },
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  label: context => {
                    const amount = context.parsed.x || 0;
                    const percent = incomePercentages[context.dataIndex] || 0;
                    return [
                      `Monto: ${formatCurrencyCard(amount)}`,
                      `Participación: ${percent.toFixed(1)}%`
                    ];
                  }
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: gridColor, drawBorder: false },
                ticks: {
                  color: '#9893a5',
                  font: { size: 11 },
                  callback: value => `${appCurrency.symbol}${Intl.NumberFormat('es-DO', { notation: 'compact', compactDisplay: 'short' }).format(value)}`
                }
              },
              y: {
                grid: { display: false },
                ticks: {
                  color: '#9893a5',
                  font: { family: 'Inter, sans-serif', size: 12, weight: '500' },
                  align: 'center',
                  crossAlign: 'far',
                  padding: 18
                }
              }
            }
          }
        });
      } catch (error) {}
    }

    // 3. Expense by Category Chart
    const expenseCtx = getCtx('chartExpenseByCategory');
    if (expenseCtx) {
      try {
        const expenseByCat = new Map();
        (tx || []).forEach(t => {
          if (t.type === 'expense') {
            const current = expenseByCat.get(t.category) || 0;
            expenseByCat.set(t.category, current + t.amount);
          }
        });

        const expenseCategories = Array.from(expenseByCat.entries())
          .map(([name, amount]) => ({ name, amount }))
          .filter(cat => cat.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);

        const expenseLabels = expenseCategories.length ? expenseCategories.map(cat => cat.name) : ['Sin datos'];
        const expenseData = expenseCategories.length ? expenseCategories.map(cat => cat.amount) : [0];
        const totalExpenses = expenseData.reduce((sum, val) => sum + val, 0);
        const expensePercentages = expenseCategories.length
          ? expenseCategories.map(cat => totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0)
          : [0];

        chartExpenseByCategory = new Chart(expenseCtx, {
          type: 'bar',
          data: {
            labels: expenseLabels,
            datasets: [{
              label: 'Gasto total',
              data: expenseData,
              backgroundColor: dangerSolid,
              borderColor: dangerLine,
              hoverBackgroundColor: dangerLine,
              borderRadius: 6,
              borderSkipped: 'start',
              minBarLength: 4,
              barPercentage: 0.65,
              categoryPercentage: 0.75,
              barThickness: 16,
              maxBarThickness: 16
            }]
          },
          options: {
            ...baseOptions,
            indexAxis: 'y',
            plugins: {
              ...baseOptions.plugins,
              legend: { display: false },
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  label: context => {
                    const amount = context.parsed.x || 0;
                    const percent = expensePercentages[context.dataIndex] || 0;
                    return [
                      `Monto: ${formatCurrencyCard(amount)}`,
                      `Participación: ${percent.toFixed(1)}%`
                    ];
                  }
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: gridColor, drawBorder: false },
                ticks: {
                  color: '#9893a5',
                  font: { size: 11 },
                  callback: value => `${appCurrency.symbol}${Intl.NumberFormat('es-DO', { notation: 'compact', compactDisplay: 'short' }).format(value)}`
                }
              },
              y: {
                grid: { display: false },
                ticks: {
                  color: '#9893a5',
                  font: { family: 'Inter, sans-serif', size: 12, weight: '500' },
                  align: 'center',
                  crossAlign: 'far',
                  padding: 18
                }
              }
            }
          }
        });
      } catch (error) {}
    }

    // 4. Income by Day Chart
    const incomeByDayCtx = getCtx('chartIncomeByDay');
    if (incomeByDayCtx) {
      try {
        const dayLabels = Array.from({ length: 31 }, (_, index) => String(index + 1));
        const maxIncome = Math.max(...incomeByDay, 0);
        const greenBase = isDarkTheme ? '#46a987' : '#2D957B';
        const colors = incomeByDay.map(value => {
          if (!maxIncome) return 'rgba(148, 163, 184, 0.25)';
          const intensity = value / maxIncome;
          return colorWithAlpha(greenBase, 0.25 + intensity * 0.70);
        });

        chartIncomeByDay = new Chart(incomeByDayCtx, {
          type: 'bar',
          data: {
            labels: dayLabels,
            datasets: [{
              label: 'Ingreso por día del mes',
              data: incomeByDay,
              backgroundColor: colors,
              borderRadius: 3,
              borderWidth: 0,
              barPercentage: 0.9,
              categoryPercentage: 0.95
            }]
          },
          options: {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              legend: { display: false },
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  title: context => `Día ${context[0].label}`,
                  label: context => `${appCurrency.symbol}${detailedCurrencyFormatter.format(context.parsed.y || 0)}`
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: 'rgba(100, 116, 139, 0.75)',
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 10
                }
              },
              y: {
                beginAtZero: true,
                grid: { display: false },
                ticks: { display: false }
              }
            }
          }
        });
      } catch (error) {}
    }

    // 5. Expense by Day (Heatmap) Chart
    const heatmapCtx = getCtx('chartHeatmap');
    if (heatmapCtx) {
      try {
        const heatmapLabels = Array.from({ length: 31 }, (_, index) => String(index + 1));
        const maxExpense = Math.max(...expenseByDay, 0);
        const pinkBase = isDarkTheme ? '#EB6F92' : '#B4637A';
        const colors = expenseByDay.map(value => {
          if (!maxExpense) return 'rgba(148, 163, 184, 0.25)';
          const intensity = value / maxExpense;
          return colorWithAlpha(pinkBase, 0.25 + intensity * 0.70);
        });

        chartHeatmap = new Chart(heatmapCtx, {
          type: 'bar',
          data: {
            labels: heatmapLabels,
            datasets: [{
              label: 'Gasto por día del mes',
              data: expenseByDay,
              backgroundColor: colors,
              borderRadius: 3,
              borderWidth: 0,
              barPercentage: 0.9,
              categoryPercentage: 0.95
            }]
          },
          options: {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              legend: { display: false },
              tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                  title: context => `Día ${context[0].label}`,
                  label: context => `${appCurrency.symbol}${detailedCurrencyFormatter.format(context.parsed.y || 0)}`
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: 'rgba(100, 116, 139, 0.75)',
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 10
                }
              },
              y: {
                beginAtZero: true,
                grid: { display: false },
                ticks: { display: false }
              }
            }
          }
        });
      } catch (error) {}
    }
  }

  return {
    destruirGraficos,
    aplicarConfiguracionTema,
    renderizarGraficos,
    getThemeColor,
    colorWithAlpha
  };
});

