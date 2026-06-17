import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';

import { Setting } from './UI';

type RepairResult = {
  accountName: string;
  plaidAccountId: string;
  plaidType: string;
  plaidSubtype: string | null;
  balanceCurrent: number | null;
  targetBalance: number | null;
  oldStarting: number | null;
  newStarting: number | null;
  finalBalance: number | null;
  status: 'repaired' | 'skipped' | 'no_balance' | 'error';
  reason?: string;
};

function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  return (cents / 100).toFixed(2);
}

export function RepairPlaidBalances() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RepairResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRepair() {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await send('plaid-repair-balances');
      setResults(res as RepairResult[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const statusColor = (status: RepairResult['status']) => {
    switch (status) {
      case 'repaired':
        return theme.noticeTextLight;
      case 'no_balance':
        return theme.warningText;
      case 'error':
        return theme.errorText;
      default:
        return theme.pageTextSubdued;
    }
  };

  return (
    <Setting
      primaryAction={
        <View
          style={{
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '1em',
          }}
        >
          <ButtonWithLoading isLoading={loading} onPress={onRepair}>
            <Trans>Repair Plaid account balances</Trans>
          </ButtonWithLoading>

          {error && (
            <Text style={{ color: theme.errorText, whiteSpace: 'pre-wrap' }}>
              {t('Error: {{error}}', { error })}
            </Text>
          )}

          {results && results.length === 0 && (
            <Text style={{ color: theme.pageTextSubdued }}>
              <Trans>No Plaid-linked accounts found.</Trans>
            </Text>
          )}

          {results && results.length > 0 && (
            <View
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                width: '100%',
              }}
            >
              {results.map(r => (
                <View
                  key={r.accountName + r.plaidAccountId}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: statusColor(r.status),
                    whiteSpace: 'pre-wrap',
                    padding: '4px 8px',
                    backgroundColor: theme.tableBackground,
                    borderRadius: 4,
                    border: `1px solid ${theme.tableBorder}`,
                  }}
                >
                  {[
                    `${r.status.toUpperCase().padEnd(10)} ${r.accountName}`,
                    `  plaid_id:     ${r.plaidAccountId}`,
                    `  type:         ${r.plaidType}${r.plaidSubtype ? `/${r.plaidSubtype}` : ''}`,
                    `  current:      $${formatCents(r.balanceCurrent)}`,
                    `  target:       $${formatCents(r.targetBalance)}  (Actual cents)`,
                    r.oldStarting !== null
                      ? `  old start:    $${formatCents(r.oldStarting)}`
                      : null,
                    r.newStarting !== null
                      ? `  new start:    $${formatCents(r.newStarting)}`
                      : null,
                    r.finalBalance !== null
                      ? `  final bal:    $${formatCents(r.finalBalance)}`
                      : null,
                    r.reason ? `  reason:       ${r.reason}` : null,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </View>
              ))}
            </View>
          )}
        </View>
      }
    >
      <Trans>
        <Text>
          <strong>Repair Plaid account balances</strong> fetches the current
          balance for each Plaid-linked account directly from Plaid
          (accountsGet) and adjusts the starting-balance transaction so the
          displayed balance matches. Use this if balances show 0.00 or are
          otherwise incorrect after a Bank Sync. Transactions are never deleted
          or modified — only the starting-balance transaction is updated.
        </Text>
      </Trans>
    </Setting>
  );
}
