import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Paragraph } from '@actual-app/components/paragraph';
import { View } from '@actual-app/components/view';

import { Link } from '#components/common/Link';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '#components/common/Modal';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { popModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

type PlaidInitProps = Extract<ModalType, { name: 'plaid-init' }>['options'];

export function PlaidInitModal({ onSuccess }: PlaidInitProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  function handleClose() {
    dispatch(popModal());
  }

  function handleSetup() {
    onSuccess?.();
    dispatch(popModal());
  }

  return (
    <Modal name="plaid-init">
      <ModalHeader title={t('Set up Plaid')} />

      <View style={{ padding: '20px', gap: 16 }}>
        <Paragraph>
          <Trans>
            To use Plaid, your server administrator needs to configure Plaid API
            credentials on the Actual server.
          </Trans>
        </Paragraph>

        <Paragraph>
          <Trans>
            Once configured, you'll be able to link your bank account using
            Plaid Link.
          </Trans>
        </Paragraph>

        <Paragraph>
          <Trans>
            Learn more about{' '}
            <Link
              variant="external"
              to="https://plaid.com/docs/quickstart/"
              linkColor="muted"
            >
              setting up Plaid
            </Link>
            .
          </Trans>
        </Paragraph>

        <View style={{ padding: '16px 0', fontSize: 13, fontStyle: 'italic' }}>
          <Trans>
            Note: Plaid credentials are configured server-side for security.
            Contact your server administrator if Plaid is not available.
          </Trans>
        </View>
      </View>

      <ModalButtons>
        <ModalCloseButton onPress={handleClose} />
        <Button variant="primary" onPress={handleSetup}>
          <Trans>Continue</Trans>
        </Button>
      </ModalButtons>
    </Modal>
  );
}
