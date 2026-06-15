import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { SvgChatBubbleDots, SvgLightBulb } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

export function AIFinancialCopilotPanel() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <View
        style={{
          position: 'fixed',
          right: isNarrowWidth ? 12 : 24,
          bottom: isNarrowWidth ? 92 : 24,
          zIndex: 1200,
        }}
      >
        <Button
          variant="primary"
          onPress={() => setIsOpen(open => !open)}
          style={{
            borderRadius: 999,
            paddingInline: 16,
            minHeight: 46,
            boxShadow: `0 12px 28px ${theme.cardShadow}`,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <SvgChatBubbleDots style={{ width: 14, height: 14 }} />
            <Text style={{ color: theme.buttonPrimaryText, fontWeight: 700 }}>
              {t('AI Copilot')}
            </Text>
          </View>
        </Button>
      </View>

      {isOpen ? (
        <View
          style={{
            position: 'fixed',
            top: isNarrowWidth ? 12 : 20,
            right: isNarrowWidth ? 12 : 20,
            bottom: isNarrowWidth ? 12 : 20,
            width: isNarrowWidth ? 'calc(100% - 24px)' : 360,
            backgroundColor: theme.cardBackground,
            border: '1px solid ' + theme.cardBorder,
            borderRadius: 18,
            boxShadow: `0 20px 40px ${theme.cardShadow}`,
            zIndex: 1201,
            padding: 20,
            gap: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.noticeBackgroundLight,
                  color: theme.noticeTextDark,
                }}
              >
                <SvgLightBulb style={{ width: 16, height: 16 }} />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: 700 }}>
                  {t('AI Financial Copilot')}
                </Text>
                <Text style={{ color: theme.pageTextLight }}>
                  <Trans>Budget recommendations coming soon.</Trans>
                </Text>
              </View>
            </View>
            <Button variant="bare" onPress={() => setIsOpen(false)}>
              {t('Close')}
            </Button>
          </View>

          <View
            style={{
              backgroundColor: theme.pageBackground,
              borderRadius: 12,
              border: '1px solid ' + theme.cardBorder,
              padding: 16,
              gap: 12,
            }}
          >
            <Text style={{ fontWeight: 700 }}>{t('Coming soon')}</Text>
            <Text style={{ color: theme.pageTextLight }}>
              <Trans>Can I afford this purchase?</Trans>
            </Text>
            <Text style={{ color: theme.pageTextLight }}>
              <Trans>What did I spend on golf this year?</Trans>
            </Text>
            <Text style={{ color: theme.pageTextLight }}>
              <Trans>Am I on track for my Roth IRA?</Trans>
            </Text>
            <Text style={{ color: theme.pageTextLight }}>
              <Trans>Budget recommendations coming soon.</Trans>
            </Text>
          </View>

          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
            <Trans>
              This is a shell-only placeholder panel for future AI workflows. It
              should eventually connect to hosted analysis and budget context
              without changing the existing accounting engine.
            </Trans>
          </Text>
        </View>
      ) : null}
    </>
  );
}
