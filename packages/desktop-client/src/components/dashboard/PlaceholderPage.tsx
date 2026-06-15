import React from 'react';
import type { ReactNode } from 'react';
import { Trans } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { Page } from '#components/Page';

type PlaceholderPageProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
};

export function PlaceholderPage({
  title,
  eyebrow,
  children,
}: PlaceholderPageProps) {
  return (
    <Page header={title}>
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
          <Text
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: theme.pageTextSubdued,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: 700 }}>{title}</Text>
          <Text style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
            <Trans>
              This screen is a placeholder for the Nathaniel Budget fork and is
              intentionally kept close to the existing Actual workflow.
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
          {children}
        </View>
      </View>
    </Page>
  );
}
