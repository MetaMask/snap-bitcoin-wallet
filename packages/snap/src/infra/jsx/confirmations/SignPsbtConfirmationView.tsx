import {
  Address as BdkAddress,
  Psbt,
  ScriptBuf,
} from '@metamask/bitcoindevkit';
import {
  Address,
  Box,
  Button,
  Container,
  Footer,
  Heading,
  Icon,
  Section,
  Text as SnapText,
  Tooltip,
  type SnapComponent,
} from '@metamask/snaps-sdk/jsx';

import type { Messages, SignPsbtConfirmationContext } from '../../../entities';
import { ConfirmationEvent } from '../../../entities';
import { AssetIconInline } from '../components';
import {
  displayAmount,
  displayCaip10,
  displayOrigin,
  translate,
} from '../format';

/* eslint-disable @typescript-eslint/naming-convention */
type PsbtUtxo = { value: number; script_pubkey: string };
type PsbtInputJson = {
  witness_utxo?: PsbtUtxo;
  non_witness_utxo?: { output: PsbtUtxo[] };
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Extract input UTXO data from PSBT JSON.
 * Tries witness_utxo first (SegWit), falls back to non_witness_utxo (legacy).
 *
 * @param psbtInput - The PSBT input data.
 * @param vout - The output index in the previous transaction.
 * @returns The UTXO data if available, undefined otherwise.
 */
const getInputUtxo = (
  psbtInput: PsbtInputJson | undefined,
  vout: number,
): PsbtUtxo | undefined =>
  psbtInput?.witness_utxo ?? psbtInput?.non_witness_utxo?.output[vout];

type SignPsbtConfirmationViewProps = {
  context: SignPsbtConfirmationContext;
  messages: Messages;
};

export const SignPsbtConfirmationView: SnapComponent<
  SignPsbtConfirmationViewProps
> = ({ context, messages }) => {
  const t = translate(messages);
  const { account, network, origin, feeRate } = context;
  const originHostname = origin ? displayOrigin(origin) : null;

  const psbt = Psbt.from_string(context.psbt);
  const tx = psbt.unsigned_tx;
  const txInputs = tx.input;
  const outputs = tx.output;

  // Parse PSBT JSON to get input UTXO data (witness_utxo or non_witness_utxo)
  const psbtInputs = (JSON.parse(psbt.to_json()) as { inputs: PsbtInputJson[] })
    .inputs;

  // Extract input data with amounts
  const inputs = txInputs.map((txIn, index) => {
    const utxo = getInputUtxo(psbtInputs[index], txIn.previous_output.vout);
    return {
      txid: txIn.previous_output.txid.toString(),
      vout: txIn.previous_output.vout,
      value: utxo ? BigInt(utxo.value) : undefined,
      scriptPubkey: utxo?.script_pubkey,
    };
  });

  // Calculate total input amount
  const totalInputSats = inputs.reduce(
    (sum, inp) => sum + (inp.value ?? BigInt(0)),
    BigInt(0),
  );

  // Calculate total output amount
  const totalOutputSats = outputs.reduce(
    (sum, out) => sum + out.value.to_sat(),
    BigInt(0),
  );

  // Get fee if available
  const fee = psbt.fee_amount()?.to_sat();

  return (
    <Container>
      <Box>
        <Box alignment="center" center>
          <Box>{null}</Box>
          <Heading size="lg">{t('confirmation.signPsbt.title')}</Heading>
          <Box>{null}</Box>
        </Box>

        {/* Fee & Details Section */}
        <Section>
          {fee === undefined ? null : (
            <Box alignment="space-between" direction="horizontal">
              <Box alignment="space-between" direction="horizontal" center>
                <SnapText fontWeight="medium" color="alternative">
                  {t('networkFee')}
                </SnapText>
                <Tooltip content={t('networkFeeTooltip')}>
                  <Icon name="question" color="muted" />
                </Tooltip>
              </Box>
              <Box direction="horizontal" center>
                <SnapText>{displayAmount(fee)}</SnapText>
                <AssetIconInline network={network} />
              </Box>
            </Box>
          )}
          {feeRate === undefined ? null : (
            <Box alignment="space-between" direction="horizontal">
              <SnapText fontWeight="medium" color="alternative">
                {t('feeRate')}
              </SnapText>
              <SnapText>{feeRate.toString()} sat/vB</SnapText>
            </Box>
          )}
          {originHostname ? (
            <Box alignment="space-between" direction="horizontal">
              <Box alignment="space-between" direction="horizontal" center>
                <SnapText fontWeight="medium" color="alternative">
                  {t('confirmation.origin')}
                </SnapText>
                <Tooltip content={t('confirmation.origin.tooltip')}>
                  <Icon name="question" color="muted" />
                </Tooltip>
              </Box>
              <SnapText>{originHostname}</SnapText>
            </Box>
          ) : null}
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('confirmation.account')}
            </SnapText>
            <Address
              address={displayCaip10(network, account.address)}
              displayName
            />
          </Box>
        </Section>

        {/* Inputs Section */}
        <Section>
          <Box direction="horizontal" center>
            <SnapText fontWeight="medium">
              {t('confirmation.signPsbt.inputs')}
            </SnapText>
          </Box>
          {inputs.map((input, index) => {
            const inputAddress = input.scriptPubkey
              ? BdkAddress.from_script(
                  ScriptBuf.from_hex(input.scriptPubkey),
                  network,
                ).toString()
              : null;
            return (
              <Box key={`input-${index}`} direction="vertical">
                <Box alignment="space-between" direction="horizontal">
                  <SnapText color="alternative">
                    #{(index + 1).toString()}
                  </SnapText>
                  {input.value === undefined ? (
                    <SnapText color="muted">
                      {input.txid.slice(0, 8)}...:{input.vout.toString()}
                    </SnapText>
                  ) : (
                    <Box direction="horizontal" center>
                      <SnapText>{displayAmount(input.value)}</SnapText>
                      <AssetIconInline network={network} />
                    </Box>
                  )}
                </Box>
                {inputAddress ? (
                  <SnapText color="muted">
                    {inputAddress.slice(0, 4)}...{inputAddress.slice(-4)}
                  </SnapText>
                ) : null}
              </Box>
            );
          })}
          <Box>{null}</Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('total')}
            </SnapText>
            <Box direction="horizontal" center>
              <SnapText>{displayAmount(totalInputSats)}</SnapText>
              <AssetIconInline network={network} />
            </Box>
          </Box>
        </Section>

        {/* Outputs Section */}
        <Section>
          <Box direction="horizontal" center>
            <SnapText fontWeight="medium">
              {t('confirmation.signPsbt.outputs')}
            </SnapText>
          </Box>
          {outputs.map((output, index) => {
            const outputAddress = BdkAddress.from_script(
              output.script_pubkey,
              network,
            ).toString();
            return (
              <Box key={`output-${index}`} direction="vertical">
                <Box alignment="space-between" direction="horizontal">
                  <SnapText color="alternative">
                    #{(index + 1).toString()}
                  </SnapText>
                  <Box direction="horizontal" center>
                    <SnapText>{displayAmount(output.value.to_sat())}</SnapText>
                    <AssetIconInline network={network} />
                  </Box>
                </Box>
                <SnapText color="muted">
                  {outputAddress.slice(0, 4)}...{outputAddress.slice(-4)}
                </SnapText>
              </Box>
            );
          })}
          <Box>{null}</Box>
          <Box alignment="space-between" direction="horizontal">
            <SnapText fontWeight="medium" color="alternative">
              {t('total')}
            </SnapText>
            <Box direction="horizontal" center>
              <SnapText>{displayAmount(totalOutputSats)}</SnapText>
              <AssetIconInline network={network} />
            </Box>
          </Box>
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
