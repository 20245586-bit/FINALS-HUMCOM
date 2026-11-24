(() => {
  'use strict';

  const STORAGE_KEY = 'budget_buddy_data_v1';

  const CURRENCIES = [
    { code: 'PHP', symbol: '₱', label: 'PHP (₱) - Philippine Peso' },
    { code: 'USD', symbol: '$', label: 'USD ($) - US Dollar' },
    { code: 'EUR', symbol: '€', label: 'EUR (€) - Euro' },
    { code: 'GBP', symbol: '£', label: 'GBP (£) - British Pound' },
    { code: 'JPY', symbol: '¥', label: 'JPY (¥) - Japanese Yen' },
    { code: 'KRW', symbol: '₩', label: 'KRW (₩) - South Korean Won' },
    { code: 'SGD', symbol: 'S$', label: 'SGD (S$) - Singapore Dollar' },
    { code: 'AUD', symbol: 'A$', label: 'AUD (A$) - Australian Dollar' },
    { code: 'CAD', symbol: 'C$', label: 'CAD (C$) - Canadian Dollar' }
  ];

  const DEFAULT_CATS = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Fun', 'Savings', 'Salary', 'Other'];

  const PALETTE = ['#0f766e', '#f2b705', '#c2410c', '#1d4ed8', '#15803d', '#9333ea', '#db2777', '#0284c7', '#65a30d', '#64748b'];

  const MOODS = [
    {
      id: 'great',
      label: 'Doing great',
      title: 'Keep your momentum going!',
      tips: [
        'Move a small part of your extra money into a savings goal today.',
        'Lock in a couple more no-spend days this week to finish even stronger.',
        'Review any subscriptions you barely use so leaks do not creep in.'
      ]
    },
    {
      id: 'tight',
      label: 'A bit tight',
      title: 'Simple ways to stretch your budget',
      tips: [
        'Stick strictly to your daily allowance for the next 3 days.',
        'Pause non-essential "Shopping" or "Fun" buys until next week.',
        'Prep meals or coffee at home for a few days—small daily savings add up fast.'
      ]
    },
    {
      id: 'over',
      label: 'Overspent',
      title: 'Do not panic—reset from today',
      tips: [
        'Look at your top spending category in the donut chart to spot the main leak.',
        'Aim for 2 no-spend days in a row to pull your daily average back down.',
        'Use only cash or set a strict daily cap for the remaining days of the month.'
      ]
    },
    {
      id: 'saving',
      label: 'Saving up',
      title: 'Hit your savings goal faster',
      tips: [
        'Pay yourself first: log your savings deposit on payday before spending.',
        'Sell or clear out unused items and put the gained cash straight to a goal.',
        'Break big targets into small weekly milestones.'
      ]
    }
  ];

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');

  function getTodayParts() {
    const now = new Date();
    return {
      ym: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
      day: now.getDate(),
      iso: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    };
  }

  function prevMonthYM(ym) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  function daysInMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  function weekdayShort(ym, day) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short' });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- State ----------
  function defaultState() {
    return {
      settings: {
        currency: 'PHP',
        theme: 'auto',
        remind: true,
        categories: [...DEFAULT_CATS]
      },
      months: {},
      goals: [],
      recurring: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        settings: {
          currency: parsed?.settings?.currency || 'PHP',
          theme: parsed?.settings?.theme || 'auto',
          remind: parsed?.settings?.remind ?? true,
          categories: Array.isArray(parsed?.settings?.categories) && parsed.settings.categories.length
            ? parsed.settings.categories
            : [...DEFAULT_CATS]
        },
        months: parsed?.months && typeof parsed.months === 'object' ? parsed.months : {},
        goals: Array.isArray(parsed?.goals) ? parsed.goals : [],
        recurring: Array.isArray(parsed?.recurring) ? parsed.recurring : []
      };
    } catch {
      return defaultState();
    }
  }

  let state = loadState();
  let currentYM = getTodayParts().ym;
  let activeMood = 'great';
  let activeModalDay = null;
  let lastClearedSnapshot = null;
  let undoTimer = null;

  function ensureMonth(ym) {
    if (!state.months[ym]) {
      state.months[ym] = { start: 0, limit: 0, days: {} };
    }
    return state.months[ym];
  }

  function getDay(ym, day) {
    const m = ensureMonth(ym);
    const key = String(day);
    if (!m.days[key]) {
      m.days[key] = { gained: 0, spent: 0, category: '', note: '', items: [] };
    }
    if (!Array.isArray(m.days[key].items)) m.days[key].items = [];
    return m.days[key];
  }

  function syncDayFromItems(dayObj) {
    if (!dayObj.items.length) return;
    let g = 0, s = 0;
    const notes = [];
    const catTotals = {};
    dayObj.items.forEach((it) => {
      const amt = Number(it.amount) || 0;
      if (it.type === 'in') g += amt;
      else {
        s += amt;
        const c = it.category || 'Other';
        catTotals[c] = (catTotals[c] || 0) + amt;
      }
      if (it.note) notes.push(it.note);
    });
    dayObj.gained = Math.round(g * 100) / 100;
    dayObj.spent = Math.round(s * 100) / 100;
    dayObj.note = notes.join(', ').slice(0, 80);
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    dayObj.category = topCat ? topCat[0] : (dayObj.items[0]?.category || '');
  }

  let saveFadeTimer;
  function saveState(msg = 'Saved') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const el = $('#saveMsg');
    if (el) {
      el.textContent = msg;
      clearTimeout(saveFadeTimer);
      saveFadeTimer = setTimeout(() => { el.textContent = ''; }, 2000);
    }
  }

  // ---------- Currency formatting ----------
  function getCurrency() {
    return CURRENCIES.find((c) => c.code === state.settings.currency) || CURRENCIES[0];
  }

  function money(val) {
    const n = Number(val) || 0;
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString(undefined, {
      minimumFractionDigits: abs % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    });
    return `${sign}${getCurrency().symbol}${formatted}`;
  }

  function refreshCurrencyUI() {
    const cur = getCurrency();
    $('#coinSymbol').textContent = cur.symbol;
    document.querySelectorAll('[data-money]').forEach((el) => {
      el.textContent = money(el.dataset.money);
    });
  }

  // ---------- Theme & Navigation ----------
  function applyTheme() {
    const t = state.settings.theme;
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');

    const label = t === 'auto' ? 'Auto' : t[0].toUpperCase() + t.slice(1);
    $('#themeBtn').textContent = `Theme: ${label}`;
    $('#themeSelect').value = t;
  }

  function applyView() {
    const view = location.hash === '#log' ? 'log' : 'home';
    document.body.dataset.view = view;
    document.querySelectorAll('nav a[data-nav]').forEach((a) => {
      if (a.dataset.nav === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  // ---------- Populate dropdowns ----------
  function populateSelects() {
    const curSel = $('#currency');
    curSel.innerHTML = CURRENCIES.map((c) => `<option value="${c.code}">${esc(c.label)}</option>`).join('');
    curSel.value = state.settings.currency;

    const cats = state.settings.categories;
    const catOptions = cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('#qa-cat').innerHTML = catOptions;
    $('#rec-cat').innerHTML = catOptions;
    $('#m-cat').innerHTML = catOptions;

    const prevFilter = $('#logCatFilter').value;
    $('#logCatFilter').innerHTML = `<option value="">All categories</option>` + catOptions;
    if (cats.includes(prevFilter)) $('#logCatFilter').value = prevFilter;

    // Custom category chips
    $('#catChips').innerHTML = cats.map((c) => `
      <span class="cat-chip">
        ${esc(c)}
        ${cats.length > 1 ? `<button type="button" data-del-cat="${esc(c)}" aria-label="Remove ${esc(c)}">&times;</button>` : ''}
      </span>
    `).join('');
  }

  // ---------- Calculations & Render ----------
  function monthTotals(ym) {
    const m = ensureMonth(ym);
    const totalDays = daysInMonth(ym);
    let gained = 0, spent = 0;
    const catTotals = {};

    for (let d = 1; d <= totalDays; d++) {
      const dayObj = m.days[String(d)];
      if (!dayObj) continue;
      gained += Number(dayObj.gained) || 0;
      spent += Number(dayObj.spent) || 0;
      if (dayObj.items && dayObj.items.length) {
        dayObj.items.forEach((it) => {
          if (it.type !== 'in') {
            const c = it.category || 'Other';
            catTotals[c] = (catTotals[c] || 0) + (Number(it.amount) || 0);
          }
        });
      } else if (Number(dayObj.spent) > 0) {
        const c = dayObj.category || 'Other';
        catTotals[c] = (catTotals[c] || 0) + Number(dayObj.spent);
      }
    }

    const start = Number(m.start) || 0;
    const limit = Number(m.limit) || 0;
    const left = start + gained - spent;
    const budgetLeft = limit > 0 ? limit - spent : null;
    const dailyAllowance = limit > 0 ? limit / totalDays : 0;
    return { gained, spent, start, limit, left, budgetLeft, dailyAllowance, totalDays, catTotals };
  }

  function renderAll() {
    refreshCurrencyUI();
    populateSelects();

    const m = ensureMonth(currentYM);
    const stats = monthTotals(currentYM);
    const today = getTodayParts();
    const isCurrentRealMonth = currentYM === today.ym;

    // Quick add date label
    $('#qa-date').textContent = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    // Setup inputs
    $('#month').value = currentYM;
    $('#start').value = m.start || '';
    $('#limit').value = m.limit || '';
    $('#daily').textContent = stats.limit > 0 ? `${money(stats.dailyAllowance)} / day` : 'Set a limit';

    // Carry over & month comparison
    const prevYM = prevMonthYM(currentYM);
    const hasPrev = Boolean(state.months[prevYM]);
    $('#carryOverBtn').disabled = !hasPrev;
    if (hasPrev) {
      const prevStats = monthTotals(prevYM);
      const diff = stats.spent - prevStats.spent;
      if (prevStats.spent > 0) {
        const pct = Math.round((Math.abs(diff) / prevStats.spent) * 100);
        $('#compareMsg').textContent = diff <= 0
          ? `You've spent ${pct}% less than last month (${money(prevStats.spent)}).`
          : `You've spent ${pct}% more than last month (${money(prevStats.spent)}).`;
      } else {
        $('#compareMsg').textContent = `Last month remaining balance: ${money(prevStats.left)}`;
      }
    } else {
      $('#compareMsg').textContent = '';
    }

    // Summary stats
    $('#st-g').textContent = money(stats.gained);
    $('#st-s').textContent = money(stats.spent);
    const leftEl = $('#st-left');
    leftEl.textContent = money(stats.left);
    leftEl.classList.toggle('neg', stats.left < 0);

    const bEl = $('#st-budget');
    if (stats.budgetLeft === null) {
      bEl.textContent = '-';
      bEl.classList.remove('neg');
    } else {
      bEl.textContent = money(stats.budgetLeft);
      bEl.classList.toggle('neg', stats.budgetLeft < 0);
    }

    // Progress bar
    const fill = $('#barFill');
    const prog = $('#progress');
    if (stats.limit > 0) {
      const pct = Math.round((stats.spent / stats.limit) * 100);
      const barPct = Math.min(100, Math.max(0, pct));
      fill.style.width = `${barPct}%`;
      fill.className = pct > 100 ? 'over' : pct >= 80 ? 'warn' : '';
      prog.setAttribute('aria-valuenow', String(barPct));
      $('#barMsg').textContent = pct <= 100
        ? `${pct}% of your ${money(stats.limit)} spending limit used.`
        : `Over budget by ${money(stats.spent - stats.limit)} (${pct}% used).`;
    } else {
      fill.style.width = '0%';
      fill.className = '';
      prog.setAttribute('aria-valuenow', '0');
      $('#barMsg').textContent = 'Set a spending limit to track your budget.';
    }

    // Reminders
    const todayObj = getDay(today.ym, today.day);
    const loggedToday = (Number(todayObj.gained) > 0 || Number(todayObj.spent) > 0 || Boolean(todayObj.note));
    const showRemind = state.settings.remind && !loggedToday;
    $('#homeReminder').hidden = !showRemind;
    $('#reminder').hidden = !(showRemind && isCurrentRealMonth);
    $('#remindCheck').checked = state.settings.remind;

    // No-spend days count (past days + today if logged? Count past days in month with 0 spent)
    const maxCheckDay = isCurrentRealMonth ? Math.max(0, today.day - 1) : (currentYM < today.ym ? stats.totalDays : 0);
    let noSpendCount = 0;
    for (let d = 1; d <= maxCheckDay; d++) {
      const dayObj = m.days[String(d)];
      if (!dayObj || Number(dayObj.spent) === 0) noSpendCount++;
    }
    const badge = $('#noSpendBadge');
    badge.hidden = maxCheckDay === 0;
    badge.textContent = `${noSpendCount} no-spend ${noSpendCount === 1 ? 'day' : 'days'}`;

    renderTable(stats, isCurrentRealMonth, today.day, maxCheckDay);
    renderDonut(stats);
    renderChart(stats);
    renderInsights(stats, noSpendCount, maxCheckDay, isCurrentRealMonth, today.day);
    renderMoods();
    renderRecurring();
    renderGoals();
  }

  function renderTable(stats, isCurrentRealMonth, todayDay, maxCheckDay) {
    const m = ensureMonth(currentYM);
    const search = $('#logSearch').value.trim().toLowerCase();
    const catFilter = $('#logCatFilter').value;
    const hideEmpty = $('#hideEmpty').checked;

    const cats = state.settings.categories;
    let running = stats.start;
    let wkG = 0, wkS = 0;
    const rows = [];

    for (let d = 1; d <= stats.totalDays; d++) {
      const dayObj = getDay(currentYM, d);
      const g = Number(dayObj.gained) || 0;
      const s = Number(dayObj.spent) || 0;
      running += g - s;
      wkG += g;
      wkS += s;

      const hasItems = dayObj.items.length > 0;
      const isEmpty = g === 0 && s === 0 && !dayObj.note && !hasItems;
      const matchesSearch = !search || (dayObj.note || '').toLowerCase().includes(search) ||
        dayObj.items.some((it) => (it.note || '').toLowerCase().includes(search));
      const matchesCat = !catFilter || dayObj.category === catFilter ||
        dayObj.items.some((it) => it.category === catFilter);

      const showRow = (!hideEmpty || !isEmpty) && matchesSearch && matchesCat;

      if (showRow) {
        const classes = [];
        if (isCurrentRealMonth && d === todayDay) classes.push('today');
        if (d <= maxCheckDay && s === 0) classes.push('nospend');

        const isOverDaily = stats.dailyAllowance > 0 && s > stats.dailyAllowance;
        const catOptions = `<option value="">--</option>` + cats.map((c) =>
          `<option value="${esc(c)}"${dayObj.category === c ? ' selected' : ''}>${esc(c)}</option>`
        ).join('');

        rows.push(`
          <tr class="${classes.join(' ')}" data-day="${d}">
            <td class="day">
              <b>${d}</b>
              <small>${weekdayShort(currentYM, d)}</small>
              <button type="button" class="day-items-btn ${hasItems ? 'has' : ''}" data-open-day="${d}">
                ${hasItems ? `${dayObj.items.length} items` : '+ Items'}
              </button>
            </td>
            <td data-label="Gained">
              <input type="number" min="0" step="any" data-field="gained" value="${g || ''}" placeholder="0" ${hasItems ? 'readonly title="Edit via Items button"' : ''}>
            </td>
            <td data-label="Spent">
              <input type="number" min="0" step="any" data-field="spent" class="${isOverDaily ? 'over' : ''}" value="${s || ''}" placeholder="0" ${hasItems ? 'readonly title="Edit via Items button"' : ''}>
            </td>
            <td class="cat" data-label="Category">
              <select data-field="category" ${hasItems ? 'disabled title="Managed by day items"' : ''}>${catOptions}</select>
            </td>
            <td class="note" data-label="Note">
              <input type="text" maxlength="80" data-field="note" value="${esc(dayObj.note || '')}" placeholder="Note" ${hasItems ? 'readonly title="Edit via Items button"' : ''}>
            </td>
            <td class="bal ${running < 0 ? 'neg' : ''}" data-label="Balance">${money(running)}</td>
          </tr>
        `);
      }

      if ((d % 7 === 0 || d === stats.totalDays) && !search && !catFilter) {
        const wkNum = Math.ceil(d / 7);
        const net = wkG - wkS;
        rows.push(`
          <tr class="week">
            <td class="day"><b>Wk ${wkNum}</b></td>
            <td data-label="Gained">${money(wkG)}</td>
            <td data-label="Spent">${money(wkS)}</td>
            <td class="cat"></td>
            <td class="note"></td>
            <td class="wk-net ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${money(net)}</td>
          </tr>
        `);
        wkG = 0;
        wkS = 0;
      }
    }

    $('#logBody').innerHTML = rows.length
      ? rows.join('')
      : `<tr><td colspan="6" class="muted" style="text-align:center;padding:1rem;">No matching days found.</td></tr>`;
  }

  function renderDonut(stats) {
    $('#donutTotal').textContent = money(stats.spent);
    const entries = Object.entries(stats.catTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    if (!entries.length || stats.spent <= 0) {
      $('#donut').style.background = 'var(--line)';
      $('#legend').innerHTML = `<li class="muted">No spending logged this month yet.</li>`;
      return;
    }

    let deg = 0;
    const stops = [];
    const legHtml = [];

    entries.forEach(([cat, val], i) => {
      const color = PALETTE[i % PALETTE.length];
      const slice = (val / stats.spent) * 360;
      const pct = Math.round((val / stats.spent) * 100);
      stops.push(`${color} ${deg.toFixed(2)}deg ${(deg + slice).toFixed(2)}deg`);
      deg += slice;
      legHtml.push(`
        <li>
          <span class="leg-l"><span class="swatch" style="background:${color}"></span>${esc(cat)}</span>
          <span class="leg-r">${money(val)} (${pct}%)</span>
        </li>
      `);
    });

    $('#donut').style.background = `conic-gradient(${stops.join(', ')})`;
    $('#legend').innerHTML = legHtml.join('');
  }

  function renderChart(stats) {
    const m = ensureMonth(currentYM);
    const vals = [];
    let maxVal = stats.dailyAllowance || 0;
    for (let d = 1; d <= stats.totalDays; d++) {
      const s = Number(m.days[String(d)]?.spent) || 0;
      vals.push(s);
      if (s > maxVal) maxVal = s;
    }
    if (maxVal <= 0) maxVal = 1;

    $('#chart').innerHTML = vals.map((v, idx) => {
      const d = idx + 1;
      const h = v > 0 ? Math.max(4, Math.round((v / maxVal) * 100)) : 0;
      const over = stats.dailyAllowance > 0 && v > stats.dailyAllowance;
      const showLbl = d === 1 || d % 5 === 0 || d === stats.totalDays;
      return `
        <div class="col" data-tip="Day ${d}: ${money(v)}">
          <div class="barv ${over ? 'over' : ''}" style="height:${h}%"></div>
          <span>${showLbl ? d : ''}</span>
        </div>
      `;
    }).join('');
  }

  function renderInsights(stats, noSpendCount, maxCheckDay, isCurrentRealMonth, todayDay) {
    const list = [];

    if (stats.limit > 0) {
      const remDays = isCurrentRealMonth ? Math.max(1, stats.totalDays - todayDay + 1) : stats.totalDays;
      const safeDaily = stats.budgetLeft / remDays;
      if (stats.budgetLeft >= 0) {
        list.push(`You can spend about <strong>${money(safeDaily)}</strong> a day for the rest of the month.`);
      } else {
        list.push(`You exceeded your spending limit by <strong>${money(Math.abs(stats.budgetLeft))}</strong>.`);
      }
    } else {
      list.push('Set a spending limit above to unlock your daily allowance and pace insights.');
    }

    const topCat = Object.entries(stats.catTotals).sort((a, b) => b[1] - a[1])[0];
    if (topCat && stats.spent > 0) {
      const pct = Math.round((topCat[1] / stats.spent) * 100);
      list.push(`Top spending category: <strong>${esc(topCat[0])}</strong> (${money(topCat[1])}, ${pct}% of total).`);
    }

    if (maxCheckDay > 0) {
      list.push(`You have <strong>${noSpendCount}</strong> no-spend ${noSpendCount === 1 ? 'day' : 'days'} so far this month.`);
    }

    if (stats.left < 0) {
      list.push(`Heads up: your running balance is negative (${money(stats.left)}).`);
    }

    $('#insights').innerHTML = list.map((item) => `<li>${item}</li>`).join('');
  }

  function renderMoods() {
    $('#moodTabs').innerHTML = MOODS.map((m) => `
      <button type="button" class="chip ${m.id === activeMood ? 'on' : ''}" data-mood="${m.id}">${esc(m.label)}</button>
    `).join('');

    const cur = MOODS.find((m) => m.id === activeMood) || MOODS[0];
    $('#moodTitle').textContent = cur.title;
    $('#moodTips').innerHTML = cur.tips.map((t) => `<li>${esc(t)}</li>`).join('');
  }

  function renderRecurring() {
    const el = $('#recList');
    if (!state.recurring.length) {
      el.innerHTML = `<p class="muted" style="margin:0;">No recurring items saved yet.</p>`;
      return;
    }
    el.innerHTML = state.recurring.map((r) => `
      <div class="rec-item">
        <div>
          <strong>${esc(r.name)}</strong>
          <span class="muted">Day ${r.day} &bull; ${esc(r.category)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:.6rem;">
          <span class="rec-amt ${r.type}">${r.type === 'in' ? '+' : '-'}${money(r.amount)}</span>
          <button type="button" class="btn small danger" data-del-rec="${r.id}">Delete</button>
        </div>
      </div>
    `).join('');
  }

  function renderGoals() {
    const el = $('#goals');
    if (!state.goals.length) {
      el.innerHTML = `<p class="muted" style="margin:0;">No savings goals yet. Add one above!</p>`;
      return;
    }
    el.innerHTML = state.goals.map((g) => {
      const saved = Number(g.saved) || 0;
      const target = Number(g.target) || 1;
      const pct = Math.min(100, Math.round((saved / target) * 100));
      let paceText = '';
      if (g.date && saved < target) {
        const diffDays = Math.ceil((new Date(g.date) - new Date()) / 86400000);
        if (diffDays > 0) {
          paceText = ` &bull; ${diffDays} days left (save ~${money((target - saved) / diffDays)}/day)`;
        } else {
          paceText = ` &bull; Target date passed`;
        }
      }
      return `
        <div class="goal-card" data-goal="${g.id}">
          <div class="goal-top">
            <strong>${esc(g.name)}</strong>
            <span>${money(saved)} / ${money(target)} (${pct}%)</span>
          </div>
          <div class="goal-bar"><div style="width:${pct}%"></div></div>
          <div class="muted">${g.date ? `Target: ${esc(g.date)}` : 'No target date'}${paceText}</div>
          <div class="goal-actions">
            <input type="number" min="1" step="any" placeholder="Deposit" aria-label="Deposit to ${esc(g.name)}">
            <button type="button" class="btn small" data-deposit="${g.id}">+ Save</button>
            <button type="button" class="btn small danger" data-del-goal="${g.id}">Remove</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---------- Day Modal ----------
  function openDayModal(day) {
    activeModalDay = day;
    const dayObj = getDay(currentYM, day);
    $('#modalTitle').textContent = `Entries for ${currentYM}-${pad(day)} (${weekdayShort(currentYM, day)})`;

    // Migrate single inline entry into items if user opens modal for first time with inline data
    if (!dayObj.items.length && (dayObj.gained > 0 || dayObj.spent > 0)) {
      if (dayObj.gained > 0) {
        dayObj.items.push({ id: uid(), type: 'in', amount: dayObj.gained, category: dayObj.category || 'Salary', note: dayObj.note || 'Inline entry' });
      }
      if (dayObj.spent > 0) {
        dayObj.items.push({ id: uid(), type: 'out', amount: dayObj.spent, category: dayObj.category || 'Other', note: dayObj.note || 'Inline entry' });
      }
      syncDayFromItems(dayObj);
      saveState();
      renderAll();
    }

    renderModalList();
    $('#dayModal').showModal();
  }

  function renderModalList() {
    const dayObj = getDay(currentYM, activeModalDay);
    const list = $('#modalList');
    if (!dayObj.items.length) {
      list.innerHTML = `<li class="muted">No items yet for this day.</li>`;
      return;
    }
    list.innerHTML = dayObj.items.map((it) => `
      <li>
        <div>
          <strong>${it.type === 'in' ? '+' : '-'}${money(it.amount)}</strong>
          <span class="muted">(${esc(it.category)}) ${esc(it.note || '')}</span>
        </div>
        <button type="button" class="btn small danger" data-del-item="${it.id}">Delete</button>
      </li>
    `).join('');
  }

  // ---------- Event Listeners ----------
  window.addEventListener('hashchange', applyView);

  $('#themeBtn').addEventListener('click', () => {
    const order = ['auto', 'light', 'dark'];
    state.settings.theme = order[(order.indexOf(state.settings.theme) + 1) % order.length];
    applyTheme();
    saveState();
  });

  $('#themeSelect').addEventListener('change', (e) => {
    state.settings.theme = e.target.value;
    applyTheme();
    saveState();
  });

  $('#currency').addEventListener('change', (e) => {
    state.settings.currency = e.target.value;
    saveState();
    renderAll();
  });

  $('#remindCheck').addEventListener('change', (e) => {
    state.settings.remind = e.target.checked;
    saveState();
    renderAll();
  });

  $('#goToday').addEventListener('click', () => {
    const today = getTodayParts();
    currentYM = today.ym;
    $('#logSearch').value = '';
    $('#logCatFilter').value = '';
    $('#hideEmpty').checked = false;
    renderAll();
    const row = document.querySelector(`tr[data-day="${today.day}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.querySelector('input[data-field="spent"]')?.focus();
    }
  });

  // Quick Add for today
  $('#qaForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat($('#qa-amount').value);
    if (!(amount > 0)) return;
    const today = getTodayParts();
    currentYM = today.ym;
    const dayObj = getDay(today.ym, today.day);

    // Preserve any existing inline amount before pushing new item
    if (!dayObj.items.length && (dayObj.gained > 0 || dayObj.spent > 0)) {
      if (dayObj.gained > 0) dayObj.items.push({ id: uid(), type: 'in', amount: dayObj.gained, category: dayObj.category || 'Salary', note: dayObj.note || '' });
      if (dayObj.spent > 0) dayObj.items.push({ id: uid(), type: 'out', amount: dayObj.spent, category: dayObj.category || 'Other', note: dayObj.note || '' });
    }

    dayObj.items.push({
      id: uid(),
      type: $('#qa-type').value,
      amount,
      category: $('#qa-cat').value,
      note: $('#qa-note').value.trim()
    });
    syncDayFromItems(dayObj);
    $('#qa-amount').value = '';
    $('#qa-note').value = '';
    saveState('Added to today');
    renderAll();
  });

  // Setup fields
  $('#month').addEventListener('change', (e) => {
    if (e.target.value) {
      currentYM = e.target.value;
      renderAll();
    }
  });
  $('#start').addEventListener('input', (e) => {
    ensureMonth(currentYM).start = Math.max(0, parseFloat(e.target.value) || 0);
    saveState();
    renderAll();
  });
  $('#limit').addEventListener('input', (e) => {
    ensureMonth(currentYM).limit = Math.max(0, parseFloat(e.target.value) || 0);
    saveState();
    renderAll();
  });

  $('#carryOverBtn').addEventListener('click', () => {
    const prev = prevMonthYM(currentYM);
    if (!state.months[prev]) return;
    const prevLeft = monthTotals(prev).left;
    ensureMonth(currentYM).start = Math.max(0, Math.round(prevLeft * 100) / 100);
    saveState('Carried over balance');
    renderAll();
  });

  // Table edits (event delegation)
  $('#logBody').addEventListener('change', (e) => {
    const row = e.target.closest('tr[data-day]');
    if (!row) return;
    const dayObj = getDay(currentYM, Number(row.dataset.day));
    const field = e.target.dataset.field;
    if (!field || dayObj.items.length) return;

    if (field === 'gained' || field === 'spent') {
      dayObj[field] = Math.max(0, parseFloat(e.target.value) || 0);
    } else {
      dayObj[field] = e.target.value;
    }
    saveState();
    renderAll();
  });

  $('#logBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open-day]');
    if (btn) {
      openDayModal(Number(btn.dataset.openDay));
      return;
    }
    // Clicking readonly input opens the items modal
    if (e.target.matches('input[readonly]')) {
      const row = e.target.closest('tr[data-day]');
      if (row) openDayModal(Number(row.dataset.day));
    }
  });

  // Filters
  ['#logSearch', '#logCatFilter', '#hideEmpty'].forEach((sel) => {
    $(sel).addEventListener('input', () => renderAll());
  });

  // Modal actions
  $('#closeModal').addEventListener('click', () => $('#dayModal').close());
  $('#modalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeModalDay) return;
    const amount = parseFloat($('#m-amount').value);
    if (!(amount > 0)) return;
    const dayObj = getDay(currentYM, activeModalDay);
    dayObj.items.push({
      id: uid(),
      type: $('#m-type').value,
      amount,
      category: $('#m-cat').value,
      note: $('#m-note').value.trim()
    });
    syncDayFromItems(dayObj);
    $('#m-amount').value = '';
    $('#m-note').value = '';
    saveState();
    renderModalList();
    renderAll();
  });

  $('#modalList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-item]');
    if (!btn || !activeModalDay) return;
    const dayObj = getDay(currentYM, activeModalDay);
    dayObj.items = dayObj.items.filter((it) => it.id !== btn.dataset.delItem);
    if (dayObj.items.length) {
      syncDayFromItems(dayObj);
    } else {
      dayObj.gained = 0;
      dayObj.spent = 0;
      dayObj.note = '';
    }
    saveState();
    renderModalList();
    renderAll();
  });

  // Mood tabs
  $('#moodTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mood]');
    if (!btn) return;
    activeMood = btn.dataset.mood;
    renderMoods();
  });

  // Recurring items
  $('#recForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#rec-name').value.trim();
    const amount = parseFloat($('#rec-amount').value);
    const day = Math.min(31, Math.max(1, parseInt($('#rec-day').value, 10) || 1));
    if (!name || !(amount > 0)) return;

    state.recurring.push({
      id: uid(),
      name,
      type: $('#rec-type').value,
      amount,
      category: $('#rec-cat').value,
      day
    });
    $('#rec-name').value = '';
    $('#rec-amount').value = '';
    saveState('Recurring item saved');
    renderRecurring();
  });

  $('#recList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-rec]');
    if (!btn) return;
    state.recurring = state.recurring.filter((r) => r.id !== btn.dataset.delRec);
    saveState();
    renderRecurring();
  });

  $('#applyRec').addEventListener('click', () => {
    if (!state.recurring.length) return;
    const totalDays = daysInMonth(currentYM);
    state.recurring.forEach((r) => {
      const targetDay = Math.min(r.day, totalDays);
      const dayObj = getDay(currentYM, targetDay);
      if (!dayObj.items.length && (dayObj.gained > 0 || dayObj.spent > 0)) {
        if (dayObj.gained > 0) dayObj.items.push({ id: uid(), type: 'in', amount: dayObj.gained, category: dayObj.category || 'Salary', note: dayObj.note || '' });
        if (dayObj.spent > 0) dayObj.items.push({ id: uid(), type: 'out', amount: dayObj.spent, category: dayObj.category || 'Other', note: dayObj.note || '' });
      }
      dayObj.items.push({ id: uid(), type: r.type, amount: r.amount, category: r.category, note: `${r.name} (Recurring)` });
      syncDayFromItems(dayObj);
    });
    saveState('Applied recurring items');
    renderAll();
  });

  // Savings goals
  $('#goalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#g-name').value.trim();
    const target = parseFloat($('#g-target').value);
    const date = $('#g-date').value;
    if (!name || !(target > 0)) return;
    state.goals.push({ id: uid(), name, target, saved: 0, date });
    $('#g-name').value = '';
    $('#g-target').value = '';
    $('#g-date').value = '';
    saveState('Goal added');
    renderGoals();
  });

  $('#goals').addEventListener('click', (e) => {
    const depBtn = e.target.closest('[data-deposit]');
    if (depBtn) {
      const card = depBtn.closest('.goal-card');
      const input = card.querySelector('input[type="number"]');
      const amt = parseFloat(input.value);
      if (!(amt > 0)) return;
      const g = state.goals.find((x) => x.id === depBtn.dataset.deposit);
      if (g) {
        g.saved = (Number(g.saved) || 0) + amt;
        saveState('Saved to goal!');
        renderGoals();
      }
      return;
    }
    const delBtn = e.target.closest('[data-del-goal]');
    if (delBtn) {
      state.goals = state.goals.filter((g) => g.id !== delBtn.dataset.delGoal);
      saveState();
      renderGoals();
    }
  });

  // Custom categories
  $('#catForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = $('#newCat').value.trim();
    if (!val) return;
    if (!state.settings.categories.some((c) => c.toLowerCase() === val.toLowerCase())) {
      state.settings.categories.push(val);
      saveState('Category added');
      renderAll();
    }
    $('#newCat').value = '';
  });

  $('#catChips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-cat]');
    if (!btn || state.settings.categories.length <= 1) return;
    const cat = btn.dataset.delCat;
    state.settings.categories = state.settings.categories.filter((c) => c !== cat);
    saveState();
    renderAll();
  });

  // Export CSV
  $('#export').addEventListener('click', () => {
    const stats = monthTotals(currentYM);
    const rows = [['Day', 'Gained', 'Spent', 'Category', 'Note', 'Balance']];
    let running = stats.start;
    for (let d = 1; d <= stats.totalDays; d++) {
      const obj = getDay(currentYM, d);
      running += (Number(obj.gained) || 0) - (Number(obj.spent) || 0);
      const safeNote = `"${String(obj.note || '').replace(/"/g, '""')}"`;
      rows.push([`${currentYM}-${pad(d)}`, obj.gained || 0, obj.spent || 0, obj.category || '', safeNote, running]);
    }
    const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `budget-buddy-${currentYM}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // JSON Backup & Restore
  $('#backupJson').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `budget-buddy-backup-${getTodayParts().iso}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#restoreJson').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || typeof data !== 'object' || !data.months) throw new Error('Invalid');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        state = loadState();
        applyTheme();
        renderAll();
        saveState('Backup restored!');
      } catch {
        alert('Could not restore backup. Please choose a valid Budget Buddy .json file.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // Clear this month + Undo
  $('#clear').addEventListener('click', () => {
    lastClearedSnapshot = {
      ym: currentYM,
      data: JSON.parse(JSON.stringify(ensureMonth(currentYM)))
    };
    state.months[currentYM] = { start: 0, limit: 0, days: {} };
    saveState('Month cleared');
    renderAll();

    $('#undoBar').hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      $('#undoBar').hidden = true;
      lastClearedSnapshot = null;
    }, 10000);
  });

  $('#undoClear').addEventListener('click', () => {
    if (!lastClearedSnapshot) return;
    state.months[lastClearedSnapshot.ym] = lastClearedSnapshot.data;
    currentYM = lastClearedSnapshot.ym;
    lastClearedSnapshot = null;
    clearTimeout(undoTimer);
    $('#undoBar').hidden = true;
    saveState('Month restored');
    renderAll();
  });

  // ---------- Init ----------
  applyView();
  applyTheme();
  renderAll();
})();