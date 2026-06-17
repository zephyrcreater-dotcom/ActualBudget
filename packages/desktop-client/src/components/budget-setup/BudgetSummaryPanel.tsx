import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { format as formatDate } from 'date-fns';

import type { BudgetMath, IncomeEstimate } from './budgetSetupTypes';
import { PanelRow } from './PanelRow';

type BudgetSummaryPanelProps = {
  selectedMonth: string;
  incomeEstimate: IncomeEstimate;
  budgetMath: BudgetMath;
  unmappedRowCount: number;
  isApplying: boolean;
  formatAmount: (amount: number) => string;
  onApply: () => void;
};

export function BudgetSummaryPanel({
  selectedMonth,
  incomeEstimate,
  budgetMath,
  unmappedRowCount,
  isApplying,
  formatAmount,
  onApply,
}: BudgetSummaryPanelProps) {
  const { t } = useTranslation();
  const isNegative = budgetMath.unassigned < 0;
  const monthLabel = formatDate(
    monthUtils.parseDate(selectedMonth),
    'MMMM yyyy',
  );

  return (
    <View
      style={{
        backgroundColor: theme.pillBackground,
        border: '1px solid ' + theme.pillBorderDark,
        borderRadius: 4,
        padding: 16,
        gap: 6,
      }}
    >
      <Text style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        {t('Budget Summary')}
      </Text>

      <PanelRow
        label={t('Est. monthly income')}
        value={
          incomeEstimate.estimatedMonthly > 0
            ? formatAmount(incomeEstimate.estimatedMonthly)
            : '—'
        }
        isBold
      />

      <View
        style={{
          borderTop: '1px solid ' + theme.tableBorder,
          marginTop: 4,
          paddingTop: 4,
          gap: 4,
        }}
      >
        <PanelRow
          label={t('Fixed bills')}
          value={
            budgetMath.billsTotal > 0
              ? `− ${formatAmount(budgetMath.billsTotal)}`
              : '—'
          }
          indent
        />
        <PanelRow
          label={t('After bills')}
          value={
            budgetMath.estimatedMonthlyIncome > 0
              ? formatAmount(budgetMath.leftoverAfterBills)
              : '—'
          }
        />
      </View>

      <View
        style={{
          borderTop: '1px solid ' + theme.tableBorder,
          paddingTop: 4,
          gap: 4,
        }}
      >
        <PanelRow
          label={t('Savings')}
          value={
            budgetMath.savingsTotal > 0
              ? `− ${formatAmount(budgetMath.savingsTotal)}`
              : '—'
          }
          indent
        />
        <PanelRow
          label={t('Flexible spending')}
          value={
            budgetMath.flexibleTotal > 0
              ? `− ${formatAmount(budgetMath.flexibleTotal)}`
              : '—'
          }
          indent
        />
      </View>

      <View
        style={{
          borderTop: '2px solid ' + theme.tableBorder,
          marginTop: 4,
          paddingTop: 8,
          gap: 4,
        }}
      >
        <PanelRow
          label={t('Unassigned')}
          value={
            budgetMath.estimatedMonthlyIncome > 0
              ? formatAmount(budgetMath.unassigned)
              : '—'
          }
          isBold
          isNegative={isNegative}
        />
        {isNegative && (
          <Text
            style={{
              color: theme.errorText,
              fontSize: 11,
              lineHeight: 1.4,
            }}
          >
            <Trans>Spending plan exceeds estimated income.</Trans>
          </Text>
        )}
      </View>

      <View style={{ marginTop: 8, gap: 6 }}>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          <Trans>
            Applying to: <strong>{monthLabel}</strong>
          </Trans>
        </Text>

        {unmappedRowCount > 0 && (
          <Text style={{ color: theme.pageTextLight, fontSize: 12 }}>
            <Trans>{unmappedRowCount} unmapped row(s) will be skipped.</Trans>
          </Text>
        )}

        <ButtonWithLoading
          variant="primary"
          isLoading={isApplying}
          isDisabled={isApplying || budgetMath.estimatedMonthlyIncome === 0}
          onPress={onApply}
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
        >
          <Trans>Apply to {monthLabel}</Trans>
        </ButtonWithLoading>

        {budgetMath.estimatedMonthlyIncome === 0 && (
          <Text
            style={{
              color: theme.pageTextSubdued,
              fontSize: 11,
              textAlign: 'center',
            }}
          >
            <Trans>Select income transactions first.</Trans>
          </Text>
        )}
      </View>
    </View>
  );
}
