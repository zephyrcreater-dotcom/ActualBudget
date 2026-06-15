import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Paragraph } from '@actual-app/components/paragraph';
import { View } from '@actual-app/components/view';

import { Error as ErrorAlert } from '#components/alerts';
import { Link } from '#components/common/Link';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '#components/common/Modal';
import { useServerURL } from '#components/ServerContext';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { popModal } from '#modals/modalsSlice';
import { clearPlaidCredentials, savePlaidCredentials } from '#plaid';
import { useDispatch } from '#redux';

type PlaidInitProps = Extract<ModalType, { name: 'plaid-init' }>['options'];

type CredentialFormState = {
  clientId: string;
  secret: string;
  env: 'sandbox' | 'development' | 'production';
};

export function PlaidInitModal({
  onSuccess,
  configured = false,
  env = '',
}: PlaidInitProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const serverURL = useServerURL();
  const [isEditing, setIsEditing] = useState(!configured);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<CredentialFormState>({
    clientId: '',
    secret: '',
    env: 'sandbox',
  });

  function handleClose() {
    dispatch(popModal());
  }

  async function handleSaveCredentials() {
    setError(null);
    setIsLoading(true);

    if (!formState.clientId || !formState.secret || !formState.env) {
      setError(t('All fields are required'));
      setIsLoading(false);
      return;
    }

    try {
      if (!serverURL) {
        throw new Error(t('Sync server not configured'));
      }

      await savePlaidCredentials(
        serverURL,
        formState.clientId,
        formState.secret,
        formState.env,
      );

      setIsEditing(false);
      setFormState({ clientId: '', secret: '', env: 'sandbox' });
      // Call onSuccess to trigger parent refresh
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('Failed to save credentials'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClearCredentials() {
    setError(null);
    setIsLoading(true);

    try {
      if (!serverURL) {
        throw new Error(t('Sync server not configured'));
      }

      await clearPlaidCredentials(serverURL);
      setIsEditing(true);
      setFormState({ clientId: '', secret: '', env: 'sandbox' });
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('Failed to clear credentials'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleContinue() {
    onSuccess?.();
    dispatch(popModal());
  }

  if (isEditing) {
    return (
      <Modal name="plaid-init">
        <ModalHeader title={t('Set up Plaid')} />

        <View style={{ padding: '20px', gap: 16 }}>
          <Paragraph>
            <Trans>
              Enter your Plaid API credentials to enable bank account linking.
              Credentials are stored securely on your sync server.
            </Trans>
          </Paragraph>

          {error && <ErrorAlert>{error}</ErrorAlert>}

          <View style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>
                <Trans>Plaid Client ID</Trans>
              </label>
              <input
                type="text"
                value={formState.clientId}
                onChange={e =>
                  setFormState({ ...formState, clientId: e.target.value })
                }
                placeholder={t('Enter your Plaid Client ID')}
                disabled={isLoading}
                style={{
                  padding: '8px 12px',
                  fontSize: 14,
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
              />
            </View>

            <View style={{ gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>
                <Trans>Plaid Secret</Trans>
              </label>
              <input
                type="password"
                value={formState.secret}
                onChange={e =>
                  setFormState({ ...formState, secret: e.target.value })
                }
                placeholder={t('Enter your Plaid Secret')}
                disabled={isLoading}
                style={{
                  padding: '8px 12px',
                  fontSize: 14,
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
              />
            </View>

            <View style={{ gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>
                <Trans>Environment</Trans>
              </label>
              <select
                value={formState.env}
                onChange={e =>
                  setFormState({
                    ...formState,
                    env: e.target.value as
                      | 'sandbox'
                      | 'development'
                      | 'production',
                  })
                }
                disabled={isLoading}
                style={{
                  padding: '8px 12px',
                  fontSize: 14,
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              >
                <option value="sandbox">
                  <Trans>Sandbox</Trans>
                </option>
                <option value="development">
                  <Trans>Development</Trans>
                </option>
                <option value="production">
                  <Trans>Production</Trans>
                </option>
              </select>
            </View>
          </View>

          <View
            style={{
              padding: '12px',
              backgroundColor: '#fef3cd',
              borderRadius: '4px',
              fontSize: 12,
              gap: 8,
            }}
          >
            <Paragraph style={{ margin: 0 }}>
              <strong>
                <Trans>Security Note:</Trans>
              </strong>
            </Paragraph>
            <Paragraph style={{ margin: 0 }}>
              <Trans>
                Credentials are stored on your sync server, not in your budget
                file. Never share your secret with anyone.
              </Trans>
            </Paragraph>
            <Paragraph style={{ margin: 0 }}>
              <Trans>
                Use sandbox environment for testing. Production credentials will
                incur Plaid API charges.
              </Trans>
            </Paragraph>
          </View>

          <Paragraph style={{ fontSize: 12, color: '#666' }}>
            <Trans>
              Get Plaid credentials at{' '}
              <Link
                variant="external"
                to="https://dashboard.plaid.com"
                linkColor="muted"
              >
                dashboard.plaid.com
              </Link>
            </Trans>
          </Paragraph>
        </View>

        <ModalButtons>
          <ModalCloseButton onPress={handleClose} />
          <Button
            variant="primary"
            onPress={handleSaveCredentials}
            isDisabled={isLoading}
          >
            <Trans>{isLoading ? 'Saving...' : 'Save Credentials'}</Trans>
          </Button>
        </ModalButtons>
      </Modal>
    );
  }

  return (
    <Modal name="plaid-init">
      <ModalHeader title={t('Plaid Configuration')} />

      <View style={{ padding: '20px', gap: 16 }}>
        <View
          style={{
            padding: '12px',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <Trans>✓ Plaid is configured</Trans>
        </View>

        <View style={{ gap: 8 }}>
          <Paragraph style={{ margin: 0, fontSize: 12, color: '#666' }}>
            <Trans>Environment:</Trans>
          </Paragraph>
          <View
            style={{
              padding: '8px 12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {env}
          </View>
        </View>

        <Paragraph>
          <Trans>
            You can now link your bank accounts using Plaid. Your credentials
            are securely stored on your sync server.
          </Trans>
        </Paragraph>

        <View style={{ gap: 8 }}>
          <Button
            variant="normal"
            onPress={() => setIsEditing(true)}
            style={{ width: '100%' }}
          >
            <Trans>Edit Credentials</Trans>
          </Button>
          <Button
            variant="normal"
            onPress={handleClearCredentials}
            isDisabled={isLoading}
            style={{ width: '100%' }}
          >
            <Trans>{isLoading ? 'Clearing...' : 'Clear Credentials'}</Trans>
          </Button>
        </View>
      </View>

      <ModalButtons>
        <ModalCloseButton onPress={handleClose} />
        <Button variant="primary" onPress={handleContinue}>
          <Trans>Continue to Plaid</Trans>
        </Button>
      </ModalButtons>
    </Modal>
  );
}
