import type { BudgetData, Expense, SavingsGoal, SpendingPortion, EventSheet, EventExpense, MoneyIn, Tag, HistoryEntry } from './types';

const STORAGE_KEY = 'budget-data-v8';
const HISTORY_STORAGE_KEY = 'budget-history-v1';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── NZ PAYE calculator (tax code M, no student loan) ────────────────────────

export function calcNZPAYE(annualGross: number): number {
  return (
    Math.min(annualGross, 14_000) * 0.105 +
    Math.max(0, Math.min(annualGross, 48_000) - 14_000) * 0.175 +
    Math.max(0, Math.min(annualGross, 70_000) - 48_000) * 0.30 +
    Math.max(0, Math.min(annualGross, 180_000) - 70_000) * 0.33 +
    Math.max(0, annualGross - 180_000) * 0.39
  );
}

// 2026/27 ACC earner levy rate: 1.75% (verified from May 2026 payslip)
export function calcNZACC(annualGross: number): number {
  return Math.min(annualGross, 142_283) * 0.0175;
}

/**
 * Reverse-calculate gross from a known take-home (bank deposit after all deductions).
 * Solves: gross - PAYE(gross×12)/12 - ACC(gross×12)/12 - gross×ksRate = takeHome
 * This result is stored in income.grossPay and only re-run when take-home changes,
 * NOT when KiwiSaver rate changes (gross is a contracted salary, not affected by ksRate).
 */
export function reverseCalcGross(takeHome: number, ksEmployeeRate: number): number {
  if (!takeHome || isNaN(takeHome) || takeHome <= 0) return 0;
  let lo = 0, hi = 500_000;
  for (let i = 0; i < 80; i++) {
    const g  = (lo + hi) / 2;
    const th = g - calcNZPAYE(g * 12) / 12 - calcNZACC(g * 12) / 12 - g * ksEmployeeRate;
    if (th < takeHome) lo = g; else hi = g;
  }
  return (lo + hi) / 2;
}

// ─── Default tags ─────────────────────────────────────────────────────────────

const TAG_FIXED      = uid();
const TAG_VARIABLE   = uid();
const TAG_LIFESTYLE  = uid();
const TAG_SAVINGS    = uid();

const DEFAULT_TAGS: Tag[] = [
  { id: TAG_FIXED,     name: 'Fixed',     color: '#60a5fa' },
  { id: TAG_VARIABLE,  name: 'Variable',  color: '#fb923c' },
  { id: TAG_LIFESTYLE, name: 'Lifestyle', color: '#34d399' },
  { id: TAG_SAVINGS,   name: 'Savings',   color: '#c084fc' },
];

const DEFAULT_DATA: BudgetData = {
  tags: DEFAULT_TAGS,
  income: {
    takeHome: 0,
    grossPay: 0,
    kiwisaverEmployeeRate: 0.03,
    kiwisaverEmployerRate: 0.03,
    weeklySpend: 0,
  },
  expenses: [],
  savings: [],
  spendingPortions: [],
  mortgage: {
    propertyValue: 0,
    loan: 0,
    interestRate: 0,
    minimumMonthly: 0,
    extraPaymentRate: 0,
    ratesYearly: 0,
    moneyIn: [],
  },
  events: [],
};

function loadData(): BudgetData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as BudgetData;
      return { ...data, spendingPortions: data.spendingPortions ?? [] };
    }
  } catch { /* ignore */ }
  return structuredClone(DEFAULT_DATA);
}

function saveData(data: BudgetData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as HistoryEntry[];
  } catch { /* ignore */ }
  return [];
}

function saveHistory(history: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
}

const MON_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function currentPeriodLabel(): string {
  const now = new Date();
  const start = now.getDate() >= 14
    ? new Date(now.getFullYear(), now.getMonth(), 14)
    : (() => {
        const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return new Date(py, pm, 14);
      })();
  return `${MON_NAMES[start.getMonth()]} ${start.getFullYear()}`;
}

// ─── Reactive store ──────────────────────────────────────────────────────────

class BudgetStore {
  data = $state<BudgetData>(loadData());
  history = $state<HistoryEntry[]>(loadHistory());

  // ── Income derived ────────────────────────────────────────────────────────

  /**
   * Gross salary — stored, calculated from take-home when take-home changes.
   * Does NOT change when KiwiSaver rate changes (gross is your contracted salary).
   */
  get grossPay() {
    return this.data.income.grossPay;
  }
  get calcPAYE() {
    return calcNZPAYE(this.grossPay * 12) / 12;
  }
  get calcACC() {
    return calcNZACC(this.grossPay * 12) / 12;
  }
  get kiwisaverEmployee() {
    return this.grossPay * this.data.income.kiwisaverEmployeeRate;
  }
  get kiwisaverEmployer() {
    return this.grossPay * this.data.income.kiwisaverEmployerRate;
  }
  get takeHome() {
    return this.data.income.takeHome;
  }
  /**
   * What should hit the bank given current gross + deduction rates.
   * Changes when KiwiSaver rate changes (gross stays fixed).
   */
  get impliedBankDeposit() {
    return this.grossPay - this.calcPAYE - this.calcACC - this.kiwisaverEmployee;
  }

  // ── Expense derived ───────────────────────────────────────────────────────

  get totalExpenses() {
    return this.data.expenses.reduce((s, e) => s + e.amount, 0);
  }
  get totalSavings() {
    return this.data.savings.reduce((s, g) => s + g.monthly, 0);
  }
  get totalSpendingPortions() {
    return this.data.spendingPortions.reduce((s, p) => s + p.amount, 0);
  }
  get mortgageMonthly() {
    return this.data.mortgage.minimumMonthly * (1 + this.data.mortgage.extraPaymentRate);
  }
  get ratesMonthly() {
    return this.data.mortgage.ratesYearly / 12;
  }
  get totalOutgoings() {
    return this.totalExpenses + this.mortgageMonthly + this.totalSavings;
  }
  get remaining() {
    return this.takeHome - this.totalOutgoings;
  }
  get fourWeekSpend() {
    return (this.totalExpenses / 30) * 28;
  }

  // ── Allocation breakdown (for Budget Health) ───────────────────────────────

  get expensesByCategory() {
    const needs = this.data.expenses
      .filter(e => {
        const tag = this.tagById(e.tagId);
        return tag?.name === 'Fixed' || tag?.name === 'Variable';
      })
      .reduce((s, e) => s + e.amount, 0);
    const wants = this.data.expenses
      .filter(e => this.tagById(e.tagId)?.name === 'Lifestyle')
      .reduce((s, e) => s + e.amount, 0);
    return { needs, wants };
  }

  // ── Mortgage derived ──────────────────────────────────────────────────────

  get equity() {
    return this.data.mortgage.propertyValue - this.data.mortgage.loan;
  }
  get equityPct() {
    return this.equity / this.data.mortgage.propertyValue;
  }
  get equityTarget() {
    return this.data.mortgage.propertyValue * 0.20;
  }
  get lepRemaining() {
    return Math.max(0, this.equityTarget - this.equity);
  }

  // ── Tag helpers ───────────────────────────────────────────────────────────

  tagById(id: string): Tag | undefined {
    return this.data.tags.find(t => t.id === id);
  }

  addTag(name: string, color: string) {
    this.data.tags = [...this.data.tags, { id: uid(), name: name.trim(), color }];
    this.persist();
  }
  updateTag(id: string, patch: Partial<Omit<Tag, 'id'>>) {
    this.data.tags = this.data.tags.map(t => t.id === id ? { ...t, ...patch } : t);
    this.persist();
  }
  removeTag(id: string) {
    // reassign expenses using this tag to the first available tag
    const fallback = this.data.tags.find(t => t.id !== id)?.id ?? '';
    this.data.expenses = this.data.expenses.map(e =>
      e.tagId === id ? { ...e, tagId: fallback } : e
    );
    this.data.tags = this.data.tags.filter(t => t.id !== id);
    this.persist();
  }

  // ── Expense CRUD ──────────────────────────────────────────────────────────

  addExpense(partial: Omit<Expense, 'id'>) {
    this.data.expenses = [...this.data.expenses, { id: uid(), ...partial }];
    this.persist();
  }
  updateExpense(id: string, patch: Partial<Omit<Expense, 'id'>>) {
    this.data.expenses = this.data.expenses.map(e =>
      e.id === id ? { ...e, ...patch } : e
    );
    this.persist();
  }
  removeExpense(id: string) {
    this.data.expenses = this.data.expenses.filter(e => e.id !== id);
    this.persist();
  }

  // ── Income ────────────────────────────────────────────────────────────────

  updateIncome(patch: Partial<typeof this.data.income>) {
    this.data.income = { ...this.data.income, ...patch };
    this.persist();
  }
  setTakeHome(value: number) {
    if (value > 0) {
      const newGross = reverseCalcGross(value, this.data.income.kiwisaverEmployeeRate);
      this.data.income = { ...this.data.income, takeHome: value, grossPay: newGross };
      this.persist();
    }
  }

  // ── Savings CRUD ──────────────────────────────────────────────────────────

  addSavingsGoal(partial: Omit<SavingsGoal, 'id'>) {
    this.data.savings = [...this.data.savings, { id: uid(), ...partial }];
    this.persist();
  }
  updateSavingsGoal(id: string, patch: Partial<Omit<SavingsGoal, 'id'>>) {
    this.data.savings = this.data.savings.map(g =>
      g.id === id ? { ...g, ...patch } : g
    );
    this.persist();
  }
  removeSavingsGoal(id: string) {
    this.data.savings = this.data.savings.filter(g => g.id !== id);
    this.persist();
  }

  // ── Spending portion CRUD ─────────────────────────────────────────────────

  addSpendingPortion(partial: Omit<SpendingPortion, 'id'>) {
    this.data.spendingPortions = [...this.data.spendingPortions, { id: uid(), ...partial }];
    this.persist();
  }
  updateSpendingPortion(id: string, patch: Partial<Omit<SpendingPortion, 'id'>>) {
    this.data.spendingPortions = this.data.spendingPortions.map(p =>
      p.id === id ? { ...p, ...patch } : p
    );
    this.persist();
  }
  removeSpendingPortion(id: string) {
    this.data.spendingPortions = this.data.spendingPortions.filter(p => p.id !== id);
    this.persist();
  }

  // ── Mortgage CRUD ─────────────────────────────────────────────────────────

  updateMortgage(patch: Partial<typeof this.data.mortgage>) {
    this.data.mortgage = { ...this.data.mortgage, ...patch };
    this.persist();
  }
  addMoneyIn(partial: Omit<MoneyIn, 'id'>) {
    this.data.mortgage.moneyIn = [...this.data.mortgage.moneyIn, { id: uid(), ...partial }];
    this.persist();
  }
  removeMoneyIn(id: string) {
    this.data.mortgage.moneyIn = this.data.mortgage.moneyIn.filter(m => m.id !== id);
    this.persist();
  }

  // ── Event CRUD ────────────────────────────────────────────────────────────

  addEvent(title: string) {
    this.data.events = [...this.data.events, { id: uid(), title, splitBy: 1, expenses: [] }];
    this.persist();
  }
  updateEvent(id: string, patch: Partial<Omit<EventSheet, 'id' | 'expenses'>>) {
    this.data.events = this.data.events.map(ev =>
      ev.id === id ? { ...ev, ...patch } : ev
    );
    this.persist();
  }
  removeEvent(id: string) {
    this.data.events = this.data.events.filter(ev => ev.id !== id);
    this.persist();
  }
  addEventExpense(eventId: string, partial: Omit<EventExpense, 'id'>) {
    this.data.events = this.data.events.map(ev =>
      ev.id === eventId
        ? { ...ev, expenses: [...ev.expenses, { id: uid(), ...partial }] }
        : ev
    );
    this.persist();
  }
  updateEventExpense(eventId: string, expId: string, patch: Partial<Omit<EventExpense, 'id'>>) {
    this.data.events = this.data.events.map(ev =>
      ev.id === eventId
        ? { ...ev, expenses: ev.expenses.map(e => e.id === expId ? { ...e, ...patch } : e) }
        : ev
    );
    this.persist();
  }
  removeEventExpense(eventId: string, expId: string) {
    this.data.events = this.data.events.map(ev =>
      ev.id === eventId
        ? { ...ev, expenses: ev.expenses.filter(e => e.id !== expId) }
        : ev
    );
    this.persist();
  }

  // ── Reset / export ────────────────────────────────────────────────────────

  completeMonth(expensesOverride?: number): HistoryEntry {
    const totalExpenses = expensesOverride ?? this.totalExpenses;
    const entry: HistoryEntry = {
      id: uid(),
      period: currentPeriodLabel(),
      completedAt: new Date().toISOString(),
      takeHome: this.takeHome,
      weeklySpend: this.data.income.weeklySpend,
      totalExpenses,
      savings: this.data.savings.map(g => ({ name: g.name, amount: g.monthly })),
    };
    this.history = [entry, ...this.history];
    this.persistHistory();
    return entry;
  }

  removeHistoryEntry(id: string) {
    this.history = this.history.filter(h => h.id !== id);
    this.persistHistory();
  }

  resetToDefaults() {
    this.data = structuredClone(DEFAULT_DATA);
    this.persist();
  }

  copyTextSummary() {
    const f = (n: number) => `$${n.toFixed(2)}`;
    const lines = [
      '── Monthly Budget Summary ──',
      `Gross (calc):    ${f(this.grossPay)}`,
      `Take home:       ${f(this.takeHome)}`,
      '',
      '── Expenses ──',
      ...this.data.expenses.map(e => `  ${e.name.padEnd(28)} ${f(e.amount)}`),
      `  ${'Total'.padEnd(28)} ${f(this.totalExpenses)}`,
      '',
      '── Savings ──',
      ...this.data.savings.map(g => `  ${g.name.padEnd(28)} ${f(g.monthly)}/mo`),
      `  ${'Total'.padEnd(28)} ${f(this.totalSavings)}/mo`,
      '',
      `── Mortgage (monthly)        ${f(this.mortgageMonthly)} ──`,
      `Remaining:       ${f(this.remaining)}`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  }

  private persist() {
    saveData(this.data);
  }

  private persistHistory() {
    saveHistory(this.history);
  }
}

export const budget = new BudgetStore();
