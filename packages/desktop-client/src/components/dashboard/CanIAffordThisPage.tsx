import React, { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { Error, Information, Warning } from '#components/alerts';
import { FormField, FormLabel } from '#components/forms';
import { Page } from '#components/Page';
import { createBudgetAnalysisSpreadsheet } from '#components/reports/spreadsheets/budget-analysis-spreadsheet';
import { simpleCashFlow } from '#components/reports/spreadsheets/cash-flow-spreadsheet';
import type { BudgetMonthCell } from '#components/reports/spreadsheets/budgetMonthCell';
import { useReport } from '#components/reports/useReport';
import { AmountInput } from '#components/util/AmountInput';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import type { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';

type PaymentMethod = 'cash-debit' | 'credit-card' | 'financing';
type Timing = 'today' | 'this-month' | 'future-month';
type ResultTone = 'green' | 'yellow' | 'red';

type ReportRunner<T> = (
  spreadsheet: ReturnType<typeof useSpreadsheet>,
  setData: (data: T) => void,
) => Promise<void>;

type CashFlowReportData = {
  graphData: {
    expense: number;
    income: number;
  };
};

type BudgetAnalysisReportData = {
  intervalData: Array<{
    balance: number;
    budgeted: number;
    overspendingAdjustment: number;
    spent: number;
  }>;
  totalBudgeted: number;
  totalSpent: number;
};

type ResultSummary = {
  title: string;
  tone: ResultTone;
  summary: string;
  reasons: string[];
};

type CategoryOption = {
  category: CategoryEntity;
  groupName: string;
  label: string;
};

const reserveNamePattern = /emergency|savings|saving|buffer|reserve|rainy day/i;

function emptyReport<T>(): ReportRunner<T> {
  return async () => {};
}

function getMonthValue(
  monthData: BudgetMonthCell[] | null,
  nameSuffix: string,
): number {
  if (!monthData) {
    return 0;
  }

  const value = monthData.find(cell => cell.name.endsWith(nameSuffix))?.value;
  return typeof value === 'number' ? value : 0;
}

function getCategoryMonthValue(
  monthData: BudgetMonthCell[] | null,
  pattern: string,
  categoryId: string,
): number {
  return getMonthValue(monthData, pattern.replace('{catId}', categoryId));
}

function getToneStyle(tone: ResultTone) {
  switch (tone) {
    case 'green':
      return {
        backgroundColor: theme.noticeBackground,
        borderColor: theme.noticeBorder,
        textColor: theme.noticeTextDark,
      };
    case 'yellow':
      return {
        backgroundColor: theme.warningBackground,
        borderColor: theme.warningBorder,
        textColor: theme.warningTextDark,
      };
    case 'red':
      return {
        backgroundColor: theme.errorBackground,
        borderColor: theme.errorBorder,
        textColor: theme.errorTextDarker,
      };
  }
}

export function CanIAffordThisPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormat();
  const locale = useLocale();
  const [budgetTypePref] = useSyncedPref('budgetType');
  const budgetType: 'envelope' | 'tracking' =
    budgetTypePref === 'tracking' ? 'tracking' : 'envelope';

  const { data: { grouped: categoryGroups = [] } = { grouped: [] } } =
    useCategories();

  const currentMonth = monthUtils.currentMonth();
  const nextMonth = monthUtils.addMonths(currentMonth, 1);

  const [purchaseName, setPurchaseName] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('cash-debit');
  const [timing, setTiming] = useState<Timing>('today');
  const [futureMonth, setFutureMonth] = useState(nextMonth);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [monthData, setMonthData] = useState<BudgetMonthCell[] | null>(null);

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    return categoryGroups
      .filter(group => !group.is_income)
      .flatMap(group =>
        (group.categories ?? [])
          .filter(category => !category.hidden)
          .map(category => ({
            category,
            groupName: group.name,
            label: `${group.name} / ${category.name}`,
          })),
      );
  }, [categoryGroups]);

  const categoryOptionsForSelect = useMemo(
    () => categoryOptions.map(option => [option.category.id, option.label] as const),
    [categoryOptions],
  );

  const selectedCategory = useMemo(
    () => categoryOptions.find(option => option.category.id === categoryId) ?? null,
    [categoryId, categoryOptions],
  );

  const targetMonth = timing === 'future-month' ? futureMonth : currentMonth;
  const targetMonthLabel = monthUtils.format(targetMonth, 'MMMM yyyy', locale);
  const purchaseImpact =
    paymentMethod === 'financing' && monthlyPayment > 0
      ? monthlyPayment
      : purchaseAmount;

  useEffect(() => {
    let cancelled = false;

    async function loadMonthData() {
      const method =
        budgetType === 'tracking'
          ? 'tracking-budget-month'
          : 'envelope-budget-month';
      const data = await send(method, { month: targetMonth });

      if (!cancelled) {
        setMonthData(data);
      }
    }

    setMonthData(null);
    void loadMonthData();

    return () => {
      cancelled = true;
    };
  }, [budgetType, targetMonth]);

  const cashFlowData = useReport<CashFlowReportData>(
    'affordability_cash_flow',
    useMemo<ReportRunner<CashFlowReportData>>(
      () => simpleCashFlow(targetMonth, targetMonth),
      [targetMonth],
    ),
  );

  const budgetAnalysisData = useReport<BudgetAnalysisReportData>(
    'affordability_budget_health',
    useMemo<ReportRunner<BudgetAnalysisReportData>>(
      () =>
        budgetType === 'envelope'
          ? createBudgetAnalysisSpreadsheet({
              startDate: targetMonth + '-01',
              endDate: monthUtils.getMonthEnd(targetMonth + '-01'),
            })
          : emptyReport<BudgetAnalysisReportData>(),
      [budgetType, targetMonth],
    ),
  );

  const result = useMemo<ResultSummary | null>(() => {
    if (!selectedCategory || purchaseImpact <= 0 || !monthData) {
      return null;
    }

    const categoryBalance = getCategoryMonthValue(
      monthData,
      'leftover-{catId}',
      selectedCategory.category.id,
    );
    const categoryRemaining = categoryBalance - purchaseImpact;
    const categoryDeficit = Math.max(0, -categoryRemaining);

    const availableToBudget =
      budgetType === 'envelope' ? getMonthValue(monthData, 'to-budget') : null;
    const availableToBudgetAfterPurchase =
      availableToBudget == null
        ? null
        : availableToBudget - Math.max(categoryDeficit, 0);

    const income = cashFlowData?.graphData.income ?? 0;
    const expenses = Math.abs(cashFlowData?.graphData.expense ?? 0);
    const netCashFlow = income - expenses;
    const remainingCashFlow = netCashFlow - purchaseImpact;

    const reserveCategories = categoryOptions.filter(option => {
      const isReserveNamed =
        reserveNamePattern.test(option.category.name) ||
        reserveNamePattern.test(option.groupName);
      return isReserveNamed;
    });

    const reserveBalance = reserveCategories.reduce((sum, option) => {
      if (option.category.id === selectedCategory.category.id) {
        return sum;
      }
      const balance = getCategoryMonthValue(
        monthData,
        'leftover-{catId}',
        option.category.id,
      );
      return balance > 0 ? sum + balance : sum;
    }, 0);

    const shortfallAfterToBudget = Math.max(
      categoryDeficit - Math.max(availableToBudget ?? 0, 0),
      0,
    );
    const selectedCategoryIsReserve =
      reserveNamePattern.test(selectedCategory.category.name) ||
      reserveNamePattern.test(selectedCategory.groupName);
    const wouldNeedReserveMove =
      shortfallAfterToBudget > 0 && reserveBalance >= shortfallAfterToBudget;
    const hasTradeoffPath =
      (availableToBudget != null && availableToBudget >= categoryDeficit) ||
      wouldNeedReserveMove;

    let tone: ResultTone;
    let title: string;

    if (categoryRemaining >= 0 && remainingCashFlow >= 0) {
      tone = 'green';
      title = t('Affordable');
    } else if (categoryRemaining >= 0 || hasTradeoffPath) {
      tone = 'yellow';
      title = t('Affordable, but a tradeoff is needed');
    } else {
      tone = 'red';
      title = t('Not affordable under the current budget');
    }

    const reasons: string[] = [];

    if (categoryRemaining >= 0) {
      reasons.push(
        t('This would leave {{category}} with {{amount}} remaining.', {
          amount: format(categoryRemaining, 'financial'),
          category: selectedCategory.category.name,
        }),
      );
    } else {
      reasons.push(
        t('This exceeds {{category}} by {{amount}}.', {
          amount: format(categoryDeficit, 'financial'),
          category: selectedCategory.category.name,
        }),
      );
    }

    if (budgetType === 'envelope') {
      if (availableToBudget != null && categoryDeficit > 0) {
        if (availableToBudget >= categoryDeficit) {
          reasons.push(
            t('You could cover the shortfall using {{amount}} from Available to Budget.', {
              amount: format(categoryDeficit, 'financial'),
            }),
          );
        } else if (availableToBudget > 0) {
          reasons.push(
            t('Available to Budget would still leave {{amount}} uncovered.', {
              amount: format(shortfallAfterToBudget, 'financial'),
            }),
          );
        } else {
          reasons.push(
            t('You would need to move money from another category to cover this.'),
          );
        }
      } else if (availableToBudgetAfterPurchase != null) {
        reasons.push(
          t('Available to Budget after this choice would be {{amount}}.', {
            amount: format(availableToBudgetAfterPurchase, 'financial'),
          }),
        );
      }
    } else if (categoryDeficit > 0) {
      reasons.push(
        t('This category would need a tradeoff elsewhere in the tracking budget.'),
      );
    }

    if (selectedCategoryIsReserve) {
      reasons.push(
        t('This purchase would come directly out of a savings or emergency category.'),
      );
    } else if (wouldNeedReserveMove) {
      reasons.push(
        t('Covering it would likely mean moving money from savings or emergency categories.'),
      );
    } else if (reserveBalance > 0 && categoryDeficit > 0) {
      reasons.push(
        t('Savings and emergency categories currently hold {{amount}} if you decide to reprioritize.', {
          amount: format(reserveBalance, 'financial'),
        }),
      );
    }

    reasons.push(
      t('{{month}} cash flow after this purchase would be {{amount}}.', {
        amount: format(remainingCashFlow, 'financial'),
        month: targetMonthLabel,
      }),
    );

    if (paymentMethod === 'credit-card') {
      reasons.push(
        t('Using a credit card changes the payment timing, but the category still needs to absorb the spending.'),
      );
    }

    if (paymentMethod === 'financing' && monthlyPayment <= 0) {
      reasons.push(
        t('No monthly payment was entered, so this is using the full purchase amount for the first pass.'),
      );
    }

    const summary =
      tone === 'green'
        ? t('The category and current budget space can absorb this purchase.')
        : tone === 'yellow'
          ? t('This can work, but only if you accept a tighter month or move money intentionally.')
          : t('Current category funds and buffer do not cover this without creating negative space.');

    return {
      title,
      tone,
      summary,
      reasons,
    };
  }, [
    budgetType,
    cashFlowData,
    categoryOptions,
    format,
    monthData,
    monthlyPayment,
    paymentMethod,
    purchaseImpact,
    selectedCategory,
    targetMonthLabel,
    t,
  ]);

  const resultStyle = result ? getToneStyle(result.tone) : null;
  const budgetHealthBalance = budgetAnalysisData?.intervalData.at(-1)?.balance ?? 0;

  return (
    <Page header={t('Can I Afford This?')}>
      <View
        style={{
          gap: 18,
          marginTop: 12,
          maxWidth: 860,
          paddingBottom: 40,
          width: '100%',
        }}
      >
        <View
          style={{
            backgroundColor: theme.cardBackground,
            border: '1px solid ' + theme.cardBorder,
            borderRadius: 12,
            gap: 12,
            padding: 20,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: 700 }}>
            {t('Affordability planning')}
          </Text>
          <Text style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
            <Trans>
              This is a math-first check based on your existing budget data.
              It does not use AI, and it does not change your budget for you.
            </Trans>
          </Text>
          <Information style={{ padding: 0 }}>
            <Trans>
              Normal budget math comes first: category balances, Available to
              Budget, and current-month cash flow. Use this to understand the
              tradeoff before you decide.
            </Trans>
          </Information>
        </View>

        <View
          style={{
            backgroundColor: theme.cardBackground,
            border: '1px solid ' + theme.cardBorder,
            borderRadius: 12,
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            padding: 20,
          }}
        >
          <FormField>
            <FormLabel htmlFor="purchase-name" title={t('Purchase name')} />
            <Input
              id="purchase-name"
              placeholder={t('Example: New driver, concert tickets, couch')}
              value={purchaseName}
              onChangeValue={setPurchaseName}
            />
          </FormField>

          <FormField>
            <FormLabel htmlFor="purchase-amount" title={t('Purchase amount')} />
            <AmountInput
              id="purchase-amount"
              value={purchaseAmount}
              zeroSign="+"
              onUpdate={setPurchaseAmount}
            />
          </FormField>

          <FormField>
            <FormLabel htmlFor="purchase-category" title={t('Category')} />
            <Select
              id="purchase-category"
              defaultLabel={t('Select a category')}
              onChange={setCategoryId}
              options={categoryOptionsForSelect}
              value={categoryId}
            />
          </FormField>

          <FormField>
            <FormLabel htmlFor="payment-method" title={t('Payment method')} />
            <Select
              id="payment-method"
              onChange={value => setPaymentMethod(value)}
              options={[
                ['cash-debit', t('Cash / debit')],
                ['credit-card', t('Credit card')],
                ['financing', t('Financing')],
              ]}
              value={paymentMethod}
            />
          </FormField>

          <FormField>
            <FormLabel htmlFor="timing" title={t('Timing')} />
            <Select
              id="timing"
              onChange={value => setTiming(value)}
              options={[
                ['today', t('Today')],
                ['this-month', t('This month')],
                ['future-month', t('Future month')],
              ]}
              value={timing}
            />
          </FormField>

          <FormField>
            <FormLabel
              htmlFor="future-month"
              title={
                timing === 'future-month' ? t('Future month') : t('Calculation month')
              }
            />
            <Select
              id="future-month"
              disabled={timing !== 'future-month'}
              onChange={setFutureMonth}
              options={monthUtils
                .rangeInclusive(currentMonth, monthUtils.addMonths(currentMonth, 11))
                .map(month => [month, monthUtils.format(month, 'MMMM yyyy', locale)] as const)}
              value={futureMonth}
            />
          </FormField>

          {paymentMethod === 'financing' && (
            <FormField>
              <FormLabel
                htmlFor="monthly-payment"
                title={t('Monthly payment (optional)')}
              />
              <AmountInput
                id="monthly-payment"
                value={monthlyPayment}
                zeroSign="+"
                onUpdate={setMonthlyPayment}
              />
            </FormField>
          )}
        </View>

        {paymentMethod === 'financing' && monthlyPayment <= 0 && (
          <Warning style={{ borderRadius: 8 }}>
            <Trans>
              Add a monthly payment to evaluate financing more realistically.
              Until then, this uses the full purchase amount.
            </Trans>
          </Warning>
        )}

        <View
          style={{
            backgroundColor: theme.cardBackground,
            border: '1px solid ' + theme.cardBorder,
            borderRadius: 12,
            gap: 14,
            padding: 20,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 700 }}>
            {t('Result for {{name}}', {
              name: purchaseName.trim() || t('this purchase'),
            })}
          </Text>

          {!categoryId || purchaseImpact <= 0 ? (
            <Information style={{ padding: 0 }}>
              <Trans>
                Enter an amount and category to see whether this purchase fits
                inside the current budget.
              </Trans>
            </Information>
          ) : !monthData || !cashFlowData ? (
            <Text style={{ color: theme.pageTextLight }}>
              {t('Loading budget data...')}
            </Text>
          ) : result && resultStyle ? (
            <>
              <View
                style={{
                  backgroundColor: resultStyle.backgroundColor,
                  border: '1px solid ' + resultStyle.borderColor,
                  borderRadius: 10,
                  color: resultStyle.textColor,
                  gap: 10,
                  padding: 16,
                }}
              >
                <Text
                  style={{
                    color: resultStyle.textColor,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  {result.title}
                </Text>
                <Text style={{ color: resultStyle.textColor, lineHeight: 1.5 }}>
                  {result.summary}
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                {result.reasons.map(reason => (
                  <Text key={reason} style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
                    {reason}
                  </Text>
                ))}
              </View>
            </>
          ) : (
            <Error style={{ borderRadius: 8 }}>
              <Trans>Something went wrong while evaluating this purchase.</Trans>
            </Error>
          )}
        </View>

        <View
          style={{
            backgroundColor: theme.cardBackground,
            border: '1px solid ' + theme.cardBorder,
            borderRadius: 12,
            gap: 12,
            padding: 20,
          }}
        >
          <Text style={{ fontWeight: 700 }}>{t('Budget context')}</Text>
          <Text style={{ color: theme.pageTextLight }}>
            {t('Calculation month: {{month}}', { month: targetMonthLabel })}
          </Text>
          {budgetType === 'envelope' ? (
            <Text style={{ color: theme.pageTextLight }}>
              {t('Budget health balance for {{month}}: {{amount}}', {
                amount: format(budgetHealthBalance, 'financial'),
                month: targetMonthLabel,
              })}
            </Text>
          ) : (
            <Text style={{ color: theme.pageTextLight }}>
              <Trans>
                Tracking budgets do not use Available to Budget, so tradeoffs
                are evaluated against category balance and recorded cash flow.
              </Trans>
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
          <Button variant="normal" onPress={() => void navigate('/dashboard')}>
            {t('Back to Dashboard')}
          </Button>
        </View>
      </View>
    </Page>
  );
}
