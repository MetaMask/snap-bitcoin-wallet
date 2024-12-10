import { BtcMethod, KeyringAccount } from '@metamask/keyring-api';
import { BitcoinAccount } from '../entities';
import { addressTypeToCaip2 } from './caip2';

export function toKeyringAccount(account: BitcoinAccount): KeyringAccount {
  return {
    type: addressTypeToCaip2[account.addressType],
    id: account.id,
    address: account.nextUnusedAddress.address,
    options: {},
    methods: [BtcMethod.SendBitcoin],
  } as KeyringAccount;
}
