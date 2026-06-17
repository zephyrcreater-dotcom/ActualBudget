import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Paragraph } from '@actual-app/components/paragraph';

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
import {
  checkPopupResult,
  createLinkToken,
  exchangePublicToken,
  getPlaidAccounts,
} from '#plaid';
import { useDispatch } from '#redux';

type PlaidLinkProps = Extract<ModalType, { name: 'plaid-link' }>['options'];

// Discrete states for the modal UI. 'exchanging-token' and 'fetching-accounts'
// are both shown as a "connecting" spinner — they're separate so logs are precise.
type Status =
  | 'opening' // Creating link token, opening popup
  | 'waiting-for-user' // Popup is open, user is in Plaid flow
  | 'exchanging-token' // Got public_token, calling /exchange-public-token
  | 'fetching-accounts' // Got itemId, calling /get-plaid-accounts
  | 'cancelled' // User exited Plaid without completing
  | 'error';

export function PlaidLinkModal({ onSuccess, onClose }: PlaidLinkProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const serverURL = useServerURL();
  const [status, setStatus] = useState<Status>('opening');
  const [error, setError] = useState<string | null>(null);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  // Ref so poll closure always sees the latest value without stale captures.
  const resultProcessedRef = useRef(false);
  const outerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    let popup: Window | null = null;
    let initInterval: ReturnType<typeof setInterval> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function stopIntervals() {
      if (initInterval !== null) {
        clearInterval(initInterval);
        initInterval = null;
      }
      if (pollInterval !== null) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }

    async function processSuccess(
      publicToken: string,
      institutionId?: string,
      institutionName?: string,
    ) {
      if (resultProcessedRef.current || !isMounted) return;
      resultProcessedRef.current = true;
      stopIntervals();

      const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;
      const t0 = Date.now();
      let timedOut = false;

      // Safety net: callSyncServer has its own 35s AbortController per request,
      // but this outer timer guarantees the UI never hangs beyond 75s regardless.
      outerTimerRef.current = setTimeout(() => {
        timedOut = true;
        console.error(
          '[Plaid] processSuccess: 75s outer timeout — server did not respond',
        );
        if (isMounted) {
          setError(
            t(
              'Timed out waiting for Plaid to respond. Check the server logs and try again.',
            ),
          );
          setStatus('error');
        }
      }, 75_000);

      const clearOuter = () => {
        if (outerTimerRef.current !== null) {
          clearTimeout(outerTimerRef.current);
          outerTimerRef.current = null;
        }
      };

      try {
        if (!serverURL) throw new Error('No serverURL');

        console.log(`[Plaid] ${ts()} publicToken received: true`);
        console.log(`[Plaid] ${ts()} → exchange-public-token started`);
        if (isMounted) setStatus('exchanging-token');

        const tokenData = await exchangePublicToken(serverURL, publicToken);
        console.log(
          `[Plaid] ${ts()} exchange-public-token completed, itemId present:`,
          !!tokenData.itemId,
          'itemId:',
          tokenData.itemId,
        );

        if (timedOut) return;

        console.log(
          `[Plaid] ${ts()} → get-plaid-accounts started, itemId:`,
          tokenData.itemId,
        );
        if (isMounted) setStatus('fetching-accounts');

        const accounts = await getPlaidAccounts(serverURL, tokenData.itemId);
        console.log(
          `[Plaid] ${ts()} get-plaid-accounts completed, accounts:`,
          accounts.length,
        );

        if (timedOut) return;

        if (accounts.length === 0) {
          throw new Error(
            t('Plaid connected, but no accounts were returned. Try again.'),
          );
        }

        clearOuter();
        console.log(`[Plaid] ${ts()} → opening SelectLinkedAccounts modal`);
        // Dismiss plaid-link BEFORE calling onSuccess so that when onSuccess
        // pushes select-linked-accounts it becomes the new top of the stack,
        // not immediately popped by the popModal that would otherwise follow.
        if (isMounted) dispatch(popModal());
        await onSuccess({
          accounts,
          itemId: tokenData.itemId,
          institutionId: tokenData.institutionId ?? institutionId,
          institutionName: tokenData.institutionName ?? institutionName,
        });
      } catch (err) {
        clearOuter();
        console.error('[Plaid] processSuccess FAILED:', err);
        resultProcessedRef.current = false;
        if (isMounted && !timedOut) {
          setError(
            err instanceof Error
              ? err.message
              : t('Failed to process Plaid connection'),
          );
          setStatus('error');
        }
      }
    }

    // postMessage path — fast path when COOP doesn't silently drop cross-BCG messages.
    // If it fires, great. If not, the server-relay poll below is the guaranteed path.
    const handleMessage = async (event: MessageEvent) => {
      const popupOrigin = serverURL ? new URL(serverURL).origin : null;
      console.log(
        '[Plaid] window.message — origin:',
        event.origin,
        'type:',
        event.data?.type,
      );

      const originAccepted =
        event.origin === window.location.origin || event.origin === popupOrigin;
      if (!originAccepted) {
        console.warn(
          '[Plaid] message from unexpected origin — ignored:',
          event.origin,
        );
        return;
      }

      if (event.data?.type === 'plaid-popup-ready') {
        console.log('[Plaid] popup confirmed postMessage channel');
        if (initInterval !== null) {
          clearInterval(initInterval);
          initInterval = null;
        }
        return;
      }

      if (event.data?.type === 'plaid-link-success') {
        const publicToken = event.data.publicToken as string | undefined;
        console.log(
          '[Plaid] plaid-link-success via postMessage, publicToken present:',
          !!publicToken,
        );
        if (!publicToken) {
          console.warn(
            '[Plaid] plaid-link-success missing publicToken — ignoring',
          );
          return;
        }
        const meta = event.data.metadata as
          | { institution?: { institution_id?: string; name?: string } }
          | undefined;
        void processSuccess(
          publicToken,
          meta?.institution?.institution_id,
          meta?.institution?.name,
        );
        return;
      }

      if (event.data?.type === 'plaid-link-error') {
        console.error(
          '[Plaid] plaid-link-error via postMessage:',
          event.data.error,
        );
        if (isMounted) {
          setError(event.data.error ?? t('Plaid Link returned an error'));
          setStatus('error');
        }
        return;
      }

      if (event.data?.type === 'plaid-link-exit') {
        console.log('[Plaid] plaid-link-exit via postMessage — user cancelled');
        if (isMounted) setStatus('cancelled');
        if (onClose && isMounted) onClose();
      }
    };

    window.addEventListener('message', handleMessage);

    async function initiatePlaidLink() {
      try {
        if (!serverURL) {
          if (isMounted) {
            setError(t('Sync server not configured'));
            setStatus('error');
          }
          return;
        }

        const userId = `user_${Date.now()}`;
        console.log('[Plaid] → opening: creating link token, userId:', userId);
        const linkToken = await createLinkToken(serverURL, userId);
        console.log('[Plaid] link token created');

        const popupOrigin = new URL(serverURL).origin;
        const plaidLinkUrl =
          `${serverURL}/plaid/link` +
          `?link_token=${encodeURIComponent(linkToken)}` +
          `&app_origin=${encodeURIComponent(window.location.origin)}`;
        console.log(
          '[Plaid] opening popup:',
          plaidLinkUrl.replace(linkToken, '[TOKEN]'),
        );

        popup = window.open(
          plaidLinkUrl,
          'PlaidLink',
          'width=500,height=700,left=100,top=100',
        );

        if (!popup) {
          throw new Error(
            t('Failed to open Plaid Link popup. Check popup blocker settings.'),
          );
        }

        if (isMounted) {
          setPopupWindow(popup);
          console.log('[Plaid] → waiting-for-user');
          setStatus('waiting-for-user');
        }

        // Best-effort: send plaid-init so popup can capture event.source and use
        // it for postMessage back (COOP nulls window.opener in the popup).
        // Not required — server relay below is the guaranteed path.
        initInterval = setInterval(() => {
          if (!popup) {
            clearInterval(initInterval!);
            initInterval = null;
            return;
          }
          try {
            popup.postMessage({ type: 'plaid-init' }, popupOrigin);
          } catch {
            // COOP may block this silently — fall through to server relay.
            clearInterval(initInterval!);
            initInterval = null;
          }
        }, 200);
        // Stop sending after 30s regardless.
        setTimeout(() => {
          if (initInterval !== null) {
            clearInterval(initInterval);
            initInterval = null;
          }
        }, 30_000);

        // Server-side relay poll. The popup POSTs /plaid/popup-complete (stores
        // publicToken on the server keyed by linkToken) then closes. We poll
        // /plaid/popup-result every 500ms.
        //
        // IMPORTANT: We do NOT use popup.closed to gate state transitions.
        // With COOP: same-origin on the Vite dev server, Chrome treats the
        // cross-BCG popup reference as "closed" immediately, making popup.closed
        // unreliable as a signal. We only advance state when we have real data.
        //
        // We poll for up to 5 minutes (Plaid flows rarely take longer).
        const POLL_TIMEOUT_MS = 5 * 60 * 1000;
        const pollStartedAt = Date.now();

        console.log('[Plaid] starting /popup-result poll (500ms, 5min max)');
        pollInterval = setInterval(() => {
          // Stop if already handled (postMessage path got here first).
          if (resultProcessedRef.current) {
            stopIntervals();
            return;
          }

          // Timeout: give up after 5 minutes.
          if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) {
            console.log('[Plaid] poll: 5-minute timeout reached — stopping');
            stopIntervals();
            return;
          }

          void checkPopupResult(serverURL, linkToken)
            .then(result => {
              if (!result.pending) {
                console.log('[Plaid] poll: GOT result from /popup-result');
                stopIntervals();
                if (!result.publicToken) {
                  console.warn(
                    '[Plaid] poll: result has no publicToken — ignoring',
                  );
                  return;
                }
                void processSuccess(
                  result.publicToken,
                  result.institutionId,
                  result.institutionName,
                );
              }
              // pending: keep polling — user is still in Plaid flow
            })
            .catch(err => {
              // Non-fatal: log and keep polling. Will stop at timeout.
              console.warn(
                '[Plaid] /popup-result poll error:',
                (err as Error).message,
              );
            });
        }, 500);
      } catch (err) {
        console.error('[Plaid] initiatePlaidLink error:', err);
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : t('Failed to initialize Plaid Link'),
          );
          setStatus('error');
        }
      }
    }

    void initiatePlaidLink();

    return () => {
      isMounted = false;
      window.removeEventListener('message', handleMessage);
      stopIntervals();
      // Try to close popup on unmount — may fail cross-BCG, that's OK.
      try {
        if (popup && !popup.closed) popup.close();
      } catch {
        /* cross-BCG close attempt — best effort */
      }
    };
  }, [dispatch, onClose, onSuccess, serverURL, t]);

  function handleClose() {
    try {
      if (popupWindow && !popupWindow.closed) popupWindow.close();
    } catch {
      /* cross-BCG — best effort */
    }
    if (onClose) onClose();
    dispatch(popModal());
  }

  const isConnecting =
    status === 'exchanging-token' || status === 'fetching-accounts';

  return (
    <Modal name="plaid-link">
      <ModalHeader title={t('Link Plaid Account')} />

      <div style={{ padding: '20px' }}>
        {status === 'opening' && (
          <Paragraph>
            <Trans>Opening Plaid Link...</Trans>
          </Paragraph>
        )}

        {status === 'waiting-for-user' && (
          <Paragraph>
            <Trans>
              Complete setup in the Plaid popup window, then return here.
            </Trans>
          </Paragraph>
        )}

        {isConnecting && (
          <Paragraph>
            <Trans>
              {status === 'exchanging-token'
                ? 'Exchanging token with Plaid...'
                : 'Fetching your accounts...'}
            </Trans>
          </Paragraph>
        )}

        {status === 'cancelled' && (
          <Paragraph>
            <Trans>Plaid linking was cancelled.</Trans>
          </Paragraph>
        )}

        {status === 'error' && error && (
          <ErrorAlert>
            <Trans>{error}</Trans>
          </ErrorAlert>
        )}
      </div>

      {status !== 'opening' && (
        <ModalButtons>
          <ModalCloseButton onPress={handleClose} />
        </ModalButtons>
      )}
    </Modal>
  );
}
