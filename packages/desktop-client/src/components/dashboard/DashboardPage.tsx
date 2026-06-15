import React, { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { TransactionEntity } from '@actual-app/core/types/models';

import {
  useEnvelopeSheetValue,
  type useEnvelopeSheetName,
} from '#components/budget/envelope/EnvelopeBudgetComponents';
import { useTrackingSheetValue } from '#components/budget/tracking/TrackingBudgetComponents';
import { FinancialText } from '#components/FinancialText';
import { Page } from '#components/Page';
import { createBudgetAnalysisSpreadsheet } from '#components/reports/spreadsheets/budget-analysis-spreadsheet';
import { simpleCashFlow } from '#components/reports/spreadsheets/cash-flow-spreadsheet';
import { createSpreadsheet as netWorthSpreadsheet } from '#components/reports/spreadsheets/net-worth-spreadsheet';
import { createSpendingSpreadsheet } from '#components/reports/spreadsheets/spending-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useAccounts } from '#hooks/useAccounts';
import { useDateFormat } from '#hooks/useDateFormat';
import {
  DisplayPayeeProvider,
  useDisplayPayee,
} from '#hooks/useDisplayPayee';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import type { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useTransactions } from '#hooks/useTransactions';
import * as queries from '#queries';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { DashboardCard } from './DashboardCard';

type ReportRunner<T> = (
  spreadsheet: ReturnType<typeof useSpreadsheet>,
  setData: (data: T) => void,
) => Promise<void>;

type NetWorthReportData = {
  netWorth: number;
  totalChange: number;
};

type SpendingReportData = {
  intervalData: Array<{
    compare: number;
    compareTo: number;
  }>;
  totalTotals: number;
};

type CashFlowReportData = {
  graphData: {
    income: number;
    expense: number;
  };
};

type BudgetProgressReportData = {
  intervalData: Array<{
    balance: number;
    budgeted: number;
    overspendingAdjustment: number;
    spent: number;
  }>;
  totalBudgeted: number;
  totalSpent: number;
};

type BudgetProgressSummary = {
  budgeted: number;
  overBudget: boolean;
  progress: number;
  remaining: number;
  rows: Array<{ label: string; value: number }>;
  spent: number;
};

function emptyReport<T>(): ReportRunner<T> {
  return async () => {};
}

function formatSignedCurrency(
  value: number,
  format: (amount: unknown, type?: 'financial' | 'financial-with-sign') => string,
) {
  return format(value, 'financial-with-sign');
}

function formatProgress(progress: number) {
  return `${Math.round(progress * 100)}%`;
}

function CardEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
      {children}
    </Text>
  );
}

function MetricAmount({
  amount,
  color = theme.pageText,
  format,
}: {
  amount: number;
  color?: string;
  format: (amount: unknown, type?: 'financial' | 'financial-with-sign') => string;
}) {
  return (
    <FinancialText style={{ color, fontSize: 32, fontWeight: 700 }}>
      {format(amount, 'financial')}
    </FinancialText>
  );
}

function ProgressBar({
  color,
  progress,
}: {
  color: string;
  progress: number;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.tableBackground,
        borderRadius: 999,
        height: 8,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          backgroundColor: color,
          borderRadius: 999,
          height: '100%',
          width: `${Math.max(0, Math.min(progress, 1)) * 100}%`,
        }}
      />
    </View>
  );
}

function DetailLine({
  amount,
  amountColor = theme.pageText,
  label,
  format,
}: {
  amount: number;
  amountColor?: string;
  label: string;
  format: (amount: unknown, type?: 'financial' | 'financial-with-sign') => string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ color: theme.pageTextLight }}>{label}</Text>
      <FinancialText style={{ color: amountColor }}>
        {format(amount, 'financial')}
      </FinancialText>
    </View>
  );
}

function RecentTransactionRow({
  dateFormat,
  format,
  locale,
  transaction,
}: {
  dateFormat: string;
  format: (amount: unknown, type?: 'financial' | 'financial-with-sign') => string;
  locale: ReturnType<typeof useLocale>;
  transaction: TransactionEntity;
}) {
  const { t } = useTranslation();
  const payeeName = useDisplayPayee({ transaction });
  const isPositive = transaction.amount > 0;

  return (
    <View
      style={{
        borderBottom: '1px solid ' + theme.cardBorder,
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
        paddingBottom: 10,
      }}
    >
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {payeeName || t('No payee')}
        </Text>
        <Text style={{ color: theme.pageTextLight }}>
          {monthUtils.format(transaction.date, dateFormat, locale)}
        </Text>
      </View>
      <FinancialText
        style={{
          color: isPositive ? theme.numberPositive : theme.pageText,
          flexShrink: 0,
        }}
      >
        {format(transaction.amount, 'financial')}
      </FinancialText>
    </View>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormat();
  const locale = useLocale();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const [budgetTypePref] = useSyncedPref('budgetType');
  const [firstDayOfWeekIdxPref] = useSyncedPref('firstDayOfWeekIdx');
  const firstDayOfWeekIdx = firstDayOfWeekIdxPref || '0';
  const budgetType: 'envelope' | 'tracking' =
    budgetTypePref === 'tracking' ? 'tracking' : 'envelope';

  const { data: accounts = [] } = useAccounts();
  const activeAccounts = useMemo(
    () => accounts.filter(account => !account.closed),
    [accounts],
  );
  const hasAccounts = activeAccounts.length > 0;

  const currentMonth = monthUtils.currentMonth();
  const previousMonth = monthUtils.prevMonth(currentMonth);
  const spendingTodayIndex = Math.min(
    27,
    Math.max(monthUtils.getDay(monthUtils.currentDay()) - 1, 0),
  );

  const recentTransactionsQuery = useMemo(
    () => queries.transactions('onbudget').orderBy({ date: 'desc' }).select('*'),
    [],
  );
  const { transactions } = useTransactions({
    query: recentTransactionsQuery,
    options: { pageSize: 25 },
  });

  const recentTransactions = useMemo(
    () =>
      transactions
        .filter(
          transaction =>
            !transaction.is_child &&
            monthUtils.getMonth(transaction.date) === currentMonth,
        )
        .slice(0, 5),
    [currentMonth, transactions],
  );

  const netWorthData = useReport<NetWorthReportData>(
    'dashboard_net_worth',
    useMemo<ReportRunner<NetWorthReportData>>(
      () =>
        hasAccounts
          ? netWorthSpreadsheet(
              previousMonth,
              currentMonth,
              activeAccounts,
              [],
              'and',
              locale,
              'Monthly',
              firstDayOfWeekIdx,
              format,
            )
          : emptyReport<NetWorthReportData>(),
      [
        activeAccounts,
        currentMonth,
        firstDayOfWeekIdx,
        format,
        hasAccounts,
        locale,
        previousMonth,
      ],
    ),
  );

  const spendingData = useReport<SpendingReportData>(
    'dashboard_spending',
    useMemo<ReportRunner<SpendingReportData>>(
      () =>
        hasAccounts
          ? createSpendingSpreadsheet({
              averageRange: undefined,
              budgetType,
              compare: currentMonth,
              compareTo: previousMonth,
            })
          : emptyReport<SpendingReportData>(),
      [budgetType, currentMonth, hasAccounts, previousMonth],
    ),
  );

  const cashFlowData = useReport<CashFlowReportData>(
    'dashboard_cash_flow',
    useMemo<ReportRunner<CashFlowReportData>>(
      () =>
        hasAccounts
          ? simpleCashFlow(currentMonth, currentMonth)
          : emptyReport<CashFlowReportData>(),
      [currentMonth, hasAccounts],
    ),
  );

  const budgetProgressData = useReport<BudgetProgressReportData>(
    'dashboard_budget_progress',
    useMemo<ReportRunner<BudgetProgressReportData>>(
      () =>
        hasAccounts && budgetType === 'envelope'
          ? createBudgetAnalysisSpreadsheet({
              startDate: currentMonth + '-01',
              endDate: monthUtils.getMonthEnd(currentMonth + '-01'),
            })
          : emptyReport<BudgetProgressReportData>(),
      [budgetType, currentMonth, hasAccounts],
    ),
  );

  const availableToBudget =
    useEnvelopeSheetValue({
      name: envelopeBudget.toBudget,
      value: 0,
    }) ?? 0;
  const envelopeBudgetedRaw = useEnvelopeSheetValue(envelopeBudget.totalBudgeted);
  const envelopeSpentRaw = useEnvelopeSheetValue(envelopeBudget.totalSpent);
  const envelopeBalance = useEnvelopeSheetValue(envelopeBudget.totalBalance);

  const trackingBudgetedRaw = useTrackingSheetValue(
    trackingBudget.totalBudgetedExpense,
  );
  const trackingSpentRaw = useTrackingSheetValue(trackingBudget.totalSpent);
  const trackingLeftover = useTrackingSheetValue(trackingBudget.totalLeftover);
  const trackingSaved = useTrackingSheetValue(trackingBudget.totalSaved);

  const currentSpending = Math.abs(
    spendingData?.intervalData[spendingTodayIndex]?.compare ??
      spendingData?.totalTotals ??
      0,
  );
  const previousSpending = Math.abs(
    spendingData?.intervalData[spendingTodayIndex]?.compareTo ?? 0,
  );
  const spendingDifference = currentSpending - previousSpending;

  const income = cashFlowData?.graphData.income ?? 0;
  const expenses = Math.abs(cashFlowData?.graphData.expense ?? 0);
  const netCashFlow = income + (cashFlowData?.graphData.expense ?? 0);

  const budgetProgressSummary = useMemo<BudgetProgressSummary | null>(() => {
    if (!hasAccounts) {
      return null;
    }

    if (budgetType === 'envelope') {
      const budgeted = Math.max(
        budgetProgressData?.totalBudgeted ??
          -(envelopeBudgetedRaw ?? 0),
        0,
      );
      const spent = Math.abs(
        budgetProgressData?.totalSpent ?? envelopeSpentRaw ?? 0,
      );
      const remaining =
        budgetProgressData?.intervalData.at(-1)?.balance ?? envelopeBalance ?? 0;
      const overspendingAdjustment =
        budgetProgressData?.intervalData.at(-1)?.overspendingAdjustment ?? 0;
      const progress = budgeted > 0 ? Math.min(spent / budgeted, 1) : 0;

      return {
        budgeted,
        overBudget: spent > budgeted && budgeted > 0,
        progress,
        remaining,
        rows: [
          { label: t('Budgeted'), value: budgeted },
          { label: t('Spent'), value: spent },
          { label: t('Remaining'), value: remaining },
          {
            label: t('Overspending Adjustment'),
            value: overspendingAdjustment,
          },
        ],
        spent,
      };
    }

    const budgeted = Math.max(trackingBudgetedRaw ?? 0, 0);
    const spent = Math.max(-(trackingSpentRaw ?? 0), 0);
    const remaining = trackingLeftover ?? 0;
    const saved = trackingSaved ?? 0;
    const progress = budgeted > 0 ? Math.min(spent / budgeted, 1) : 0;

    return {
      budgeted,
      overBudget: spent > budgeted && budgeted > 0,
      progress,
      remaining,
      rows: [
        { label: t('Budgeted'), value: budgeted },
        { label: t('Spent'), value: spent },
        { label: t('Leftover'), value: remaining },
        { label: t('Saved'), value: saved },
      ],
      spent,
    };
  }, [
    budgetProgressData,
    budgetType,
    envelopeBalance,
    envelopeBudgetedRaw,
    envelopeSpentRaw,
    hasAccounts,
    t,
    trackingBudgetedRaw,
    trackingLeftover,
    trackingSaved,
    trackingSpentRaw,
  ]);

  return (
    <Page header={t('Dashboard')}>
      <View
        data-testid="dashboard-page"
        style={{
          gap: 18,
          marginTop: 12,
          paddingBottom: 40,
        }}
      >
        <View
          style={{
            backgroundColor: theme.cardBackground,
            border: '1px solid ' + theme.cardBorder,
            borderRadius: 12,
            gap: 10,
            padding: 20,
          }}
        >
          <Text
            style={{
              color: theme.pageTextSubdued,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {t('Overview')}
          </Text>
          <Text style={{ fontSize: 26, fontWeight: 700 }}>{t('This Month')}</Text>
          <Text
            style={{ color: theme.pageTextLight, lineHeight: 1.5, maxWidth: 760 }}
          >
            <Trans>
              A practical view of your budget, cash flow, and recent activity
              using the same underlying Actual data that powers the rest of the
              app.
            </Trans>
          </Text>
        </View>

        <View
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          <DashboardCard title={t('Net Worth')}>
            {hasAccounts && netWorthData ? (
              <>
                <MetricAmount amount={netWorthData.netWorth} format={format} />
                <Text
                  style={{
                    color:
                      netWorthData.totalChange >= 0
                        ? theme.numberPositive
                        : theme.numberNegative,
                  }}
                >
                  {netWorthData.totalChange >= 0
                    ? t('{{amount}} from last month', {
                        amount: formatSignedCurrency(netWorthData.totalChange, format),
                      })
                    : t('{{amount}} from last month', {
                        amount: formatSignedCurrency(netWorthData.totalChange, format),
                      })}
                </Text>
              </>
            ) : (
              <CardEmptyState>
                {hasAccounts ? t('Loading dashboard data...') : t('No accounts yet')}
              </CardEmptyState>
            )}
          </DashboardCard>

          <DashboardCard title={t('Available to Budget')}>
            {!hasAccounts ? (
              <CardEmptyState>{t('No accounts yet')}</CardEmptyState>
            ) : budgetType === 'tracking' ? (
              <CardEmptyState>
                <Trans>Tracking budgets do not use Available to Budget.</Trans>
              </CardEmptyState>
            ) : (
              <>
                <MetricAmount
                  amount={availableToBudget}
                  color={
                    availableToBudget > 0
                      ? theme.numberPositive
                      : availableToBudget < 0
                        ? theme.numberNegative
                        : theme.pageText
                  }
                  format={format}
                />
                <Text style={{ color: theme.pageTextLight }}>
                  <Trans>
                    Sourced directly from the current envelope budget month.
                  </Trans>
                </Text>
              </>
            )}
          </DashboardCard>

          <DashboardCard title={t('Monthly Spending')}>
            {recentTransactions.length === 0 && currentSpending === 0 ? (
              <CardEmptyState>{t('No transactions this month')}</CardEmptyState>
            ) : spendingData ? (
              <>
                <MetricAmount amount={currentSpending} format={format} />
                <Text
                  style={{
                    color:
                      spendingDifference > 0
                        ? theme.numberNegative
                        : spendingDifference < 0
                          ? theme.numberPositive
                          : theme.pageTextLight,
                  }}
                >
                  {spendingDifference === 0
                    ? t('In line with last month to date')
                    : spendingDifference > 0
                      ? t('{{amount}} more than last month to date', {
                          amount: format(spendingDifference, 'financial'),
                        })
                      : t('{{amount}} less than last month to date', {
                          amount: format(Math.abs(spendingDifference), 'financial'),
                        })}
                </Text>
              </>
            ) : (
              <CardEmptyState>{t('Loading dashboard data...')}</CardEmptyState>
            )}
          </DashboardCard>

          <DashboardCard title={t('Cash Flow')}>
            {recentTransactions.length === 0 && income === 0 && expenses === 0 ? (
              <CardEmptyState>{t('No transactions this month')}</CardEmptyState>
            ) : cashFlowData ? (
              <>
                <MetricAmount
                  amount={netCashFlow}
                  color={
                    netCashFlow > 0
                      ? theme.numberPositive
                      : netCashFlow < 0
                        ? theme.numberNegative
                        : theme.pageText
                  }
                  format={format}
                />
                <DetailLine
                  amount={income}
                  amountColor={theme.numberPositive}
                  format={format}
                  label={t('Income')}
                />
                <DetailLine
                  amount={expenses}
                  amountColor={theme.pageText}
                  format={format}
                  label={t('Spending')}
                />
              </>
            ) : (
              <CardEmptyState>{t('Loading dashboard data...')}</CardEmptyState>
            )}
          </DashboardCard>
        </View>

        <View
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}
        >
          <DashboardCard title={t('Recent Transactions')}>
            {recentTransactions.length > 0 ? (
              <DisplayPayeeProvider transactions={recentTransactions}>
                {recentTransactions.map(transaction => (
                  <RecentTransactionRow
                    key={transaction.id}
                    dateFormat={dateFormat}
                    format={format}
                    locale={locale}
                    transaction={transaction}
                  />
                ))}
              </DisplayPayeeProvider>
            ) : (
              <CardEmptyState>{t('No transactions this month')}</CardEmptyState>
            )}
          </DashboardCard>

          <DashboardCard title={t('Budget Progress')}>
            {budgetProgressSummary ? (
              <>
                <View style={{ gap: 8 }}>
                  <View
                    style={{
                      alignItems: 'baseline',
                      flexDirection: 'row',
                      gap: 8,
                      justifyContent: 'space-between',
                    }}
                  >
                    <FinancialText style={{ fontSize: 28, fontWeight: 700 }}>
                      {format(budgetProgressSummary.spent, 'financial')}
                    </FinancialText>
                    <Text
                      style={{
                        color: budgetProgressSummary.overBudget
                          ? theme.numberNegative
                          : theme.pageTextLight,
                      }}
                    >
                      {budgetProgressSummary.budgeted > 0
                        ? t('{{progress}} used', {
                            progress: formatProgress(budgetProgressSummary.progress),
                          })
                        : t('No budget targets yet')}
                    </Text>
                  </View>
                  <ProgressBar
                    color={
                      budgetProgressSummary.overBudget
                        ? theme.numberNegative
                        : theme.numberPositive
                    }
                    progress={budgetProgressSummary.progress}
                  />
                </View>

                {budgetProgressSummary.rows.map(row => (
                  <DetailLine
                    key={row.label}
                    amount={row.value}
                    amountColor={
                      row.value < 0 ? theme.numberNegative : theme.pageText
                    }
                    format={format}
                    label={row.label}
                  />
                ))}
              </>
            ) : (
              <CardEmptyState>{t('No budget data yet')}</CardEmptyState>
            )}
          </DashboardCard>

          <DashboardCard title={t('Can I Afford This?')}>
            {/* TODO: Layer affordability guidance on top of category balances, cash flow, and upcoming obligations instead of inventing separate financial logic. */}
            <Text style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
              <Trans>
                Check the budget first. This tool is meant for what-if purchase
                decisions that need a little judgment after the normal math is
                clear.
              </Trans>
            </Text>
            <Text style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
              <Trans>
                Category balances, cash flow, and upcoming bills should stay
                the primary source of truth.
              </Trans>
            </Text>
            <View style={{ marginTop: 'auto', flexDirection: 'row' }}>
              <Button
                variant="normal"
                onPress={() => void navigate('/can-i-afford-this')}
              >
                {t('Open')}
              </Button>
            </View>
          </DashboardCard>

          <DashboardCard title={t('Retirement Progress')}>
            {/* TODO: Connect this placeholder to future investment accounts, retirement goals, and long-range planning data after those models exist. */}
            <CardEmptyState>
              <Trans>
                Retirement tracking will appear here once investment accounts
                and long-term planning models are added.
              </Trans>
            </CardEmptyState>
          </DashboardCard>
        </View>
      </View>
    </Page>
  );
}
