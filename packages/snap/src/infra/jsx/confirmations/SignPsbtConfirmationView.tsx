import {
  Address,
  Box,
  Button,
  Container,
  Copyable,
  Footer,
  Section,
  Text as SnapText,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import type { Messages, SignPsbtConfirmationContext } from '../../../entities';
import { ConfirmationEvent } from '../../../entities';
import { AssetIconInline, HeadingWithReturn } from '../components';
import {
  displayAmount,
  displayCaip10,
  displayExchangeAmount,
  displayNetwork,
  translate,
} from '../format';

type SignPsbtConfirmationViewProps = {
  context: SignPsbtConfirmationContext;
  messages: Messages;
};

export const SignPsbtConfirmationView: SnapComponent<
  SignPsbtConfirmationViewProps
> = ({ context, messages }) => {
  const t = translate(messages);
  const {
    account,
    network,
    origin,
    psbt,
    options,
    fee,
    currency,
    exchangeRate,
    outputs,
    inputCount,
  } = context;

  return (
    <Container>
      <Box>
        <HeadingWithReturn
          heading={t('confirmation.signPsbt.title')}
          returnButtonName={ConfirmationEvent.Cancel}
        />

        {outputs.length > 0 ? (
          <Section>
            <Box>
              <SnapText fontWeight="medium">
                {t('confirmation.signPsbt.outputs')}
              </SnapText>
            </Box>
            {outputs.map((output, index) => {
              let label: string;
              if (output.isOpReturn) {
                label = t('confirmation.signPsbt.output.opReturn');
              } else if (output.isMine) {
                label = t('confirmation.signPsbt.output.change');
              } else if (output.address) {
                label = `${t('toAddress')} #${index + 1}`;
              } else {
                label = t('confirmation.signPsbt.output.unknown');
              }

              return (
                <Box key={`output-${index}`}>
                  <Box alignment="space-between" direction="horizontal">
                    <SnapText color="alternative">{label}</SnapText>
                    <Box direction="horizontal" alignment="center">
                      <SnapText color="muted">
                        {displayExchangeAmount(
                          BigInt(output.amount),
                          exchangeRate,
                        )}
                      </SnapText>
                      <SnapText>
                        {displayAmount(BigInt(output.amount), currency)}
                      </SnapText>
                    </Box>
                  </Box>
                  {output.address ? (
                    <Box alignment="end">
                      <Address
                        address={displayCaip10(network, output.address)}
                        truncate
                      />
                    </Box>
                  ) : null}
                </Box>
              );
            })}
          </Section>
        ) : null}

        <Section>
          <Box direction="horizontal" center>
            <SnapText fontWeight="medium">
              {t('confirmation.signPsbt.options')}
            </SnapText>
          </Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText color="alternative">
              {t('confirmation.signPsbt.options.fill')}
            </SnapText>
            <SnapText>{options.fill ? t('yes') : t('no')}</SnapText>
          </Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText color="alternative">
              {t('confirmation.signPsbt.options.broadcast')}
            </SnapText>
            <SnapText>{options.broadcast ? t('yes') : t('no')}</SnapText>
          </Box>
          {inputCount > 0 ? (
            <Box alignment="space-between" direction="horizontal">
              <SnapText color="alternative">
                {t('confirmation.signPsbt.inputs')}
              </SnapText>
              <SnapText>{inputCount.toString()}</SnapText>
            </Box>
          ) : null}
          {fee === undefined ? null : (
            <Box alignment="space-between" direction="horizontal">
              <SnapText color="alternative">{t('networkFee')}</SnapText>
              <Box direction="horizontal" alignment="center">
                <SnapText color="muted">
                  {displayExchangeAmount(BigInt(fee), exchangeRate)}
                </SnapText>
                <SnapText>{displayAmount(BigInt(fee), currency)}</SnapText>
              </Box>
            </Box>
          )}
        </Section>

        <Section>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('confirmation.requestOrigin')}
            </SnapText>
            <SnapText>{origin ?? 'MetaMask'}</SnapText>
          </Box>
          <Box>{null}</Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('from')}
            </SnapText>
            <Address
              address={displayCaip10(network, account.address)}
              displayName
            />
          </Box>
          <Box>{null}</Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('network')}
            </SnapText>
            <Box direction="horizontal" center>
              <AssetIconInline network={network} variant="network" />
              <SnapText>{displayNetwork(network)}</SnapText>
            </Box>
          </Box>
        </Section>

        <Section>
          <Box>
            <SnapText fontWeight="medium">
              {t('confirmation.signPsbt.rawPsbt')}
            </SnapText>
          </Box>
          <Copyable value={psbt} />
        </Section>
      </Box>
      <Footer>
        <Button name={ConfirmationEvent.Cancel}>{t('cancel')}</Button>
        <Button name={ConfirmationEvent.Confirm}>
          {t('confirmation.signPsbt.confirmButton')}
        </Button>
      </Footer>
    </Container>
  );
};
