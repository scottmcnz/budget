export type TagRole = 'needs' | 'wants' | 'savings' | null;

export interface Tag {
  id: string;
  name: string;
  color: string;  // hex colour
  role: TagRole;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  tagId: string;   // references Tag.id
}

export interface Income {
  /** What hits the bank each month (after all deductions incl. KiwiSaver). */
  takeHome: number;
  /**
   * Gross salary — stored and only updated when take-home changes.
   * Changing KiwiSaver rate does NOT recalculate this; it affects take-home instead.
   */
  grossPay: number;
  kiwisaverEmployeeRate: number;  // fraction e.g. 0.06
  kiwisaverEmployerRate: number;  // fraction e.g. 0.035
  /** Weekly discretionary transfer amount — user-set round number. */
  weeklySpend: number;
  /** Override Monday count for spending pool; null = use calculated. */
  mondayCountOverride?: number | null;
}

export interface SavingsGoal {
  id: string;
  name: string;
  monthly: number;
}

export interface SpendingPortion {
  id: string;
  name: string;
  amount: number;
}

export interface Mortgage {
  propertyValue: number;
  loan: number;
  interestRate: number;     // fraction e.g. 0.0525
  minimumMonthly: number;
  extraPaymentRate: number; // fraction of minimum, e.g. 0.20
  ratesYearly: number;
  moneyIn: MoneyIn[];
}

export interface MoneyIn {
  id: string;
  label: string;
  amount: number;
}

export interface EventExpense {
  id: string;
  name: string;
  amount: number;
}

export interface EventSheet {
  id: string;
  title: string;
  splitBy: number;
  expenses: EventExpense[];
}

export interface BudgetData {
  tags: Tag[];
  income: Income;
  expenses: Expense[];
  savings: SavingsGoal[];
  spendingPortions: SpendingPortion[];
  mortgage: Mortgage;
  events: EventSheet[];
}

export interface HistoryEntry {
  id: string;
  /** Period label, e.g. "Jun 2026" */
  period: string;
  /** ISO date when the snapshot was taken */
  completedAt: string;
  takeHome: number;
  weeklySpend: number;
  totalExpenses: number;
  savings: { name: string; amount: number }[];
}
