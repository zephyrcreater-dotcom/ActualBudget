import React, { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, ButtonWithLoading } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { send } from '@actual-app/core/platform/client/connection';
import { isValid, parseISO } from 'date-fns';

import { useSyncedPref } from '#hooks/useSyncedPref';
import { addNotification } from '#notifications/notificationsSlice';
import { mergeSyncedPrefs } from '#prefs/prefsSlice';
import { useDispatch } from '#redux';

import { Setting } from './UI';

function isValidBudgetStartDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
}

function parseBudgetStartDate(value: string): string | null {
  const trimmedValue = value.trim();
  return isValidBudgetStartDate(trimmedValue) ? trimmedValue : null;
}

export function BudgetStartSettings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [budgetStartDate] = useSyncedPref('budgetStartDate');
  const [draftDate, setDraftDate] = useState(budgetStartDate || '');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'message' | 'error' | null>(
    null,
  );

  useEffect(() => {
    setDraftDate(budgetStartDate || '');
  }, [budgetStartDate]);

  const currentMonthStart = useMemo(
    () => monthUtils.dayFromDate(monthUtils.currentMonth()),
    [],
  );

  const validationError =
    draftDate && !isValidBudgetStartDate(draftDate)
      ? t('Enter a valid date in YYYY-MM-DD format.')
      : null;
  const parsedDraftDate = draftDate ? parseBudgetStartDate(draftDate) : null;
  const isApplyDisabled = isSaving || !draftDate || !parsedDraftDate;

  async function applyBudgetStartDate(value: string | null) {
    const rawValue = value ?? '';
    const parsedDate = rawValue ? parseBudgetStartDate(rawValue) : null;
    const action = parsedDate ? 'set' : 'clear';

    console.info('[BudgetStartSettings] apply requested', {
      inputValue: rawValue,
      parsedDate,
      action,
      message: 'budget-start/apply',
    });

    if (rawValue && !parsedDate) {
      const message = t('Enter a valid date in YYYY-MM-DD format.');
      console.warn('[BudgetStartSettings] apply blocked by invalid date', {
        inputValue: rawValue,
      });
      setStatusType('error');
      setStatusMessage(message);
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message,
          },
        }),
      );
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setStatusType(null);

    try {
      const response = await send('budget-start/apply', {
        date: parsedDate,
      });

      console.info('[BudgetStartSettings] apply response', {
        inputValue: rawValue,
        parsedDate,
        response,
      });

      if (
        response &&
        typeof response === 'object' &&
        'error' in response &&
        response.error
      ) {
        const message =
          response.error === 'invalid-date'
            ? t('Enter a valid date in YYYY-MM-DD format.')
            : t('Unable to save the budget start date right now.');

        setStatusType('error');
        setStatusMessage(message);
        dispatch(
          addNotification({
            notification: {
              type: 'error',
              message,
            },
          }),
        );
        return;
      }

      dispatch(
        mergeSyncedPrefs({
          budgetStartDate: parsedDate || undefined,
        }),
      );

      const message = parsedDate
        ? t('Budget start date saved.')
        : t('Budget start date cleared.');

      setStatusType('message');
      setStatusMessage(message);
      dispatch(
        addNotification({
          notification: {
            type: 'message',
            message,
          },
        }),
      );
    } catch (error) {
      console.error('[BudgetStartSettings] apply failed', {
        inputValue: rawValue,
        parsedDate,
        error,
      });
      const message = t('Unable to save the budget start date right now.');
      setStatusType('error');
      setStatusMessage(message);
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message,
          },
        }),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Setting
      primaryAction={
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="bare"
            onPress={() => {
              setDraftDate(currentMonthStart);
              setStatusMessage(null);
              setStatusType(null);
            }}
            isDisabled={isSaving}
          >
            <Trans>Start budgeting from this month</Trans>
          </Button>
          <ButtonWithLoading
            onPress={() => applyBudgetStartDate(draftDate)}
            isDisabled={isApplyDisabled}
            isLoading={isSaving}
          >
            <Trans>Apply</Trans>
          </ButtonWithLoading>
          {budgetStartDate && (
            <Button
              variant="bare"
              onPress={() => applyBudgetStartDate(null)}
              isDisabled={isSaving}
            >
              <Trans>Clear budget start date</Trans>
            </Button>
          )}
        </View>
      }
    >
      <Text>
        <Trans>
          Keep older imported transactions for history and reports, while only
          budgeting from a chosen date forward. Earlier transactions stay in
          account registers, but they stop counting toward uncategorized
          warnings and current budget activity.
        </Trans>
      </Text>
      <Input
        value={draftDate}
        placeholder="YYYY-MM-DD"
        inputMode="numeric"
        onChangeValue={value => {
          setDraftDate(value);
          if (statusMessage) {
            setStatusMessage(null);
            setStatusType(null);
          }
        }}
      />
      {validationError ? (
        <Text style={{ color: theme.warningText }}>{validationError}</Text>
      ) : statusMessage ? (
        <Text
          style={{
            color:
              statusType === 'error' ? theme.errorText : theme.noticeText,
          }}
        >
          {statusMessage}
        </Text>
      ) : budgetStartDate ? (
        <Text>
          <Trans>Current budget start date: {{ budgetStartDate }}</Trans>
        </Text>
      ) : (
        <Text>
          <Trans>No budget start date is set.</Trans>
        </Text>
      )}
    </Setting>
  );
}
