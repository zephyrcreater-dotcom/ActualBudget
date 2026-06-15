import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { Page } from '#components/Page';

import { DashboardCard } from './DashboardCard';

type MetricCard = {
  title: string;
  value: string;
  detail: string;
  tone: 'positive' | 'negative' | 'neutral';
};

type SimpleLine = {
  label: string;
  value: string;
};

const metricCards: MetricCard[] = [
  {
    title: 'Net Worth',
    value: '$184,250',
    detail: '+$3,200 from last month',
    tone: 'positive',
  },
  {
    title: 'Available to Budget',
    value: '$4,860',
    detail: 'Next paycheck arrives in 6 days',
    tone: 'positive',
  },
  {
    title: 'Monthly Spending',
    value: '$6,140',
    detail: '62% of your placeholder target',
    tone: 'neutral',
  },
  {
    title: 'Cash Flow',
    value: '+$1,480',
    detail: 'Income is outpacing spending this month',
    tone: 'positive',
  },
];

const recentTransactions: SimpleLine[] = [
  { label: 'Whole Foods', value: '-$126.42' },
  { label: 'Payroll Deposit', value: '+$3,250.00' },
  { label: 'Electric Bill', value: '-$142.18' },
  { label: 'Golf Galaxy', value: '-$89.00' },
];

const budgetProgress: SimpleLine[] = [
  { label: 'Essentials', value: '88% funded' },
  { label: 'Subscriptions', value: '100% funded' },
  { label: 'Travel', value: '54% funded' },
  { label: 'Emergency Fund', value: '72% funded' },
];

const retirementProgress: SimpleLine[] = [
  { label: 'Roth IRA', value: '48% of annual goal' },
  { label: '401(k)', value: 'On pace for 15% savings' },
  { label: 'Brokerage', value: '$1,250 added this quarter' },
];

const aiInsights: string[] = [
  'Dining out is trending 14% higher than your recent average.',
  'You could fully fund next month today and still keep a cash buffer.',
  'A future copilot can summarize cash flow, rollover pressure, and tradeoffs here.',
];

function metricColor(tone: MetricCard['tone']) {
  switch (tone) {
    case 'positive':
      return theme.numberPositive;
    case 'negative':
      return theme.numberNegative;
    default:
      return theme.pageText;
  }
}

export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <Page header={t('Dashboard')}>
      <View
        data-testid="dashboard-page"
        style={{
          marginTop: 12,
          paddingBottom: 40,
          gap: 18,
        }}
      >
        <View
          style={{
            background: `linear-gradient(135deg, ${theme.pageBackgroundTopLeft} 0%, ${theme.pageBackgroundBottomRight} 100%)`,
            border: '1px solid ' + theme.cardBorder,
            borderRadius: 18,
            padding: 24,
            gap: 10,
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
            {t('AI-first dashboard foundation')}
          </Text>
          <Text style={{ fontSize: 30, fontWeight: 700 }}>
            {t('Nathaniel Budget')}
          </Text>
          <Text style={{ color: theme.pageTextLight, maxWidth: 760, lineHeight: 1.5 }}>
            <Trans>
              This new landing page is a shell for future net worth, planning,
              and AI guidance while the existing budgeting workflow remains
              fully intact.
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
          {metricCards.map(card => (
            <DashboardCard key={card.title} title={t(card.title)}>
              {/* TODO: Replace metric summary values with real selectors sourced from accounts, balances, and budget state. */}
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: metricColor(card.tone),
                }}
              >
                {card.value}
              </Text>
              <Text style={{ color: theme.pageTextLight }}>{t(card.detail)}</Text>
            </DashboardCard>
          ))}
        </View>

        <View
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}
        >
          <DashboardCard title={t('Recent Transactions')}>
            {/* TODO: Swap this mock list for a recent transaction selector from the existing transaction store. */}
            {recentTransactions.map(item => (
              <View
                key={item.label + item.value}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingBottom: 8,
                  borderBottom: '1px solid ' + theme.cardBorder,
                }}
              >
                <Text>{t(item.label)}</Text>
                <Text style={{ color: item.value.startsWith('+') ? theme.numberPositive : theme.pageText }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </DashboardCard>

          <DashboardCard title={t('Budget Progress')}>
            {/* TODO: Bind these rows to envelope budgeting progress and month summary data from the existing budget page. */}
            {budgetProgress.map(item => (
              <View
                key={item.label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <Text>{t(item.label)}</Text>
                <Text style={{ color: theme.pageTextLight }}>{t(item.value)}</Text>
              </View>
            ))}
          </DashboardCard>

          <DashboardCard title={t('AI Insights')}>
            {/* TODO: Replace static prompts with responses from the future AI orchestration layer once server endpoints exist. */}
            {aiInsights.map(line => (
              <Text key={line} style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
                {t(line)}
              </Text>
            ))}
          </DashboardCard>

          <DashboardCard title={t('Retirement Progress')}>
            {/* TODO: Back these placeholders with future investment account models, retirement goals, and net worth projections. */}
            {retirementProgress.map(item => (
              <View
                key={item.label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <Text>{t(item.label)}</Text>
                <Text style={{ color: theme.pageTextLight }}>{t(item.value)}</Text>
              </View>
            ))}
          </DashboardCard>
        </View>
      </View>
    </Page>
  );
}
