import type { BIP32Interface } from 'bip32';
// import type { Network, Payment } from 'bitcoinjs-lib';
import type { Network } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';
import type { Infer } from 'superstruct';
import { object, refine, number, enums } from 'superstruct';

// import { hexToBuffer } from '../../utils';
import type { StaticImplements } from '../../utils/static';
import { ScriptType, addressGapLimit } from './constants';
import type { AccountSigner } from './signer';
import { getBtcPaymentInst, linearSearch } from './utils';
import { deriveByPath } from './utils/deriver';

export type IStaticBtcAccount = {
  path: string[];
  scriptType: ScriptType;
  new (
    mfp: string,
    rootNode: BIP32Interface,
    network: Network,
    scriptType: ScriptType,
    type: string,
    signer: AccountSigner,
    accountIndex: Index,
  ): BtcAccount;
};

export const IndexStruct = refine(
  number(),
  'non negative',
  (value) => value > 0,
);
export const DerivationPathSegmentStruct = object({
  index: IndexStruct,
  change: enums([0, 1]),
});

export type Index = Infer<typeof IndexStruct>;
export type DerivationPathSegment = Infer<typeof DerivationPathSegmentStruct>;

export abstract class BtcAccount {
  /**
   * The index of the address.
   */
  addressIndex: Index = 0;

  /**
   * A map to store the address and its corresponding derivation path segment.
   */
  readonly #addressMap: Map<string, DerivationPathSegment> = new Map();

  readonly network: Network;

  readonly scriptType: ScriptType;

  /**
   * The master fingerprint of the derived node, as a string.
   */
  readonly mfp: string;

  /**
   * Root node of the account.
   */
  readonly rootNode: BIP32Interface;

  /**
   * The type of the account, e.g. `bip122:p2pwh`, as a string.
   */
  readonly type: string;

  /**
   * The `IAccountSigner` object derived from the root node.
   */
  readonly signer: AccountSigner;

  /**
   * Index of the account.
   */
  readonly accountIndex: Index;

  constructor(
    mfp: string,
    rootNode: BIP32Interface,
    network: Network,
    scriptType: ScriptType,
    type: string,
    signer: AccountSigner,
    accountIndex: Index,
  ) {
    this.mfp = mfp;
    this.rootNode = rootNode;
    this.network = network;
    this.scriptType = scriptType;
    this.signer = signer;
    this.type = type;
    this.accountIndex = accountIndex;
  }

  /**
   * A getter function to return the corresponding account type's external address.
   *
   * @returns The corresponding account type's external address.
   */
  get address(): string {
    return this.#deriveAddress({ change: 0, index: this.addressIndex });
  }

  async discovery(
    scope: string,
    gapLimit: number = addressGapLimit,
  ): Promise<void> {
    const discoveredAddresses: string[] = [];
    const usedAddresses: string[] = [];
    const unusedAddresses: string[] = [];

    while (unusedAddresses.length < gapLimit) {
      const currentAddressIndex = this.#addressMap.size / 2;
      for (let i = 0; i < addressGapLimit - unusedAddresses.length; i++) {
        discoveredAddresses.push(
          this.#deriveAddress({
            change: 0,
            index: currentAddressIndex + unusedAddresses.length + i,
          }),
        );
      }

      console.log({ discoveredAddresses });
      const { usedAddresses: used, unusedAddresses: unused } =
        await linearSearch(scope, discoveredAddresses);

      console.log({ used, unused });

      if (used.length === 0) {
        unusedAddresses.push(...unused);
        console.log('unusedAddresses', unusedAddresses.length, unusedAddresses);
      } else {
        usedAddresses.push(...unusedAddresses, ...used);
        console.log('usedAddresses', usedAddresses.length, usedAddresses);
        // Clear the unused addresses array to add the new set of addresses
        unusedAddresses.length = 0;
        unusedAddresses.push(...unused);
        console.log('unusedAddresses', unusedAddresses.length, unusedAddresses);

        this.#updateAddressMap(usedAddresses, currentAddressIndex);
        this.#updateAddressIndex();
        // Clear the used addresses array to add the new set of addresses in the next iteration
        usedAddresses.length = 0;
      }

      discoveredAddresses.length = 0;
    }

    console.log('Address map', this.#addressMap);
    console.log('Address index', this.addressIndex);
  }

  #deriveAddress({ change, index }: DerivationPathSegment): string {
    const pubKeyBuffer = this.#generatePubKeyByDerivationPathSegment({
      change,
      index,
    });
    const payment = getBtcPaymentInst(
      this.scriptType,
      pubKeyBuffer,
      this.network,
    );
    if (!payment.address) {
      throw new Error('Failed to derive address');
    }
    return payment.address;
  }

  /**
   * Generates the public key buffer by the given BIP-0032 change and index values.
   *
   * @param params - The BIP-0032 change and index values.
   * @param params.change - BIP-0032 change value.
   * @param params.index - BIP-0032 index value.
   * @returns Public key buffer derived by the given BIP-0032 change and index values.
   */
  #generatePubKeyByDerivationPathSegment({
    change,
    index,
  }: DerivationPathSegment): Buffer {
    const childNode = deriveByPath(this.rootNode, [
      `m`,
      `${this.accountIndex}'`,
      `${change}`,
      `${index}`,
    ]);
    return childNode.publicKey;
  }

  #updateAddressMap = (addresses: string[], addressIndex: number): void => {
    addresses.forEach((externalAddress, index) => {
      const internalAddress = this.#deriveAddress({
        change: 1,
        index: addressIndex + index,
      });
      this.#addressMap.set(externalAddress, {
        change: 0,
        index: addressIndex + index,
      });
      this.#addressMap.set(internalAddress, {
        change: 1,
        index: addressIndex + index,
      });
    });
  };

  #updateAddressIndex = (): void => {
    this.addressIndex = this.#addressMap.size / 2;
    console.log('addressIndex ->', this.addressIndex);
  };
}

export class P2WPKHAccount
  extends BtcAccount
  implements StaticImplements<IStaticBtcAccount, typeof P2WPKHAccount>
{
  static readonly path = ['m', "84'", "0'"];

  static readonly scriptType = ScriptType.P2wpkh;
}

export class P2WPKHTestnetAccount
  extends P2WPKHAccount
  implements StaticImplements<IStaticBtcAccount, typeof P2WPKHTestnetAccount>
{
  static readonly path = ['m', "84'", "1'"];
}
