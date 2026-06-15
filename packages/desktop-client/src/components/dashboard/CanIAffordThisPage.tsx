import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { Page } from '#components/Page';
import { useNavigate } from '#hooks/useNavigate';

export function CanIAffordThisPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Page header={t('Can I Afford This?')}>
      <View
        style={{
          maxWidth: 760,
          width: '100%',
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
            padding: 20,
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: 700 }}>
            {t('Affordability planning')}
          </Text>
          <Text style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
            <Trans>
              This tool is intended for judgment calls and what-if scenarios
              after the normal budget has already done its job.
            </Trans>
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.cardBackground,
            border: '1px solid ' + theme.cardBorder,
            borderRadius: 12,
            padding: 20,
            gap: 12,
          }}
        >
          <Text style={{ fontWeight: 700 }}>{t('How this should work later')}</Text>
          <Text style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
            <Trans>
              Regular budget math should come first: category balances, cash
              flow, upcoming bills, and savings targets.
            </Trans>
          </Text>
          <Text style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
            <Trans>
              AI should only support judgment-based questions like whether a
              purchase fits your priorities, how it changes short-term
              flexibility, or what tradeoffs it creates.
            </Trans>
          </Text>
          <Text style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
            <Trans>
              TODO: connect this page to existing budget balances and future
              planning data before adding any AI layer.
            </Trans>
          </Text>
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
