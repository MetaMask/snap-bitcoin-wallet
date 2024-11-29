import { BtcAccountType } from '@metamask/keyring-api';

export const BtcAccountTypeToScriptType = {
  [BtcAccountType.P2wpkh]: 'p2wpkh',
};

export enum ScriptType {
  P2pkh = 'p2pkh',
  P2shP2wkh = 'p2sh-p2wpkh',
  P2wpkh = 'p2wpkh',
}

// reference https://help.magiceden.io/en/articles/8665399-navigating-bitcoin-dust-understanding-limits-and-safeguarding-your-transactions-on-magic-eden
// "Dust" is defined in terms of dustRelayFee,
// which has units satoshis-per-kilobyte.
// If you'd pay more in fees than the value of the output
// to spend something, then we consider it dust.
// A typical spendable non-segwit txout is 34 bytes big, and will
// need a CTxIn of at least 148 bytes to spend:
// so dust is a spendable txout less than
// 182*dustRelayFee/1000 (in satoshis).
// 546 satoshis at the default rate of 3000 sat/kvB.
// A typical spendable segwit P2WPKH txout is 31 bytes big, and will
// need a CTxIn of at least 67 bytes to spend:
// so dust is a spendable txout less than
// 98*dustRelayFee/1000 (in satoshis).
// 294 satoshis at the default rate of 3000 sat/kvB.
export const DustLimit = {
  /* eslint-disable */
  p2pkh: 546,
  'p2sh-p2wpkh': 540,
  p2wpkh: 294,
  /* eslint-disable */
};

// Maximum weight in bytes for a standard transaction
export const MaxStandardTxWeight = 400000;

// Default minimum fee rate in BTC/KvB
// To align with the response from RPC provider, we use BTC unit in KvB
export const DefaultTxMinFeeRateInBtcPerKvb = 0.0001;
