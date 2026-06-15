import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

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
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);

  useEffect(() => {
    let isMounted = true;
    let popup: Window | null = null;

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

        // Get a unique user ID
        const userId = `user_${Date.now()}`;
        console.log('[Plaid] Creating link token with userId:', userId);

        // Create link token
        let linkToken: string;
        try {
          linkToken = await createLinkToken(serverURL, userId);
          console.log('[Plaid] Successfully created link token');
        } catch (err) {
          console.error('[Plaid] Failed to create link token:', err);
          throw err;
        }

        // Set up postMessage listener BEFORE opening popup
        const handleMessage = async (event: MessageEvent) => {
          // Validate origin - accept same origin or localhost
          const popupOrigin = new URL(serverURL).origin;
          if (
            event.origin !== window.location.origin &&
            event.origin !== popupOrigin
          ) {
            console.warn(
              '[Plaid] Received message from untrusted origin:',
              event.origin,
            );
            return;
          }

          console.log('[Plaid] Received message:', event.data.type);

          if (event.data.type === 'plaid-link-success') {
            console.log('[Plaid] User completed Plaid Link flow');
            try {
              const publicToken = event.data.publicToken;

              // Exchange public token for access token
              const tokenData = await exchangePublicToken(
                serverURL,
                publicToken,
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
              if (isMounted) {
                dispatch(popModal());
              }
            } catch (err) {
              console.error('[Plaid] Error processing Plaid connection:', err);
              if (isMounted) {
                setError(
                  err instanceof Error
                    ? err.message
                    : t('Failed to process Plaid connection'),
                );
              }
            }
          } else if (event.data.type === 'plaid-link-error') {
            console.error('[Plaid] Error in Plaid Link:', event.data.error);
            if (isMounted) {
              setError(event.data.error || t('Plaid Link error'));
            }
          } else if (event.data.type === 'plaid-link-exit') {
            console.log('[Plaid] User exited Plaid Link');
            if (onClose && isMounted) {
              onClose();
            }
          }
        };

        window.addEventListener('message', handleMessage);

        // Open Plaid Link in a popup window.
        // app_origin is passed so the popup can target postMessage to the correct
        // origin — the main app and sync-server may be on different ports in dev.
        const plaidLinkUrl =
          `${serverURL}/plaid/link` +
          `?link_token=${encodeURIComponent(linkToken)}` +
          `&app_origin=${encodeURIComponent(window.location.origin)}`;
        console.log(
          '[Plaid] Opening popup with URL:',
          plaidLinkUrl.replace(linkToken, '[TOKEN]'),
        );

        popup = window.open(
          plaidLinkUrl,
          'PlaidLink',
          'width=500,height=700,left=100,top=100',
        );

        if (!popup) {
          throw new Error(
            t('Failed to open Plaid Link popup. Check popup blocker.'),
          );
        }

        if (isMounted) {
          setPopupWindow(popup);
          setIsLoading(false);
        }

        return () => {
          window.removeEventListener('message', handleMessage);
          if (popup && !popup.closed) {
            popup.close();
          }
        };
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
      if (popup && !popup.closed) {
        popup.close();
      }
    };
  }, [dispatch, onClose, onSuccess, serverURL, t]);

  function handleClose() {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
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
            <Trans>Opening Plaid Link...</Trans>
          </Paragraph>
        </div>
      ) : error ? (
        <div style={{ padding: '20px' }}>
          <ErrorAlert>
            <Trans>{error}</Trans>
          </ErrorAlert>
        </div>
      ) : (
        <div
          style={{
            padding: '20px',
          }}
        >
          <Paragraph>
            <Trans>
              A Plaid Link window has been opened. Complete the linking process
              in the popup window.
            </Trans>
          </Paragraph>
        </div>
      )}

      {!isLoading && (
        <ModalButtons>
          <ModalCloseButton onPress={handleClose} />
        </ModalButtons>
      )}
    </Modal>
  );
}
