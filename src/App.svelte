<script lang="ts">
  import { budget } from './lib/budget/store.svelte';
  import History from './lib/budget/History.svelte';

  // ── Formatters ────────────────────────────────────────────────────────────
  const f0 = (n: number) =>
    `$${Math.round(Math.abs(n)).toLocaleString('en-NZ')}`;
  const f2 = (n: number) =>
    `$${Math.abs(n).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const sign = (n: number) => (n >= 0 ? '+' : '−');

  // ── Date helpers ──────────────────────────────────────────────────────────
  function mondaysInRange(start: Date, end: Date): Date[] {
    const out: Date[] = [];
    const d = new Date(start);
    const dow = d.getDay();
    if (dow !== 1) d.setDate(d.getDate() + ((8 - dow) % 7));
    while (d <= end) { out.push(new Date(d)); d.setDate(d.getDate() + 7); }
    return out;
  }

  function periodFor(year: number, month: number) {
    const start = new Date(year, month, 14);
    const em = month === 11 ? 0 : month + 1;
    const ey = month === 11 ? year + 1 : year;
    return { start, end: new Date(ey, em, 13) };
  }

  const DAY_NAMES       = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DAY_NAMES_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MON_NAMES  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function fmtDay(d: Date) {
    return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MON_NAMES[d.getMonth()]}`;
  }
  function fmtShort(d: Date) {
    return `${d.getDate()} ${MON_NAMES[d.getMonth()]}`;
  }
  function fmtPeriod(s: Date, e: Date) {
    return `${fmtShort(s)} – ${fmtShort(e)} ${e.getFullYear()}`;
  }

  // ── Current period ────────────────────────────────────────────────────────
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const pStart = (() => {
    if (now.getDate() >= 14) return new Date(now.getFullYear(), now.getMonth(), 14);
    const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return new Date(py, pm, 14);
  })();

  const pEnd = (() => {
    const em = pStart.getMonth() === 11 ? 0 : pStart.getMonth() + 1;
    const ey = pStart.getMonth() === 11 ? pStart.getFullYear() + 1 : pStart.getFullYear();
    return new Date(ey, em, 13);
  })();

  const nextPayday = (() => {
    const d = new Date(now);
    if (now.getDate() < 14) d.setDate(14);
    else d.setMonth(d.getMonth() + 1, 14);
    return d;
  })();
  const daysToPayday = Math.round(
    (new Date(nextPayday.getFullYear(), nextPayday.getMonth(), nextPayday.getDate()).getTime() - today.getTime()) / 86_400_000
  );

  // ── Reactive derived ──────────────────────────────────────────────────────
  let weekly      = $derived(budget.data.income.weeklySpend);
  let mondays     = $derived(mondaysInRange(pStart, pEnd));
  let mondayCount = $derived(mondays.length);
  let effectiveMondayCount = $derived(
    budget.data.income.mondayCountOverride ?? mondayCount
  );

  // ── Editable state ────────────────────────────────────────────────────────
  let takeHomeStr      = $state(String(Math.round(budget.data.income.takeHome)));
  let weeklyStr        = $state(String(budget.data.income.weeklySpend));
  let mondayCountStr   = $state(
    String(budget.data.income.mondayCountOverride ?? mondaysInRange(pStart, pEnd).length)
  );
  let mortgageStr      = $state(String(budget.data.mortgage.minimumMonthly));
  let expensesOverride = $state(String(Math.ceil(budget.totalExpenses)));

  function saveTakeHome() {
    const v = parseFloat(takeHomeStr);
    if (!isNaN(v) && v > 0) budget.setTakeHome(v);
  }
  function saveWeekly() {
    const v = Number(weeklyStr);
    if (!isNaN(v) && v > 0) budget.updateIncome({ weeklySpend: v });
  }
  function saveMondayCount() {
    const v = parseInt(mondayCountStr, 10);
    if (!isNaN(v) && v >= 1) {
      if (v === mondayCount) {
        budget.updateIncome({ mondayCountOverride: null });
      } else {
        budget.updateIncome({ mondayCountOverride: v });
      }
    }
  }
  function resetMondayCount() {
    mondayCountStr = String(mondayCount);
    budget.updateIncome({ mondayCountOverride: null });
  }
  function saveMortgage() {
    const v = Number(mortgageStr);
    if (!isNaN(v) && v > 0) budget.updateMortgage({ minimumMonthly: v });
  }

  // Payday distribution
  let expensesAmt  = $derived.by(() => { const v = Number(expensesOverride); return isNaN(v) ? budget.totalExpenses : v; });
  let mortgageAmt  = $derived(budget.data.mortgage.minimumMonthly);
  let savingsAmt   = $derived(budget.totalSavings);

  // Savings CRUD
  let editSavId     = $state<string | null>(null);
  let editSavName   = $state('');
  let editSavAmount = $state(0);
  let newSavName    = $state('');
  let newSavAmount  = $state(0);

  function startEditSav(id: string, name: string, amount: number) {
    editSavId = id; editSavName = name; editSavAmount = amount;
  }
  function saveEditSav(id: string) {
    if (editSavName.trim()) budget.updateSavingsGoal(id, { name: editSavName.trim(), monthly: editSavAmount });
    editSavId = null;
  }
  function addSaving() {
    if (!newSavName.trim()) return;
    budget.addSavingsGoal({ name: newSavName.trim(), monthly: newSavAmount });
    newSavName = ''; newSavAmount = 0;
  }
  let spendingPool = $derived(weekly * effectiveMondayCount);
  let spendingPortionsAmt = $derived(budget.totalSpendingPortions);
  let totalSpendingAccount = $derived(spendingPool + spendingPortionsAmt);
  let buffer       = $derived(budget.takeHome - mortgageAmt - expensesAmt - savingsAmt - totalSpendingAccount);

  // Spending portion CRUD
  let editSpendId     = $state<string | null>(null);
  let editSpendName   = $state('');
  let editSpendAmount = $state(0);
  let newSpendName    = $state('');
  let newSpendAmount  = $state(0);

  function startEditSpend(id: string, name: string, amount: number) {
    editSpendId = id; editSpendName = name; editSpendAmount = amount;
  }
  function saveEditSpend(id: string) {
    if (editSpendName.trim()) budget.updateSpendingPortion(id, { name: editSpendName.trim(), amount: editSpendAmount });
    editSpendId = null;
  }
  function addSpendingPortion() {
    if (!newSpendName.trim()) return;
    budget.addSpendingPortion({ name: newSpendName.trim(), amount: newSpendAmount });
    newSpendName = ''; newSpendAmount = 0;
  }

  // ── Expense editing ───────────────────────────────────────────────────────
  let editingId  = $state<string | null>(null);
  let editName   = $state('');
  let editAmount = $state('');

  function startEdit(id: string, name: string, amount: number) {
    editingId = id; editName = name; editAmount = String(amount);
  }
  function saveEdit(id: string) {
    const a = parseFloat(editAmount);
    if (!isNaN(a) && editName.trim()) budget.updateExpense(id, { name: editName.trim(), amount: a });
    editingId = null;
  }

  let expSortByAmount = $state(false);
  let sortedExpenses  = $derived.by(() => {
    const list = [...budget.data.expenses];
    return expSortByAmount ? list.sort((a, b) => b.amount - a.amount) : list;
  });

  let newExpName   = $state('');
  let newExpAmount = $state('');
  function addExpense() {
    const a = parseFloat(newExpAmount);
    if (!isNaN(a) && newExpName.trim()) {
      budget.addExpense({ name: newExpName.trim(), amount: a, tagId: budget.data.tags[0]?.id ?? '' });
      newExpName = ''; newExpAmount = '';
    }
  }

  // ── 6-month lookahead ─────────────────────────────────────────────────────
  let lookahead = $derived.by(() => {
    const out: { label: string; count: number; pool: number; isFive: boolean }[] = [];
    let y = pStart.getFullYear(), m = pStart.getMonth();
    for (let i = 0; i < 6; i++) {
      const { start, end } = periodFor(y, m);
      const mons = mondaysInRange(start, end);
      out.push({ label: fmtPeriod(start, end), count: mons.length, pool: weekly * mons.length, isFive: mons.length >= 5 });
      m++; if (m > 11) { m = 0; y++; }
    }
    return out;
  });

  // ── Calendar ──────────────────────────────────────────────────────────────
  let calYear  = $state(today.getFullYear());
  let calMonth = $state(today.getMonth());

  function prevMonth() { if (calMonth === 0) { calMonth = 11; calYear--; } else calMonth--; }
  function nextMonth() { if (calMonth === 11) { calMonth = 0; calYear++; } else calMonth++; }

  interface CalDay {
    date: Date;
    inMonth: boolean;
    isToday: boolean;
    isPayday: boolean;    // 14th of any month
    isMonday: boolean;    // all Mondays = transfer days
    inPeriod: boolean;    // falls within current pay period
  }

  let calDays = $derived.by((): CalDay[] => {
    const first = new Date(calYear, calMonth, 1);
    // Week starts Monday: offset = (dow + 6) % 7  (Mon=0 … Sun=6)
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const days: CalDay[] = [];

    // Padding — previous month
    for (let i = offset - 1; i >= 0; i--) {
      const d = new Date(calYear, calMonth, -i);
      days.push(makeCalDay(d, false));
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(calYear, calMonth, i);
      days.push(makeCalDay(d, true));
    }
    // Padding — next month (fill to complete 6 rows = 42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(calYear, calMonth + 1, i);
      days.push(makeCalDay(d, false));
    }
    return days;
  });

  function makeCalDay(d: Date, inMonth: boolean): CalDay {
    return {
      date: d,
      inMonth,
      isToday:   d.getTime() === today.getTime(),
      isPayday:  d.getDate() === 14,
      isMonday:  d.getDay() === 1,
      inPeriod:  d >= pStart && d <= pEnd,
    };
  }

  const CAL_HEADER = ['M','T','W','T','F','S','S'];
  let selectedDate = $state<Date | null>(null);

  function calDayTip(d: Date): string {
    return `${DAY_NAMES_FULL[d.getDay()]} ${d.getDate()} ${MON_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }
  function toggleSelected(d: Date) {
    selectedDate = (selectedDate?.getTime() === d.getTime()) ? null : d;
  }

  // ── Collapsible panels ────────────────────────────────────────────────────
  let colPayday   = $state(false);

  let colExpenses = $state(false);
  let colCalendar = $state(false);

  // ── Budget Health (50/30/20) ────────────────────────────────────────────
  let healthNeeds = $derived(budget.expensesByCategory.needs + budget.data.mortgage.minimumMonthly);
  let healthWants = $derived(budget.expensesByCategory.wants + totalSpendingAccount);
  let healthSavings = $derived(budget.totalSavings);
  let healthTotal = $derived(budget.takeHome);
  let healthNeedsPct = $derived(healthTotal > 0 ? (healthNeeds / healthTotal) * 100 : 0);
  let healthWantsPct = $derived(healthTotal > 0 ? (healthWants / healthTotal) * 100 : 0);
  let healthSavingsPct = $derived(healthTotal > 0 ? (healthSavings / healthTotal) * 100 : 0);
  let healthBufferPct = $derived(Math.max(0, 100 - healthNeedsPct - healthWantsPct - healthSavingsPct));

  // ── Navigation ────────────────────────────────────────────────────────────
  let activeTab = $state<'budget' | 'history'>('budget');

  function currentPeriodLabel(): string {
    const start = pStart;
    return `${MON_NAMES[start.getMonth()]} ${start.getFullYear()}`;
  }

  function markMonthComplete() {
    const period = currentPeriodLabel();
    if (!confirm(`Save ${period} budget to history?`)) return;
    budget.completeMonth(expensesAmt);
    showToast('Month saved to history');
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout>;
  function showToast(msg: string) {
    clearTimeout(toastTimer);
    toast = msg;
    toastTimer = setTimeout(() => (toast = null), 2200);
  }
</script>

<div class="shell">

  <!-- ══════════════════════ HEADER ══════════════════════════════════════ -->
  <header>
    <div class="h-left">
      <span class="wordmark">budget</span>
      <div class="h-divider"></div>
      <nav class="tab-nav">
        <button
          class="tab-btn"
          class:tab-active={activeTab === 'budget'}
          type="button"
          onclick={() => activeTab = 'budget'}
        >Budget</button>
        <button
          class="tab-btn"
          class:tab-active={activeTab === 'history'}
          type="button"
          onclick={() => activeTab = 'history'}
        >History</button>
      </nav>
      {#if activeTab === 'budget'}
        <div class="h-divider"></div>
        <div class="payday-badge" class:payday-soon={daysToPayday <= 3} class:payday-today={daysToPayday === 0}>
          {#if daysToPayday === 0}
            <span class="badge-dot"></span>payday today
          {:else if daysToPayday === 1}
            <span class="badge-dot"></span>payday tomorrow
          {:else}
            payday in {daysToPayday}d
          {/if}
        </div>
      {/if}
    </div>

    <div class="h-right">
      {#if activeTab === 'budget'}
        <div class="remaining-stat" class:stat-pos={budget.remaining >= 0} class:stat-neg={budget.remaining < 0}>
          <span class="stat-sign">{sign(budget.remaining)}</span>{f0(budget.remaining)}
          <span class="stat-freq">/mo</span>
        </div>
        <button class="icon-btn icon-btn-complete" onclick={markMonthComplete} title="Mark month complete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="icon-btn" onclick={() => { budget.copyTextSummary(); showToast('Summary copied'); }} title="Copy summary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="icon-btn icon-btn-danger" onclick={() => { if (confirm('Reset all data to defaults?')) { budget.resetToDefaults(); showToast('Reset complete'); } }} title="Reset">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.16"/></svg>
        </button>
      {/if}
    </div>
  </header>

  <!-- ══════════════════════ MAIN ════════════════════════════════════════ -->
  <main>
    {#if activeTab === 'history'}
      <History />
    {:else}

    <!-- ── Metric row ─────────────────────────────────────────────────── -->
    <div class="metric-row">

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Take-Home Pay</span>
          <span class="metric-aux num">{f2(budget.takeHome * 12)}/yr</span>
        </div>
        <div class="metric-input-group">
          <span class="metric-currency">$</span>
          <input
            class="metric-input num"
            type="number" min="0" step="1"
            bind:value={takeHomeStr}
            oninput={saveTakeHome}
          />
          <span class="metric-unit">/mo</span>
        </div>
        <p class="metric-hint">Paid 14th · edit when it changes</p>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Weekly Spending</span>
          <span class="metric-aux">suggest {f0(Math.floor(budget.remaining / 4))}/wk</span>
        </div>
        <div class="metric-input-group">
          <span class="metric-currency">$</span>
          <input
            class="metric-input num"
            type="number" min="1" step="1"
            bind:value={weeklyStr}
            oninput={saveWeekly}
          />
          <span class="metric-unit">/wk</span>
        </div>
        <p class="metric-hint monday-hint">
          Auto-payment every Monday ·
          <input
            class="monday-count-inp num"
            type="number"
            min="1"
            max="6"
            step="1"
            bind:value={mondayCountStr}
            oninput={saveMondayCount}
          />
          / {mondayCount} this period
          {#if budget.data.income.mondayCountOverride != null}
            <button class="monday-reset" onclick={resetMondayCount}>reset</button>
          {/if}
        </p>
      </div>

      <div class="metric-card metric-card-stat">
        <div class="metric-label">Outgoings</div>
        <div class="stat-big num">{f0(budget.totalOutgoings)}<span class="stat-freq-big">/mo</span></div>
        <div class="stat-row-list">
          <div class="stat-line"><span>Expenses</span><span class="num">{f0(budget.totalExpenses)}</span></div>
          <div class="stat-line"><span>Mortgage</span><span class="num">{f0(mortgageAmt)}</span></div>
          <div class="stat-line"><span>Savings</span><span class="num">{f0(savingsAmt)}</span></div>
        </div>
      </div>

    </div>

    <!-- ── Budget Health ─────────────────────────────────────────────── -->
    <div class="health-panel">
      <div class="health-bar">
        <div class="health-seg health-needs" style="width:{healthNeedsPct}%"></div>
        <div class="health-seg health-wants" style="width:{healthWantsPct}%"></div>
        <div class="health-seg health-savings" style="width:{healthSavingsPct}%"></div>
        <div class="health-seg health-buffer" style="width:{healthBufferPct}%"></div>
        <div class="health-target" style="left:50%" title="50% target (Needs)"></div>
        <div class="health-target" style="left:80%" title="80% target (Needs + Wants)"></div>
      </div>
      <div class="health-labels">
        <div class="health-label">
          <span class="health-dot health-dot-needs"></span>
          <span class="health-name">Needs</span>
          <span class="health-pct num">{Math.round(healthNeedsPct)}%</span>
          <span class="health-amt num">{f0(healthNeeds)}</span>
        </div>
        <div class="health-label">
          <span class="health-dot health-dot-wants"></span>
          <span class="health-name">Wants</span>
          <span class="health-pct num">{Math.round(healthWantsPct)}%</span>
          <span class="health-amt num">{f0(healthWants)}</span>
        </div>
        <div class="health-label">
          <span class="health-dot health-dot-savings"></span>
          <span class="health-name">Savings</span>
          <span class="health-pct num">{Math.round(healthSavingsPct)}%</span>
          <span class="health-amt num">{f0(healthSavings)}</span>
        </div>
        <div class="health-label">
          <span class="health-dot health-dot-buffer"></span>
          <span class="health-name">Buffer</span>
          <span class="health-pct num">{Math.round(healthBufferPct)}%</span>
          <span class="health-amt num">{f0(healthTotal - healthNeeds - healthWants - healthSavings)}</span>
        </div>
      </div>
      <div class="health-targets-legend">
        <span class="health-target-label">50/30/20 targets</span>
        <span class="health-target-item"><span class="target-tick"></span>50% needs</span>
        <span class="health-target-item"><span class="target-tick"></span>80% needs+wants</span>
      </div>
    </div>

    <!-- ── Payday Distribution ───────────────────────────────────────── -->
    <div>

      <!-- Payday distribution -->
      <section class="panel" class:panel-collapsed={colPayday}>
        <header class="panel-header" onclick={() => colPayday = !colPayday} role="button" tabindex="0"
          onkeydown={e => e.key === 'Enter' && (colPayday = !colPayday)}>
          <div class="ph-left">
            <h2 class="panel-title">Payday Distribution</h2>
            <span class="panel-sub">14th of each month</span>
          </div>
          <div class="ph-right">
            {#if colPayday}<span class="panel-peek num">{f0(totalSpendingAccount)} spending · {sign(buffer)}{f0(buffer)} buffer</span>{/if}
            <span class="chevron" class:chevron-up={!colPayday}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
        </header>

        {#if !colPayday}
        <div class="dist-table">
          <div class="dist-row">
            <span class="dist-label">Mortgage</span>
            <div class="dist-field">
              <span class="field-pre">$</span>
              <input class="field-inp num" type="number" min="0" step="1" bind:value={mortgageStr} oninput={saveMortgage} />
            </div>
          </div>
          <div class="dist-row">
            <span class="dist-label">Expenses <span class="dist-sub">round up if needed</span></span>
            <div class="dist-field">
              <span class="field-pre">$</span>
              <input class="field-inp num" type="number" min="0" step="1" bind:value={expensesOverride} />
            </div>
          </div>
          <!-- Savings list -->
          <div class="dist-sav-section">
            <span class="dist-sav-head">Savings <span class="dist-sav-total num">{f0(savingsAmt)}</span></span>
            {#each budget.data.savings as g (g.id)}
              {#if editSavId === g.id}
                <div class="dist-sav-row dist-sav-editing">
                  <input class="sav-inp sav-inp-name" bind:value={editSavName}
                    onkeydown={e => { if (e.key === 'Enter') saveEditSav(g.id); if (e.key === 'Escape') editSavId = null; }} />
                  <div class="dist-field sav-inp-amt-wrap">
                    <span class="field-pre">$</span>
                    <input class="field-inp num sav-inp-amt" type="number" min="0" step="1" bind:value={editSavAmount}
                      onkeydown={e => { if (e.key === 'Enter') saveEditSav(g.id); if (e.key === 'Escape') editSavId = null; }} />
                  </div>
                  <button class="action-btn action-confirm" onclick={() => saveEditSav(g.id)}>Save</button>
                  <button class="action-btn action-cancel" onclick={() => editSavId = null}>✕</button>
                </div>
              {:else}
                <div class="dist-sav-row">
                  <span class="dist-sav-name">{g.name}</span>
                  <span class="dist-sav-amt num">{f0(g.monthly)}</span>
                  <button class="action-btn action-edit" onclick={() => startEditSav(g.id, g.name, g.monthly)}>Edit</button>
                  <button class="action-btn action-delete" onclick={() => budget.removeSavingsGoal(g.id)}>✕</button>
                </div>
              {/if}
            {/each}
            <div class="dist-sav-row dist-sav-add">
              <select class="sav-inp sav-inp-name sav-select" bind:value={newSavName}>
                <option value="" disabled selected>Savings account</option>
                <option>Personal</option>
                <option>Emergency</option>
                <option>Fund Fund</option>
                <option>House Fund</option>
              </select>
              <div class="dist-field sav-inp-amt-wrap">
                <span class="field-pre">$</span>
                <input class="field-inp num sav-inp-amt" type="number" min="0" step="1" bind:value={newSavAmount} placeholder="0"
                  onkeydown={e => e.key === 'Enter' && addSaving()} />
              </div>
              <button class="action-btn action-add" onclick={addSaving}>Add</button>
            </div>
          </div>
          <div class="dist-sep"></div>
          <div class="dist-spend-section">
            <div class="dist-row dist-row-accent">
              <span class="dist-label">Spending account <span class="dist-pill">{effectiveMondayCount}×{f0(weekly)}</span></span>
              <span class="dist-val num dist-val-accent">{f0(totalSpendingAccount)}</span>
            </div>
            {#if spendingPortionsAmt > 0}
              <div class="dist-spend-sub num">{f0(spendingPool)} transfers + {f0(spendingPortionsAmt)} portions</div>
            {/if}
            {#each budget.data.spendingPortions as p (p.id)}
              {#if editSpendId === p.id}
                <div class="dist-sav-row dist-sav-editing">
                  <input class="sav-inp sav-inp-name" bind:value={editSpendName}
                    onkeydown={e => { if (e.key === 'Enter') saveEditSpend(p.id); if (e.key === 'Escape') editSpendId = null; }} />
                  <div class="dist-field sav-inp-amt-wrap">
                    <span class="field-pre">$</span>
                    <input class="field-inp num sav-inp-amt" type="number" min="0" step="1" bind:value={editSpendAmount}
                      onkeydown={e => { if (e.key === 'Enter') saveEditSpend(p.id); if (e.key === 'Escape') editSpendId = null; }} />
                  </div>
                  <button class="action-btn action-confirm" onclick={() => saveEditSpend(p.id)}>Save</button>
                  <button class="action-btn action-cancel" onclick={() => editSpendId = null}>✕</button>
                </div>
              {:else}
                <div class="dist-sav-row">
                  <span class="dist-sav-name">{p.name}</span>
                  <span class="dist-sav-amt num">{f0(p.amount)}</span>
                  <button class="action-btn action-edit" onclick={() => startEditSpend(p.id, p.name, p.amount)}>Edit</button>
                  <button class="action-btn action-delete" onclick={() => budget.removeSpendingPortion(p.id)}>✕</button>
                </div>
              {/if}
            {/each}
            <div class="dist-sav-row dist-sav-add">
              <input class="sav-inp sav-inp-name" bind:value={newSpendName} placeholder="Portion name"
                onkeydown={e => e.key === 'Enter' && addSpendingPortion()} />
              <div class="dist-field sav-inp-amt-wrap">
                <span class="field-pre">$</span>
                <input class="field-inp num sav-inp-amt" type="number" min="0" step="1" bind:value={newSpendAmount} placeholder="0"
                  onkeydown={e => e.key === 'Enter' && addSpendingPortion()} />
              </div>
              <button class="action-btn action-add" onclick={addSpendingPortion}>Add</button>
            </div>
          </div>
          <div class="dist-row dist-row-buffer" class:buf-pos={buffer >= 0} class:buf-neg={buffer < 0}>
            <span class="dist-label">Buffer <span class="dist-sub">stays in main account</span></span>
            <span class="dist-val num">{sign(buffer)}{f0(buffer)}</span>
          </div>
          <div class="dist-total">
            <span>Take-home</span>
            <span class="num">{f2(budget.takeHome)}</span>
          </div>
        </div>
        {/if}
      </section>

    </div>

    <!-- ── Expenses + Calendar & Upcoming ─────────────────────────────── -->
    <div class="two-col">

      <!-- Expenses -->
      <section class="panel" class:panel-collapsed={colExpenses}>
        <header class="panel-header" onclick={() => colExpenses = !colExpenses} role="button" tabindex="0"
          onkeydown={e => e.key === 'Enter' && (colExpenses = !colExpenses)}>
          <div class="ph-left">
            <h2 class="panel-title">Monthly Expenses</h2>
            <span class="panel-sub num">{f0(budget.totalExpenses)}/mo</span>
          </div>
          <div class="ph-right">
            {#if colExpenses}<span class="panel-peek">{budget.data.expenses.length} items</span>{/if}
            <button class="sort-btn" class:sort-active={expSortByAmount}
              onclick={e => { e.stopPropagation(); expSortByAmount = !expSortByAmount; }}
              aria-label="Sort by amount">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>
              </svg>
              <span class="sort-label">Amount</span>
            </button>
            <span class="chevron" class:chevron-up={!colExpenses}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
        </header>

        {#if !colExpenses}
        <div class="exp-table">
          {#each sortedExpenses as exp (exp.id)}
            {#if editingId === exp.id}
              <div class="exp-row exp-editing">
                <input class="exp-inp exp-inp-name" bind:value={editName}
                  onkeydown={e => { if (e.key === 'Enter') saveEdit(exp.id); if (e.key === 'Escape') editingId = null; }} />
                <input class="exp-inp exp-inp-amt num" type="number" min="0" step="1" bind:value={editAmount}
                  onkeydown={e => { if (e.key === 'Enter') saveEdit(exp.id); if (e.key === 'Escape') editingId = null; }} />
                <button class="action-btn action-confirm" onclick={() => saveEdit(exp.id)}>Save</button>
                <button class="action-btn action-cancel" onclick={() => editingId = null}>✕</button>
              </div>
            {:else}
              <div class="exp-row">
                <span class="exp-tag-dot" style="background:{budget.tagById(exp.tagId)?.color ?? 'var(--fg-4)'}"></span>
                <span class="exp-name">{exp.name}</span>
                <span class="exp-amt num">{f0(exp.amount)}</span>
                <button class="action-btn action-edit" onclick={() => startEdit(exp.id, exp.name, exp.amount)}>Edit</button>
                <button class="action-btn action-delete" onclick={() => budget.removeExpense(exp.id)}>✕</button>
              </div>
            {/if}
          {/each}
        </div>
        <div class="exp-add-row">
          <input class="exp-inp exp-inp-name" bind:value={newExpName} placeholder="New expense"
            onkeydown={e => e.key === 'Enter' && addExpense()} />
          <input class="exp-inp exp-inp-amt num" type="number" min="0" step="1" bind:value={newExpAmount} placeholder="0"
            onkeydown={e => e.key === 'Enter' && addExpense()} />
          <button class="action-btn action-add" onclick={addExpense}>Add</button>
        </div>
        {/if}
      </section>

      <!-- Calendar + Upcoming merged -->
      <section class="panel cal-panel" class:panel-collapsed={colCalendar}>
        <header class="panel-header cal-nav" onclick={() => colCalendar = !colCalendar} role="button" tabindex="0"
          onkeydown={e => e.key === 'Enter' && (colCalendar = !colCalendar)}>
          <div class="ph-left cal-ph-left">
            {#if !colCalendar}
              <button class="cal-arrow" onclick={e => { e.stopPropagation(); prevMonth(); }} aria-label="Previous month">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            {/if}
            <span class="cal-title">{MON_NAMES[calMonth]} {calYear}</span>
            {#if !colCalendar}
              <button class="cal-arrow" onclick={e => { e.stopPropagation(); nextMonth(); }} aria-label="Next month">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            {/if}
          </div>
          <div class="ph-right">
            {#if colCalendar}<span class="panel-peek">Calendar &amp; upcoming</span>{/if}
            <span class="chevron" class:chevron-up={!colCalendar}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
        </header>

        {#if !colCalendar}
        <!-- Calendar grid -->
        <div class="cal-body">
          <div class="cal-grid cal-weekdays">
            {#each CAL_HEADER as h}<span class="cal-wday">{h}</span>{/each}
          </div>
          <div class="cal-grid cal-days-grid">
            {#each calDays as day}
              <div class="cal-day"
                class:cal-out={!day.inMonth}
                class:cal-today={day.isToday}
                class:cal-payday={day.isPayday && day.inMonth}
                class:cal-monday={day.isMonday && !day.isPayday && day.inMonth}
                class:cal-selected={selectedDate?.getTime() === day.date.getTime()}
                data-tip={calDayTip(day.date)}
                role="button"
                tabindex="0"
                onclick={() => toggleSelected(day.date)}
                onkeydown={e => e.key === 'Enter' && toggleSelected(day.date)}>
                <span class="cal-num">{day.date.getDate()}</span>
                <div class="cal-dots">
                  {#if day.isPayday && day.inMonth}<span class="dot dot-amber"></span>{/if}
                  {#if day.isMonday && day.inMonth}<span class="dot dot-emerald"></span>{/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
        <div class="cal-legend">
          <span class="legend-item"><span class="dot dot-amber"></span>Payday</span>
          <span class="legend-item"><span class="dot dot-emerald"></span>Transfer</span>
          <span class="legend-item"><span class="legend-ring"></span>Today</span>
        </div>

        <!-- Upcoming periods (below calendar) -->
        <div class="upcoming-section">
          <div class="upcoming-sub-header">Upcoming Periods</div>
          <div class="upcoming-table">
            <div class="upcoming-head">
              <span>Period</span>
              <span class="text-right">Mon</span>
              <span class="text-right">Pool</span>
              <span class="text-right">Extra</span>
            </div>
            {#each lookahead as p, i}
              <div class="upcoming-row" class:upcoming-current={i === 0} class:upcoming-five={p.isFive}>
                <span class="upcoming-period">{p.label}</span>
                <span class="text-right" class:count-warn={p.isFive}>{p.count}</span>
                <span class="text-right num">{f0(p.pool)}</span>
                <span class="text-right">
                  {#if p.isFive}<span class="extra-chip">+{f0(weekly)}</span>
                  {:else}<span class="fg-4">—</span>{/if}
                </span>
              </div>
            {/each}
          </div>
          <div class="savings-bar">
            <span class="fg-3">Savings</span><span class="num">{f0(savingsAmt)}/mo</span>
            <span class="fg-4">·</span>
            <span class="fg-3">Mortgage</span><span class="num">{f0(mortgageAmt)}/mo</span>
          </div>
        </div>
        {/if}
      </section>

    </div>

    {/if}
  </main>
</div>

{#if toast}
  <div class="toast">{toast}</div>
{/if}

<style>
  /* ══════════════════ SHELL ═══════════════════════════════════════════════ */
  .shell { display: flex; flex-direction: column; min-height: 100vh; }

  /* ══════════════════ HEADER ══════════════════════════════════════════════ */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    padding: 0 24px;
    background: var(--bg-raised);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 200;
    backdrop-filter: blur(12px);
  }

  .h-left  { display: flex; align-items: center; gap: 14px; }
  .h-right { display: flex; align-items: center; gap: 8px; }
  .h-divider { width: 1px; height: 16px; background: var(--border-2); }

  .wordmark {
    font-size: 14px;
    font-weight: 700;
    color: var(--amber);
    letter-spacing: -0.04em;
  }

  .tab-nav {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .tab-btn {
    background: transparent;
    border: none;
    color: var(--fg-4);
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: all 0.15s;
  }
  .tab-btn:hover { color: var(--fg-2); background: var(--surface-2); }
  .tab-btn.tab-active {
    color: var(--amber);
    background: var(--amber-soft);
  }

  .payday-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--fg-3);
  }
  .payday-badge.payday-soon { color: var(--orange); }
  .payday-badge.payday-today { color: var(--amber); font-weight: 600; }

  .badge-dot {
    width: 6px; height: 6px;
    background: var(--amber);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .remaining-stat {
    display: flex;
    align-items: baseline;
    gap: 2px;
    font-size: 13px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--border-2);
    background: var(--surface);
    font-variant-numeric: tabular-nums;
  }
  .remaining-stat.stat-pos { color: var(--emerald); border-color: var(--emerald-border); background: var(--emerald-soft); }
  .remaining-stat.stat-neg { color: var(--rose); border-color: var(--rose-border); background: var(--rose-soft); }
  .stat-sign { font-size: 11px; margin-right: 1px; }
  .stat-freq { font-size: 11px; font-weight: 400; color: inherit; opacity: 0.7; margin-left: 2px; }

  .icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--fg-3);
    cursor: pointer;
    transition: all 0.15s;
  }
  .icon-btn:hover { color: var(--fg-2); border-color: var(--border-2); background: var(--surface-2); }
  .icon-btn-complete:hover { color: var(--emerald); border-color: var(--emerald-border); background: var(--emerald-soft); }
  .icon-btn-danger:hover { color: var(--rose); border-color: var(--rose-border); background: var(--rose-soft); }

  /* ══════════════════ MAIN ════════════════════════════════════════════════ */
  main {
    flex: 1;
    padding: 24px;
    max-width: 1080px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Panel (shared card base) ────────────────────────────────────────── */
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    overflow: hidden;
  }
  .panel-collapsed { }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    cursor: pointer;
    user-select: none;
    transition: background 0.13s;
    gap: 12px;
  }
  .panel-header:hover { background: var(--surface-2); }

  .ph-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }
  .ph-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .panel-sub {
    font-size: 11px;
    color: var(--fg-3);
    white-space: nowrap;
  }
  .panel-peek {
    font-size: 11px;
    color: var(--fg-4);
    white-space: nowrap;
  }

  .chevron {
    display: flex;
    align-items: center;
    color: var(--fg-4);
    transition: transform 0.2s cubic-bezier(0.4,0,0.2,1);
    transform: rotate(0deg);
  }
  .chevron-up { transform: rotate(180deg); }

  /* ══════════════════ METRIC ROW ══════════════════════════════════════════ */
  .metric-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 800px) { .metric-row { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 540px) { .metric-row { grid-template-columns: 1fr; } }

  .metric-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
    overflow: hidden;
  }
  .metric-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--amber-lo) 0%, transparent 100%);
    opacity: 0.5;
  }

  .metric-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .metric-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--fg-3);
  }
  .metric-aux { font-size: 11px; color: var(--fg-4); }

  .metric-input-group {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .metric-currency {
    font-size: 22px;
    font-weight: 700;
    color: var(--amber);
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .metric-input {
    background: transparent;
    border: none;
    border-bottom: 1.5px solid var(--border-2);
    color: var(--amber);
    font-family: inherit;
    font-size: 36px;
    font-weight: 700;
    letter-spacing: -0.04em;
    outline: none;
    width: 170px;
    padding: 0 2px 3px;
    transition: border-color 0.15s;
    line-height: 1;
  }
  .metric-input:focus { border-bottom-color: var(--amber); }
  .metric-input::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type="number"] { -moz-appearance: textfield; }
  .metric-input[type=number] { -moz-appearance: textfield; appearance: textfield; }
  .metric-unit { font-size: 14px; color: var(--fg-4); font-weight: 400; }
  .metric-hint { font-size: 11px; color: var(--fg-4); margin-top: 10px; }
  .monday-hint {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .monday-count-inp {
    width: 28px;
    background: var(--surface-2);
    border: 1px solid var(--border-2);
    border-radius: var(--r-sm);
    color: var(--fg-2);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    padding: 1px 4px;
    text-align: center;
    outline: none;
    transition: border-color 0.15s;
  }
  .monday-count-inp:focus { border-color: var(--amber-border); }
  .monday-count-inp::placeholder { color: var(--fg-4); font-weight: 400; }
  .monday-reset {
    background: none;
    border: none;
    color: var(--fg-4);
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .monday-reset:hover { color: var(--fg-2); }

  /* Stat-style metric card (no input) */
  .metric-card-stat {}
  .stat-big {
    font-size: 34px;
    font-weight: 700;
    color: var(--fg);
    letter-spacing: -0.04em;
    line-height: 1;
    margin: 8px 0;
  }
  .stat-freq-big { font-size: 14px; font-weight: 400; color: var(--fg-4); margin-left: 2px; }
  .stat-row-list { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
  .stat-line {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--fg-3);
  }
  .stat-line span:last-child { color: var(--fg-2); }

  /* ══════════════════ BUDGET HEALTH ══════════════════════════════════════ */
  .health-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    padding: 16px 20px;
  }

  .health-bar {
    position: relative;
    display: flex;
    height: 10px;
    border-radius: 5px;
    overflow: hidden;
    background: var(--surface-3);
  }
  .health-seg {
    height: 100%;
    min-width: 2px;
    transition: width 0.3s ease;
  }
  .health-needs   { background: var(--blue, #60a5fa); }
  .health-wants   { background: var(--emerald); }
  .health-savings { background: var(--purple, #c084fc); }
  .health-buffer  { background: var(--surface-4); }

  .health-target {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    background: var(--fg-4);
    opacity: 0.5;
    border-radius: 1px;
    pointer-events: none;
  }

  .health-labels {
    display: flex;
    gap: 16px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .health-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--fg-3);
  }
  .health-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .health-dot-needs   { background: var(--blue, #60a5fa); }
  .health-dot-wants   { background: var(--emerald); }
  .health-dot-savings { background: var(--purple, #c084fc); }
  .health-dot-buffer  { background: var(--surface-4); border: 1px solid var(--border-2); }
  .health-name { color: var(--fg-2); font-weight: 500; }
  .health-pct  { font-weight: 600; color: var(--fg); }
  .health-amt  { color: var(--fg-4); font-size: 11px; }

  .health-targets-legend {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    font-size: 10px;
    color: var(--fg-4);
  }
  .health-target-label {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .health-target-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .target-tick {
    width: 2px;
    height: 10px;
    background: var(--fg-4);
    opacity: 0.5;
    border-radius: 1px;
  }

  /* ══════════════════ GRID LAYOUTS ═══════════════════════════════════════ */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } }


  /* ══════════════════ DISTRIBUTION TABLE ══════════════════════════════════ */
  .dist-table {
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
  }

  .dist-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 8px;
    gap: 12px;
    border-radius: var(--r-sm);
  }
  .dist-row:nth-child(even) { background: var(--surface-2); }

  .dist-label {
    font-size: 13px;
    color: var(--fg-2);
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  .dist-sub {
    font-size: 10px;
    color: var(--fg-4);
    font-style: italic;
  }

  .dist-val {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
    white-space: nowrap;
  }

  /* Editable field */
  .dist-field {
    display: flex;
    align-items: center;
    background: var(--surface-3);
    border: 1px solid var(--border-2);
    border-radius: var(--r-sm);
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .dist-field:focus-within { border-color: var(--amber-border); }
  .field-pre {
    padding: 0 8px;
    font-size: 12px;
    color: var(--fg-4);
    background: var(--surface-4);
    border-right: 1px solid var(--border-2);
    align-self: stretch;
    display: flex;
    align-items: center;
  }
  .field-inp {
    background: transparent;
    border: none;
    outline: none;
    color: var(--fg);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 7px 10px;
    width: 90px;
    text-align: right;
  }

  .dist-sep {
    height: 1px;
    background: var(--border-2);
    margin: 4px 0;
  }

  .dist-row-accent .dist-label { color: var(--fg); font-weight: 600; }
  .dist-val-accent {
    font-size: 16px;
    color: var(--amber) !important;
    font-weight: 700;
  }
  .dist-pill {
    display: inline-flex;
    align-items: center;
    background: var(--amber-soft);
    border: 1px solid var(--amber-border);
    color: var(--amber);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    letter-spacing: 0.02em;
  }

  .buf-pos .dist-val { color: var(--emerald); }
  .buf-neg .dist-val { color: var(--rose); }

  .dist-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0 0;
    border-top: 1px solid var(--border-2);
    font-size: 12px;
    color: var(--fg-3);
    margin-top: 4px;
  }
  .dist-total span:last-child {
    font-size: 14px;
    font-weight: 700;
    color: var(--fg);
  }

  /* ── Spending sub-list inside dist panel ─── */
  .dist-spend-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 0 6px;
  }
  .dist-spend-sub {
    font-size: 10px;
    color: var(--fg-4);
    padding: 0 8px 4px;
    text-align: right;
  }

  /* ── Savings sub-list inside dist panel ─── */
  .dist-sav-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 0 6px;
    border-top: 1px solid var(--border-2);
    border-bottom: 1px solid var(--border-2);
    margin: 2px 0;
  }
  .dist-sav-head {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-3);
    display: flex;
    justify-content: space-between;
    padding: 2px 0 4px;
  }
  .dist-sav-total { color: var(--fg-2); }
  .dist-sav-row {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 2px 6px;
    border-radius: var(--r-sm);
  }
  .dist-sav-row:nth-child(even) { background: var(--surface-2); }
  .dist-sav-editing { grid-template-columns: 1fr auto auto auto; }
  .dist-sav-add { margin-top: 4px; width: fit-content; gap: 6px; }
  .dist-sav-add .sav-inp-name { width: 160px; flex: none; }
  .dist-sav-name {
    font-size: 12px;
    color: var(--fg-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dist-sav-amt {
    font-size: 12px;
    color: var(--fg);
    min-width: 48px;
    text-align: right;
  }
  .sav-inp-name {
    background: var(--surface-2);
    border: 1px solid var(--border-2);
    border-radius: var(--r-sm);
    color: var(--fg);
    font-size: 12px;
    font-family: inherit;
    padding: 4px 7px;
    outline: none;
    width: 100%;
    min-width: 0;
  }
  .sav-inp-name:focus { border-color: var(--amber-border); }
  .sav-inp-name::placeholder { color: var(--fg-4); }
  .sav-select {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%235e5e74' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 7px center;
    padding-right: 22px;
    cursor: pointer;
  }
  .sav-select option { background: var(--surface-3); color: var(--fg); }
  .sav-inp-amt-wrap { min-width: 80px; }
  .sav-inp-amt { width: 100%; }

  /* ══════════════════ EXPENSES ════════════════════════════════════════════ */
  .sort-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--fg-4);
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.13s;
  }
  .sort-btn:hover { color: var(--fg-2); border-color: var(--border-2); background: var(--surface-2); }
  .sort-btn.sort-active { color: var(--amber); border-color: var(--amber-border); background: var(--amber-soft); }
  .sort-label { letter-spacing: 0.02em; }

  .exp-table {
    padding: 0 16px;
    display: flex;
    flex-direction: column;
  }

  .exp-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px;
    border-radius: var(--r-sm);
  }
  .exp-row:nth-child(even) { background: var(--surface-2); }
  .exp-row.exp-editing { gap: 6px; }

  .exp-name { flex: 1; font-size: 13px; color: var(--fg-2); }
  .exp-tag-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .exp-amt  {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
    min-width: 52px;
    text-align: right;
  }

  .exp-inp {
    background: var(--surface-3);
    border: 1px solid var(--border-2);
    border-radius: var(--r-sm);
    color: var(--fg);
    font-family: inherit;
    font-size: 13px;
    padding: 6px 10px;
    outline: none;
    transition: border-color 0.15s;
  }
  .exp-inp:focus { border-color: var(--amber-border); }
  .exp-inp-name { flex: 1; }
  .exp-inp-amt  { width: 72px; text-align: right; }

  .exp-add-row {
    display: flex;
    gap: 8px;
    padding: 12px 16px 14px;
    border-top: 1px solid var(--border);
    background: var(--bg-raised);
  }
  .exp-add-row .exp-inp-name { flex: 1; }

  .action-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-3);
    padding: 4px 10px;
    border-radius: var(--r-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.13s;
  }
  .action-btn:hover { color: var(--fg-2); border-color: var(--border-2); background: var(--surface-2); }
  .action-confirm { color: var(--emerald); border-color: var(--emerald-border); background: var(--emerald-soft); }
  .action-confirm:hover { background: rgba(16,185,129,0.18); }
  .action-cancel  { color: var(--fg-4); }
  .action-edit    { }
  .action-delete  { color: var(--rose); border-color: transparent; }
  .action-delete:hover { border-color: var(--rose-border); background: var(--rose-soft); }
  .action-add     { color: var(--amber); border-color: var(--amber-border); background: var(--amber-soft); }
  .action-add:hover { background: var(--amber-glow); }

  /* ══════════════════ UPCOMING ════════════════════════════════════════════ */
  .upcoming-section {
    border-top: 1px solid var(--border-2);
    margin-top: 4px;
  }
  .upcoming-sub-header {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--fg-4);
    padding: 10px 16px 4px;
  }
  .upcoming-table {
    padding: 0 16px;
    display: flex;
    flex-direction: column;
  }

  .upcoming-head {
    display: grid;
    grid-template-columns: 1fr 32px 80px 64px;
    gap: 8px;
    padding: 0 0 8px;
    border-bottom: 1px solid var(--border-2);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-4);
    margin-bottom: 4px;
  }

  .upcoming-row {
    display: grid;
    grid-template-columns: 1fr 32px 80px 64px;
    gap: 8px;
    padding: 9px 8px;
    font-size: 12px;
    color: var(--fg-3);
    align-items: center;
    border-radius: var(--r-sm);
  }
  .upcoming-row:nth-child(even) { background: var(--surface-2); }
  .upcoming-row.upcoming-current { color: var(--fg); font-weight: 500; }
  .upcoming-row.upcoming-five { background: var(--orange-soft); }

  .upcoming-period { color: inherit; font-size: 11px; }
  .upcoming-current .upcoming-period { font-size: 12px; }
  .text-right { text-align: right; }
  .count-warn { color: var(--orange); font-weight: 700; }

  .extra-chip {
    display: inline-block;
    background: var(--orange-soft);
    border: 1px solid var(--orange-border);
    color: var(--orange);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
  }

  .savings-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px 14px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    margin-top: 4px;
    color: var(--fg);
    background: var(--bg-raised);
  }

  /* ══════════════════ CALENDAR ════════════════════════════════════════════ */
  .cal-panel { display: flex; flex-direction: column; }

  .cal-ph-left {
    display: flex !important;
    align-items: center;
    gap: 8px;
  }
  .cal-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
    letter-spacing: -0.01em;
  }
  .cal-arrow {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--fg-3);
    cursor: pointer;
    transition: all 0.13s;
    flex-shrink: 0;
  }
  .cal-arrow:hover { color: var(--fg-2); border-color: var(--border-2); background: var(--surface-2); }

  .cal-body { padding: 0 16px 4px; }

  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .cal-weekdays { margin-bottom: 6px; }
  .cal-wday {
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--fg-4);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 4px 0;
  }

  .cal-days-grid { gap: 2px; }

  .cal-day {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 5px 2px;
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: background 0.1s;
    min-height: 38px;
    position: relative;
  }
  .cal-day:hover { background: var(--surface-3); }

  /* Tooltip */
  .cal-day[data-tip]:hover::before {
    content: attr(data-tip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--surface-4);
    color: var(--fg);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    padding: 4px 9px;
    border-radius: var(--r-sm);
    border: 1px solid var(--border-2);
    box-shadow: var(--shadow-md);
    pointer-events: none;
    z-index: 10;
  }
  .cal-day[data-tip]:hover::after {
    content: '';
    position: absolute;
    bottom: calc(100% + 1px);
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--border-2);
    pointer-events: none;
    z-index: 10;
  }

  /* Selected */
  .cal-selected {
    background: var(--amber-soft) !important;
    outline: 1px solid var(--amber-border);
  }
  .cal-selected .cal-num { color: var(--amber); font-weight: 700; }

  .cal-num {
    font-size: 12px;
    font-weight: 500;
    color: var(--fg-2);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .cal-out .cal-num { color: var(--fg-4); opacity: 0.4; }

  /* Today */
  .cal-today {
    background: var(--surface-3);
    border: 1px solid var(--border-2);
  }
  .cal-today .cal-num { color: var(--fg); font-weight: 700; }

  /* Payday — 14th */
  .cal-payday { background: var(--amber-soft); }
  .cal-payday .cal-num { color: var(--amber); font-weight: 700; }

  /* Transfer Monday */
  .cal-monday { }
  .cal-monday .cal-num { color: var(--emerald); font-weight: 600; }


  /* Dots */
  .cal-dots {
    display: flex;
    gap: 2px;
    min-height: 5px;
    align-items: center;
  }
  .dot {
    width: 4px; height: 4px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot-amber   { background: var(--amber); }
  .dot-emerald { background: var(--emerald); }

  /* Legend */
  .cal-legend {
    display: flex;
    justify-content: center;
    gap: 14px;
    padding: 10px 16px 16px;
    border-top: 1px solid var(--border);
    margin-top: 8px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    color: var(--fg-4);
    font-weight: 500;
  }
  .legend-ring {
    width: 8px; height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--border-3);
    background: var(--surface-3);
    display: inline-block;
  }

  /* ══════════════════ UTILITIES ═══════════════════════════════════════════ */
  .fg-3 { color: var(--fg-3); }
  .fg-4 { color: var(--fg-4); }
  .num  { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

  /* ══════════════════ TOAST ═══════════════════════════════════════════════ */
  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--surface-2);
    border: 1px solid var(--border-2);
    color: var(--fg);
    padding: 10px 18px;
    border-radius: var(--r-md);
    font-size: 13px;
    z-index: 1000;
    box-shadow: var(--shadow-md);
    animation: slide-in 0.2s cubic-bezier(0.16,1,0.3,1), fade-out 0.3s ease 1.7s forwards;
  }
  @keyframes slide-in  { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: none; } }
  @keyframes fade-out  { to { opacity: 0; transform: translateY(4px); } }
</style>
