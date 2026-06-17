import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgAdd } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';

import { AllocationRow } from './AllocationRow';
import type {
  BudgetMath,
  BudgetSetupCalculatorRowDraft,
  PlannerSectionKey,
} from './budgetSetupTypes';
import { computeRowAmount } from './budgetSetupUtils';
import { SectionCard } from './SectionCard';

type AllocationSectionProps = {
  sectionKey: PlannerSectionKey;
  title: string;
  subtitle: string;
  rows: BudgetSetupCalculatorRowDraft[];
  budgetMath: BudgetMath;
  groupOptions: Array<readonly [string, string]>;
  categoryOptions: Array<readonly [string, string]>;
  groupById: Record<string, CategoryGroupEntity>;
  categoryById: Record<string, CategoryEntity>;
  onAddRow: () => void;
  onChangeRow: (rowId: string, row: BudgetSetupCalculatorRowDraft) => void;
  onRemoveRow: (rowId: string) => void;
  formatAmount: (amount: number) => string;
};

export function AllocationSection({
  sectionKey,
  title,
  subtitle,
  rows,
  budgetMath,
  groupOptions,
  categoryOptions,
  groupById,
  categoryById,
  onAddRow,
  onChangeRow,
  onRemoveRow,
  formatAmount,
}: AllocationSectionProps) {
  const { t } = useTranslation();
  const context = {
    estimatedMonthlyIncome: budgetMath.estimatedMonthlyIncome,
    leftoverAfterBills: budgetMath.leftoverAfterBills,
    leftoverAfterSavings: budgetMath.leftoverAfterSavings,
  };

  const sectionTotal =
    sectionKey === 'bills'
      ? budgetMath.billsTotal
      : sectionKey === 'savings'
        ? budgetMath.savingsTotal
        : budgetMath.flexibleTotal;

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: theme.pageTextLight, fontSize: 12 }}>
          {sectionKey === 'bills' ? (
            <Trans>Amounts are dollar values</Trans>
          ) : (
            <Trans>Use fixed $ or % of income / leftover</Trans>
          )}
        </Text>
        <Text style={{ ...styles.tnum, fontWeight: 600 }}>
          {formatAmount(sectionTotal)}
        </Text>
      </View>

      {rows.length === 0 ? (
        <Text
          style={{ color: theme.pageTextLight, fontSize: 13, paddingTop: 4 }}
        >
          <Trans>No rows yet.</Trans>
        </Text>
      ) : (
        <View>
          {rows.map(row => (
            <AllocationRow
              key={row.id}
              row={row}
              sectionKey={sectionKey}
              computedAmount={computeRowAmount(row, context)}
              groupOptions={groupOptions}
              categoryOptions={categoryOptions}
              groupById={groupById}
              categoryById={categoryById}
              onChange={nextRow => onChangeRow(row.id, nextRow)}
              onRemove={() => onRemoveRow(row.id)}
            />
          ))}
        </View>
      )}

      <Button
        variant="bare"
        onPress={onAddRow}
        style={{ alignSelf: 'flex-start', gap: 4, marginTop: 4 }}
      >
        <SvgAdd style={{ width: 11, height: 11 }} />
        <Text style={{ fontSize: 13 }}>{<Trans>Add row</Trans>}</Text>
      </Button>
    </SectionCard>
  );
}
