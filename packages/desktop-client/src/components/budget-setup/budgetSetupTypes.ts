import type { TransactionEntity } from '@actual-app/core/types/models';
import type {
  BudgetSetupAllocationMode,
  BudgetSetupCalculatorRowDraft,
} from '@actual-app/core/types/prefs';

export type { BudgetSetupAllocationMode };
export type { BudgetSetupCalculatorRowDraft };
// Legacy alias kept for old component files
export type PlannerRowDraft = BudgetSetupCalculatorRowDraft;

export type PlannerSectionKey = 'bills' | 'savings' | 'flexible';

export type CandidateInflow = TransactionEntity & {
  displayPayee: string;
  accountName: string;
  rawDescription: string;
  tags: string[];
};

export type RecurringBillSuggestion = {
  key: string;
  name: string;
  averageAmount: number;
  occurrences: number;
  confidenceLabel: string;
  lastSeenDate: string;
};

export type IncomeEstimate = {
  selectedTotal: number;
  monthsCovered: number;
  estimatedMonthly: number;
  firstDate: string;
  lastDate: string;
};

export type BudgetMath = {
  estimatedMonthlyIncome: number;
  billsTotal: number;
  savingsTotal: number;
  flexibleTotal: number;
  leftoverAfterBills: number;
  leftoverAfterSavings: number;
  unassigned: number;
};

export const NEW_GROUP_VALUE = '__new_group__';

export const DEFAULT_SAVINGS_NAMES = [
  'Roth IRA',
  'Brokerage',
  'Emergency Fund',
  'Car Fund',
  'Wedding / Travel',
];

export const DEFAULT_FLEXIBLE_NAMES = [
  'Groceries',
  'Restaurants',
  'Gas',
  'Hobbies',
  'Shopping',
  'Giving',
  'Misc',
];
