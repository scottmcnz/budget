<script lang="ts">
  import { budget } from './store.svelte';

  const f0 = (n: number) =>
    `$${Math.round(Math.abs(n)).toLocaleString('en-NZ')}`;

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function savingsSummary(savings: { name: string; amount: number }[]): string {
    const active = savings.filter(s => s.amount > 0);
    if (active.length === 0) return '—';
    return active.map(s => `${s.name} ${f0(s.amount)}`).join(', ');
  }

  let expandedId = $state<string | null>(null);

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }
</script>

<section class="panel">
  <header class="panel-header panel-header-static">
    <div class="ph-left">
      <h2 class="panel-title">Budget History</h2>
      <span class="panel-sub">{budget.history.length} {budget.history.length === 1 ? 'month' : 'months'}</span>
    </div>
  </header>

  {#if budget.history.length === 0}
    <div class="empty-state">
      <p class="empty-title">No completed months yet</p>
      <p class="empty-hint">Mark a month complete from the Budget tab to save a snapshot here.</p>
    </div>
  {:else}
    <!-- Desktop table -->
    <div class="history-table-wrap desktop-hist">
      <table class="history-table">
        <thead>
          <tr>
            <th>Period</th>
            <th class="text-right">Take-Home</th>
            <th class="text-right">Weekly Spend</th>
            <th class="text-right">Expenses</th>
            <th>Savings</th>
            <th>Completed</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each budget.history as entry (entry.id)}
            <tr class:expanded={expandedId === entry.id}>
              <td class="period-cell">{entry.period}</td>
              <td class="text-right num">{f0(entry.takeHome)}</td>
              <td class="text-right num">{f0(entry.weeklySpend)}</td>
              <td class="text-right num">{f0(entry.totalExpenses)}</td>
              <td class="savings-cell">
                <button
                  class="savings-toggle"
                  type="button"
                  onclick={() => toggleExpand(entry.id)}
                  aria-expanded={expandedId === entry.id}
                >
                  {savingsSummary(entry.savings)}
                </button>
                {#if expandedId === entry.id}
                  <ul class="savings-detail">
                    {#each entry.savings as s}
                      <li>
                        <span>{s.name}</span>
                        <span class="num">{f0(s.amount)}</span>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </td>
              <td class="date-cell">{fmtDate(entry.completedAt)}</td>
              <td class="action-cell">
                <button
                  class="action-btn action-delete"
                  type="button"
                  onclick={() => {
                    if (confirm(`Delete history for ${entry.period}?`)) {
                      budget.removeHistoryEntry(entry.id);
                    }
                  }}
                  title="Delete entry"
                >✕</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Mobile cards -->
    <div class="mobile-hist">
      {#each budget.history as entry (entry.id)}
        <div class="hist-card" class:hist-card-expanded={expandedId === entry.id}>
          <div class="hist-card-top">
            <div class="hist-card-period">{entry.period}</div>
            <div class="hist-card-date">{fmtDate(entry.completedAt)}</div>
          </div>
          <div class="hist-card-stats">
            <div class="hist-stat">
              <span class="hist-stat-label">Take-Home</span>
              <span class="hist-stat-val num">{f0(entry.takeHome)}</span>
            </div>
            <div class="hist-stat">
              <span class="hist-stat-label">Weekly</span>
              <span class="hist-stat-val num">{f0(entry.weeklySpend)}</span>
            </div>
            <div class="hist-stat">
              <span class="hist-stat-label">Expenses</span>
              <span class="hist-stat-val num">{f0(entry.totalExpenses)}</span>
            </div>
          </div>
          <div class="hist-card-bottom">
            <button
              class="savings-toggle"
              type="button"
              onclick={() => toggleExpand(entry.id)}
              aria-expanded={expandedId === entry.id}
            >
              {savingsSummary(entry.savings)}
            </button>
            <button
              class="action-btn action-delete"
              type="button"
              onclick={() => {
                if (confirm(`Delete history for ${entry.period}?`)) {
                  budget.removeHistoryEntry(entry.id);
                }
              }}
              title="Delete entry"
            >✕</button>
          </div>
          {#if expandedId === entry.id}
            <ul class="savings-detail">
              {#each entry.savings as s}
                <li>
                  <span>{s.name}</span>
                  <span class="num">{f0(s.amount)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    gap: 12px;
  }
  .panel-header-static { cursor: default; }

  .ph-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
    letter-spacing: -0.01em;
  }
  .panel-sub {
    font-size: 12px;
    color: var(--fg-3);
  }

  .empty-state {
    padding: 48px 24px;
    text-align: center;
  }
  .empty-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-2);
    margin: 0 0 8px;
  }
  .empty-hint {
    font-size: 12px;
    color: var(--fg-4);
    margin: 0;
  }

  /* ── Desktop table ──────────────────────────────────────────────────── */
  .desktop-hist { display: block; }
  .mobile-hist  { display: none; }

  @media (max-width: 599px) {
    .desktop-hist { display: none !important; }
    .mobile-hist  { display: flex; flex-direction: column; gap: 8px; padding: 0 12px 12px; }
  }

  .history-table-wrap {
    overflow-x: auto;
    padding: 0 16px 16px;
  }

  .history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .history-table th {
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-4);
    padding: 0 8px 10px;
    border-bottom: 1px solid var(--border-2);
    white-space: nowrap;
  }

  .history-table td {
    padding: 10px 8px;
    color: var(--fg-2);
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }

  .history-table tbody tr:hover td {
    background: var(--surface-2);
  }

  .history-table tbody tr.expanded td {
    background: var(--surface-2);
  }

  .period-cell {
    font-weight: 600;
    color: var(--fg);
    white-space: nowrap;
  }

  .text-right { text-align: right; }
  .num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

  .savings-cell {
    max-width: 220px;
  }

  .savings-toggle {
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
    font-size: 12px;
    color: var(--fg-3);
    text-align: left;
    cursor: pointer;
    line-height: 1.4;
    min-height: 36px;
    display: flex;
    align-items: center;
  }
  .savings-toggle:hover { color: var(--amber); }

  .savings-detail {
    list-style: none;
    margin: 8px 0 0;
    padding: 8px;
    background: var(--surface-3);
    border-radius: var(--r-sm);
    border: 1px solid var(--border-2);
  }
  .savings-detail li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    padding: 3px 0;
    color: var(--fg-2);
  }

  .date-cell {
    white-space: nowrap;
    color: var(--fg-4);
    font-size: 12px;
  }

  .action-cell {
    width: 36px;
    text-align: right;
  }

  .action-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-3);
    padding: 6px 12px;
    border-radius: var(--r-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.13s;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .action-delete { color: var(--rose); border-color: transparent; }
  .action-delete:hover { border-color: var(--rose-border); background: var(--rose-soft); }

  /* ── Mobile cards ───────────────────────────────────────────────────── */
  .hist-card {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hist-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .hist-card-period {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg);
  }
  .hist-card-date {
    font-size: 11px;
    color: var(--fg-4);
  }
  .hist-card-stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .hist-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .hist-stat-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-4);
  }
  .hist-stat-val {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg);
  }
  .hist-card-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
</style>
