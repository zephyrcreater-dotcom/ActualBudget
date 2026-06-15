import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Paragraph } from '@actual-app/components/paragraph';
import type { SyncServerPlaidAccount } from '@actual-app/core/types/models/plaid';

import { Error as ErrorAlert } from '#components/alerts';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '#components/common/Modal';
import { useServerURL } from '#components/ServerContext';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { popModal } from '#modals/modalsSlice';
import { createLinkToken, exchangePublicToken, getPlaidAccounts } from '#plaid';
import { useDispatch } from '#redux';

type PlaidLinkProps = Extract<ModalType, { name: 'plaid-link' }>['options'];

export function PlaidLinkModal({ onSuccess, onClose }: PlaidLinkProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const serverURL = useServerURL();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function initiatePlaidLink() {
      try {
        if (!serverURL) {
          if (isMounted) {
            setError(t('Sync server not configured'));
            setIsLoading(false);
          }
          return;
        }

        setIsLoading(true);
        setError(null);

        // Get a unique user ID (use timestamp for now)
        const userId = `user_${Date.now()}`;

        // Create link token
        const linkToken = await createLinkToken(serverURL, userId);

        // Load Plaid Link script
        const script = document.createElement('script');
        script.src = 'https://cdn.plaid.com/link/v3/stable/link-initialize.js';
        script.onload = () => {
          if (!isMounted) return;

          // Initialize Plaid Link
          if (typeof window !== 'undefined' && (window as any).Plaid) {
            const handler = (window as any).Plaid.create({
              token: linkToken,
              onSuccess: async (public_token: string) => {
                try {
                  // Exchange public token for access token
                  const tokenData = await exchangePublicToken(
                    serverURL,
                    public_token,
                  );

                  // Get Plaid accounts for this item
                  const accounts = await getPlaidAccounts(
                    serverURL,
                    tokenData.itemId,
                  );

                  // Call success handler
                  await onSuccess({
                    accounts,
                    itemId: tokenData.itemId,
                    institutionId: tokenData.institutionId,
                    institutionName: tokenData.institutionName,
                  });

                  // Close modal
                  dispatch(popModal());
                } catch (err) {
                  if (isMounted) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : t('Failed to process Plaid connection'),
                    );
                  }
                }
              },
              onExit: () => {
                if (onClose) {
                  onClose();
                }
              },
            });

            handler.open();
          }
        };

        script.onerror = () => {
          if (isMounted) {
            setError(t('Failed to load Plaid Link'));
            setIsLoading(false);
          }
        };

        document.body.appendChild(script);
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : t('Failed to initialize Plaid Link'),
          );
          setIsLoading(false);
        }
      }
    }

    void initiatePlaidLink();

    return () => {
      isMounted = false;
    };
  }, [dispatch, onClose, onSuccess, serverURL, t]);

  function handleClose() {
    if (onClose) {
      onClose();
    }
    dispatch(popModal());
  }

  return (
    <Modal name="plaid-link">
      <ModalHeader title={t('Link Plaid Account')} />

      {isLoading ? (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <Paragraph>
            <Trans>Initializing Plaid Link...</Trans>
          </Paragraph>
        </div>
      ) : error ? (
        <div style={{ padding: '20px' }}>
          <ErrorAlert>
            <Trans>{error}</Trans>
          </ErrorAlert>
        </div>
      ) : null}

      {!isLoading && (
        <ModalButtons>
          <ModalCloseButton onPress={handleClose} />
        </ModalButtons>
      )}
    </Modal>
  );
}
