import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgCheveronDown,
  SvgCheveronRight,
  SvgTrash,
} from '@actual-app/components/icons/v1';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { tokens } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { FinancialInput } from '#components/util/FinancialInput';

import { NEW_GROUP_VALUE } from './budgetSetupTypes';
import type {
  BudgetSetupAllocationMode,
  BudgetSetupCalculatorRowDraft,
  PlannerSectionKey,
} from './budgetSetupTypes';
import {
  getCategoryLabel,
  getGroupLabel,
  normalizeAmount,
} from './budgetSetupUtils';

type AllocationRowProps = {
  row: BudgetSetupCalculatorRowDraft;
  sectionKey: PlannerSectionKey;
  computedAmount: number;
  groupOptions: Array<readonly [string, string]>;
  categoryOptions: Array<readonly [string, string]>;
  groupById: Record<string, CategoryGroupEntity>;
  categoryById: Record<string, CategoryEntity>;
  onChange: (row: BudgetSetupCalculatorRowDraft) => void;
  onRemove: () => void;
};

const PCT_MODE_OPTIONS: Array<[BudgetSetupAllocationMode, string]> = [
  ['fixed', '$ fixed'],
  ['pct-income', '% of income'],
  ['pct-leftover', '% after bills'],
  ['pct-remaining', '% of remainder'],
];

const BILL_NAME_PLACEHOLDER = 'Rent, insurance, phone...';
const SAVINGS_NAME_PLACEHOLDER = 'Goal name';
const FLEXIBLE_NAME_PLACEHOLDER = 'Groceries, gas, restaurants...';

export function AllocationRow({
  row,
  sectionKey,
  computedAmount,
  groupOptions,
  categoryOptions,
  groupById,
  categoryById,
  onChange,
  onRemove,
}: AllocationRowProps) {
  const { t } = useTranslation();
  const mode = row.amountMode || 'fixed';
  const isMapped = !!(row.categoryId || row.groupId);
  const categoryLabel = getCategoryLabel(row, categoryById, groupById);
  const namePlaceholder =
    sectionKey === 'bills'
      ? BILL_NAME_PLACEHOLDER
      : sectionKey === 'savings'
        ? SAVINGS_NAME_PLACEHOLDER
        : FLEXIBLE_NAME_PLACEHOLDER;

  return (
    <View
      style={{
        borderBottom: '1px solid ' + theme.tableBorder,
        paddingTop: 8,
        paddingBottom: 8,
        gap: 6,
      }}
    >
      {/* Main row: name + amount + delete */}
      <View
        className={css({
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          [`@media (min-width: ${tokens.breakpoint_small})`]: {
            flexWrap: 'nowrap',
          },
        })}
      >
        <Input
          value={row.name}
          placeholder={namePlaceholder}
          onChangeValue={value => onChange({ ...row, name: value })}
          style={{ flex: '1 1 140px', minWidth: 100 }}
        />

        {sectionKey !== 'bills' && (
          <Select<BudgetSetupAllocationMode>
            value={mode}
            options={PCT_MODE_OPTIONS}
            onChange={value =>
              onChange({
                ...row,
                amountMode: value,
                amountPct: row.amountPct || 0,
              })
            }
            style={{ flex: '0 0 130px' }}
          />
        )}

        {mode === 'fixed' ? (
          <FinancialInput
            value={row.amount}
            onUpdate={v => onChange({ ...row, amount: normalizeAmount(v) })}
            onChangeValue={v =>
              onChange({ ...row, amount: normalizeAmount(v) })
            }
            style={{ flex: '0 0 100px' }}
          />
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              flex: '0 0 auto',
            }}
          >
            <Input
              value={String(row.amountPct || '')}
              placeholder="0"
              onChangeValue={v => {
                const parsed = parseFloat(v);
                onChange({
                  ...row,
                  amountPct: isNaN(parsed)
                    ? 0
                    : Math.min(100, Math.max(0, parsed)),
                });
              }}
              style={{ width: 56, textAlign: 'right' }}
            />
            <Text style={{ color: theme.pageTextLight }}>%</Text>
            {computedAmount > 0 && (
              <Text
                style={{
                  color: theme.pageTextSubdued,
                  fontSize: 12,
                  marginLeft: 2,
                }}
              >
                ≈ ${(computedAmount / 100).toFixed(0)}
              </Text>
            )}
          </View>
        )}

        {sectionKey === 'bills' && (
          <Input
            value={row.dueDate || ''}
            placeholder={t('Due date')}
            onChangeValue={v => onChange({ ...row, dueDate: v })}
            style={{ flex: '0 0 90px', fontSize: 12 }}
          />
        )}

        <Button
          variant="bare"
          onPress={onRemove}
          aria-label={t('Remove row')}
          style={{ flexShrink: 0, padding: '2px 4px' }}
        >
          <SvgTrash
            style={{ width: 13, height: 13, color: theme.pageTextSubdued }}
          />
        </Button>
      </View>

      {/* Category mapping toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Button
          variant="bare"
          onPress={() =>
            onChange({ ...row, categoryMappingOpen: !row.categoryMappingOpen })
          }
          style={{
            padding: '1px 0',
            gap: 3,
            color: theme.pageTextLight,
            fontSize: 12,
          }}
        >
          {row.categoryMappingOpen ? (
            <SvgCheveronDown style={{ width: 10, height: 10 }} />
          ) : (
            <SvgCheveronRight style={{ width: 10, height: 10 }} />
          )}
          {isMapped ? (
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              {categoryLabel ?? t('Mapped')}
            </Text>
          ) : (
            <Text style={{ color: theme.pageTextLight, fontSize: 12 }}>
              <Trans>Map to category (optional)</Trans>
            </Text>
          )}
        </Button>
      </View>

      {/* Expanded category mapping */}
      {row.categoryMappingOpen && (
        <View
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingLeft: 16,
            [`@media (min-width: ${tokens.breakpoint_small})`]: {
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
            },
          })}
        >
          <Select
            value={row.groupId || ''}
            defaultLabel={t('Select group')}
            options={[
              ['', t('Select group')],
              ...groupOptions,
              [NEW_GROUP_VALUE, t('+ Create new group')],
            ]}
            onChange={value =>
              onChange({
                ...row,
                groupId: value || null,
                newGroupName:
                  value === NEW_GROUP_VALUE ? row.newGroupName || '' : '',
                categoryId: value === NEW_GROUP_VALUE ? null : row.categoryId,
              })
            }
            style={{ flex: '1 1 140px', minWidth: 120 }}
          />
          <Select
            value={row.categoryId || ''}
            defaultLabel={t('Create from name')}
            options={[['', t('Create from name')], ...categoryOptions]}
            onChange={value =>
              onChange({
                ...row,
                categoryId: value || null,
                groupId:
                  value && categoryById[value]
                    ? categoryById[value].group
                    : row.groupId,
                newGroupName:
                  value && categoryById[value] ? '' : row.newGroupName,
              })
            }
            style={{ flex: '1 1 160px', minWidth: 130 }}
          />
          {row.groupId === NEW_GROUP_VALUE && (
            <Input
              value={row.newGroupName || ''}
              placeholder={t('New group name')}
              onChangeValue={v => onChange({ ...row, newGroupName: v })}
              style={{ flex: '1 1 140px', minWidth: 120 }}
            />
          )}
        </View>
      )}
    </View>
  );
}
